import "./env.js";
import cors from "cors";
import express from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import Stripe from "stripe";
import { runSiteAudit } from "./audit.js";
import { buildAuditPdf } from "./audit-pipeline.js";
import { sendAuditReportEmail } from "./email.js";
import { generateAuditPDF } from "./pdf.js";
import { sendAuditError } from "./errors.js";
import { handleInstantlyWebhook } from "./instantly-webhook.js";
import { normalizeWebsiteUrl, scrapeWebsiteText } from "./scrape.js";
import { generateRedesignHtml } from "./redesign.js";
import { generateRedesignHtmlClaude } from "./redesign-claude.js";
import { registerAdminRoutes, runRedesignGeneration } from "./admin.js";
import {
  DEFAULT_REDESIGN_MAX_TOKENS,
  resolveRedesignEngine,
} from "./redesign-engines.js";
import { normalizeRootDomain } from "./url-utils.js";
import { processNurtureEmails } from "./nurture.js";
import { processWarmLeadNurture } from "./warm-lead-nurture.js";
import {
  fetchRedesignByToken,
  findAuditByStripeSessionId,
  findLatestRedesignForDomain,
  insertPendingRedesign,
  setRedesignEmail,
  isSupabaseConfigured,
  markInitialEmailSent,
  saveAuditRecord,
  saveRedesignLeadIntent,
} from "./supabase.js";

const app = express();
const PORT = Number(process.env.PORT) || 4000;

// Render terminates TLS at a single proxy hop — needed so req.ip (and the
// public-redesign rate limiter) sees the real client IP, not the proxy's.
app.set("trust proxy", 1);

let stripeClient;

function stripeKeyMode() {
  const key = process.env.STRIPE_SECRET_KEY || "";
  if (key.startsWith("sk_test_")) return "test";
  if (key.startsWith("sk_live_")) return "live";
  return "unknown";
}

function assertStripeKeyMatchesSession(sessionId) {
  const isTestSession = sessionId.startsWith("cs_test_");
  const isLiveSession = sessionId.startsWith("cs_live_");
  const mode = stripeKeyMode();

  if (isTestSession && mode === "live") {
    throw new Error(
      "Stripe key mismatch: your .env uses sk_live_... but this is a test checkout (cs_test_...). For local dev, set STRIPE_SECRET_KEY to your sk_test_... key from Stripe Dashboard (test mode)."
    );
  }

  if (isLiveSession && mode === "test") {
    throw new Error(
      "Stripe key mismatch: your .env uses sk_test_... but this is a live checkout (cs_live_...). Use sk_live_... on production only."
    );
  }
}

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not configured on the server.");
  }
  if (!stripeClient) {
    stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return stripeClient;
}

function getWebsiteUrlFromSession(session) {
  return session.custom_fields?.[0]?.text?.value?.trim() || null;
}

function sendPdfResponse(res, pdfBuffer) {
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    'attachment; filename="Website-Audit.pdf"'
  );
  return res.send(pdfBuffer);
}

function runAuditInBackground(websiteUrl, sessionId, customerEmail) {
  const logPrefix = `[webhook:${sessionId ?? "unknown"}]`;

  setImmediate(async () => {
    try {
      if (isSupabaseConfigured()) {
        const existing = await findAuditByStripeSessionId(sessionId);
        if (existing?.initial_email_sent_at) {
          console.log(
            `${logPrefix} Audit already delivered for session — skipping webhook email.`
          );
          return;
        }
      }

      console.log(
        `${logPrefix} Webhook received; delivery is handled by /api/audit-status on redirect.`
      );
    } catch (err) {
      console.error(`${logPrefix} Webhook check failed:`, err.message);
    }
  });
}

app.use(cors({ origin: true }));

// Stripe webhook (must be BEFORE express.json)
app.post("/webhook", express.raw({ type: "application/json" }), (req, res) => {
  console.log("🔔 Webhook hit!");
  const sig = req.headers["stripe-signature"];
  let event;

  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
    console.log("✅ Signature verified!");
  } catch (err) {
    console.error("❌ Webhook Error:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    console.log(
      `💰 Payment successful for: ${session.customer_details?.email ?? "(no email)"}`
    );

    // $9 "New Design Variation" (duplicate-domain paywall on /try).
    if (session.metadata?.type === "variation") {
      res.status(200).json({ received: true });
      runVariationGenerationFromSession(session);
      return;
    }

    const websiteUrl = getWebsiteUrlFromSession(session);

    if (websiteUrl) {
      console.log(`📎 Website URL received: ${websiteUrl}`);
      res.status(200).json({ received: true });
      runAuditInBackground(
        websiteUrl,
        session.id,
        session.customer_details?.email
      );
      return;
    }

    console.warn(
      `⚠️ No website URL on session ${session.id} (custom_fields[0] was empty)`
    );
  }

  res.status(200).json({ received: true });
});

app.use(express.json({ limit: "32kb" }));

app.post("/api/webhooks/instantly", handleInstantlyWebhook);

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    service: "toolcrate-audit-api",
    openaiConfigured: Boolean(process.env.OPENAI_API_KEY),
    stripeConfigured: Boolean(process.env.STRIPE_SECRET_KEY),
    supabaseConfigured: isSupabaseConfigured(),
    cronSecretConfigured: Boolean(process.env.CRON_SECRET?.trim()),
  });
});

app.get("/api/audit-status", async (req, res) => {
  const sessionId = String(req.query.session_id ?? "").trim();
  const logPrefix = `[audit-status:${sessionId || "unknown"}]`;

  if (!sessionId) {
    return res.status(400).json({
      ok: false,
      success: false,
      error:
        "Missing session_id. Complete checkout again or enter your website URL manually.",
      code: "MISSING_SESSION_ID",
    });
  }

  try {
    assertStripeKeyMatchesSession(sessionId);
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== "paid") {
      return res.status(402).json({
        ok: false,
        success: false,
        error: "Payment not completed yet. Please finish checkout first.",
        code: "PAYMENT_INCOMPLETE",
      });
    }

    const websiteUrl = getWebsiteUrlFromSession(session);

    if (!websiteUrl) {
      return res.status(400).json({
        ok: false,
        success: false,
        error:
          "We couldn't find your website URL on this checkout. Please enter it below.",
        code: "MISSING_WEBSITE_URL",
      });
    }

    const customerEmail = session.customer_details?.email?.trim() || null;

    if (isSupabaseConfigured()) {
      const existing = await findAuditByStripeSessionId(sessionId);

      if (existing?.report) {
        console.log(`${logPrefix} Returning cached audit (no duplicate email).`);
        const pdfBuffer = await generateAuditPDF(
          existing.report,
          existing.website_url
        );

        if (customerEmail && !existing.initial_email_sent_at) {
          console.log(`${logPrefix} Retrying one-time delivery email...`);
          await sendAuditReportEmail(
            customerEmail,
            existing.website_url,
            pdfBuffer
          );
          await markInitialEmailSent(existing.id);
        }

        return sendPdfResponse(res, pdfBuffer);
      }
    }

    const { pdfBuffer, normalizedUrl, report } = await buildAuditPdf(
      websiteUrl,
      logPrefix
    );

    let shouldSendEmail = Boolean(customerEmail);

    if (customerEmail && isSupabaseConfigured()) {
      console.log(`${logPrefix} Saving audit to Supabase...`);
      const saved = await saveAuditRecord({
        email: customerEmail,
        websiteUrl: normalizedUrl,
        stripeSessionId: sessionId,
        report,
      });
      shouldSendEmail = saved.isNew;
    } else if (!isSupabaseConfigured()) {
      console.warn(`${logPrefix} Supabase not configured — audit not persisted.`);
    }

    if (shouldSendEmail) {
      console.log(`${logPrefix} Sending delivery email to ${customerEmail}...`);
      await sendAuditReportEmail(customerEmail, normalizedUrl, pdfBuffer);

      if (isSupabaseConfigured()) {
        const saved = await findAuditByStripeSessionId(sessionId);
        if (saved?.id) {
          await markInitialEmailSent(saved.id);
        }
      }
    } else if (customerEmail) {
      console.log(`${logPrefix} Delivery email already sent — skipping Resend.`);
    } else {
      console.warn(`${logPrefix} No customer email on session — skipping Resend.`);
    }

    return sendPdfResponse(res, pdfBuffer);
  } catch (error) {
    return sendAuditError(res, error, logPrefix);
  }
});

app.post("/api/audit-pdf", async (req, res) => {
  const websiteUrl = req.body?.websiteUrl;
  const logPrefix = "[audit-pdf]";

  try {
    const { pdfBuffer } = await buildAuditPdf(websiteUrl, logPrefix);
    return sendPdfResponse(res, pdfBuffer);
  } catch (error) {
    return sendAuditError(res, error, logPrefix);
  }
});

function verifyCronSecret(req) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    throw new Error("CRON_SECRET is not configured on the server.");
  }

  const bearer = req.headers.authorization?.startsWith("Bearer ")
    ? req.headers.authorization.slice(7)
    : null;
  const header = req.headers["x-cron-secret"];
  const query = req.query.secret;

  if (bearer !== secret && header !== secret && query !== secret) {
    const err = new Error("Unauthorized cron request.");
    err.statusCode = 401;
    throw err;
  }
}

async function handleNurtureCron(req, res) {
  try {
    verifyCronSecret(req);
    const summary = await processNurtureEmails();
    return res.json({ ok: true, ...summary });
  } catch (error) {
    const status = error.statusCode ?? 500;
    console.error("[nurture-cron] Failed:", error.message);
    return res.status(status).json({
      ok: false,
      error: error.message,
    });
  }
}

async function handleWarmLeadNurtureCron(req, res) {
  try {
    verifyCronSecret(req);
    const summary = await processWarmLeadNurture();
    return res.json({ ok: true, ...summary });
  } catch (error) {
    const status = error.statusCode ?? 500;
    console.error("[warm-lead-nurture-cron] Failed:", error.message);
    return res.status(status).json({
      ok: false,
      error: error.message,
    });
  }
}

app.post("/api/cron/process-nurture", handleNurtureCron);
app.post("/api/cron/process-nurture-emails", handleNurtureCron);
app.post("/api/cron/warm-leads-nurture", handleWarmLeadNurtureCron);

registerAdminRoutes(app, { verifyCronSecret });

app.post("/api/audit", async (req, res) => {
  const { websiteUrl, generatePdf } = req.body ?? {};

  try {
    const normalizedUrl = normalizeWebsiteUrl(websiteUrl);
    const scraped = await scrapeWebsiteText(normalizedUrl);
    const report = await runSiteAudit(scraped);

    const payload = {
      ok: true,
      websiteUrl: normalizedUrl,
      scrapedMeta: {
        title: scraped.title,
        metaDescription: scraped.metaDescription,
        viewportMeta: scraped.viewportMeta,
        charCount: scraped.charCount,
        technical: scraped.technical,
      },
      report,
    };

    if (generatePdf) {
      const pdfBuffer = await generateAuditPDF(report, normalizedUrl);
      payload.pdfBase64 = pdfBuffer.toString("base64");
    }

    res.json(payload);
  } catch (error) {
    return sendAuditError(res, error, "[audit]");
  }
});

// Standalone redesign mockup — separate follow-up step after the teardown audit.
async function handleRedesign(req, res, { websiteUrl, asHtml, generate, logPrefix }) {
  try {
    const normalizedUrl = normalizeWebsiteUrl(websiteUrl);

    console.log(`${logPrefix} Scraping [${normalizedUrl}]...`);
    const scraped = await scrapeWebsiteText(normalizedUrl);

    console.log(`${logPrefix} Generating redesign HTML...`);
    const html = await generate(scraped);
    console.log(`${logPrefix} Redesign ready (${html.length} chars)`);

    if (asHtml) {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      return res.send(html);
    }

    return res.json({ ok: true, websiteUrl: normalizedUrl, html });
  } catch (error) {
    return sendAuditError(res, error, logPrefix);
  }
}

function registerRedesignRoutes(path, generate, logPrefix) {
  // Pipeline use: POST JSON { websiteUrl } → { ok, websiteUrl, html }
  // (or raw text/html with format=html for Puppeteer's page.goto).
  app.post(path, (req, res) => {
    const { websiteUrl, format } = req.body ?? {};
    const asHtml = format === "html" || req.query.format === "html";
    return handleRedesign(req, res, { websiteUrl, asHtml, generate, logPrefix });
  });

  // Browser testing: http://localhost:4000{path}?url=example.com renders the
  // generated page directly. Add &format=json for the JSON payload.
  app.get(path, (req, res) => {
    const websiteUrl = req.query.url ?? req.query.websiteUrl;

    if (!websiteUrl) {
      return res.status(400).json({
        ok: false,
        error: `Pass a site to redesign, e.g. ${path}?url=example.com`,
        code: "INVALID_REQUEST",
      });
    }

    const asHtml = req.query.format !== "json";
    return handleRedesign(req, res, { websiteUrl, asHtml, generate, logPrefix });
  });
}

registerRedesignRoutes("/api/redesign", generateRedesignHtml, "[redesign]");
registerRedesignRoutes(
  "/api/redesign-claude",
  generateRedesignHtmlClaude,
  "[redesign-claude]"
);

const PREVIEW_TOKEN_RE = /^[a-z0-9-]{16,}$/i;

/** Best-effort display name from the prospect's domain, e.g. "liberty-roofing.com" → "Liberty Roofing". */
function companyNameFromUrl(websiteUrl) {
  try {
    const host = new URL(websiteUrl).hostname.replace(/^www\./i, "");
    const base = host.split(".")[0].replace(/[-_]+/g, " ").trim();
    if (!base) return null;
    return base.replace(/\b\w/g, (c) => c.toUpperCase());
  } catch {
    return null;
  }
}

function previewStatusPayload(redesign) {
  return {
    ok: true,
    ready: Boolean(redesign.html),
    failed: redesign.status === "failed",
    companyName: companyNameFromUrl(redesign.website_url),
  };
}

// Public preview of a stored redesign (prospect-facing, unguessable token).
// The usetoolcrate.com/preview/ page fetches this and renders it full-screen.
// Returns 202 + JSON while generation is still running so the preview page
// can show the animated wait screen instead.
app.get("/api/preview/:token", async (req, res) => {
  const token = String(req.params.token ?? "").trim();

  if (!PREVIEW_TOKEN_RE.test(token)) {
    return res.status(400).send("Invalid preview link.");
  }

  try {
    const redesign = await fetchRedesignByToken(token);

    if (!redesign) {
      return res.status(404).send("This preview link does not exist or has expired.");
    }

    if (!redesign.html) {
      return res.status(202).json(previewStatusPayload(redesign));
    }

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("X-Robots-Tag", "noindex, nofollow");
    return res.send(redesign.html);
  } catch (error) {
    console.error("[preview] Failed:", error.message);
    return res.status(500).send("Could not load this preview. Please try again.");
  }
});

// Polled by the wait screen every few seconds until generation finishes.
app.get("/api/preview-status", async (req, res) => {
  const token = String(req.query.t ?? "").trim();

  if (!PREVIEW_TOKEN_RE.test(token)) {
    return res.status(400).json({ ok: false, error: "Invalid preview link." });
  }

  try {
    const redesign = await fetchRedesignByToken(token);

    if (!redesign) {
      return res.status(404).json({ ok: false, error: "Preview not found." });
    }

    return res.json(previewStatusPayload(redesign));
  } catch (error) {
    console.error("[preview-status] Failed:", error.message);
    return res.status(500).json({ ok: false, error: "Could not check preview status." });
  }
});

// Public "/try" page: anyone can request a free redesign for their domain.
// One free design per domain — repeat submissions get the paywall splash.
const publicRedesignLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    ok: false,
    error:
      "Too many preview requests - please try again in an hour, or reply to your email and we'll sort you out.",
  },
});

// Local-testing helper: clears the caller's own IP from the public-redesign
// rate limiter. Same secret guard as the other /api/admin routes.
app.post("/api/admin/reset-rate-limit", (req, res) => {
  try {
    verifyCronSecret(req);
  } catch (error) {
    return res
      .status(error.statusCode ?? 500)
      .json({ ok: false, error: error.message });
  }

  // express-rate-limit v8 keys by ipKeyGenerator(req.ip) (IPv6 → /56 subnet),
  // so reset the derived key — resetting raw req.ip silently misses.
  publicRedesignLimiter.resetKey(ipKeyGenerator(req.ip));
  return res.json({ ok: true, message: `Rate limit cleared for ${req.ip}` });
});

app.post("/api/public-redesign", publicRedesignLimiter, async (req, res) => {
  const rootDomain = normalizeRootDomain(req.body?.url);
  const email = String(req.body?.email ?? "").trim().toLowerCase();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({
      ok: false,
      error: "Please enter a valid email address.",
    });
  }

  if (!rootDomain || !rootDomain.includes(".")) {
    return res.status(400).json({
      ok: false,
      error: "Please enter a valid website, e.g. yourbusiness.com",
    });
  }

  if (!isSupabaseConfigured()) {
    return res.status(503).json({
      ok: false,
      error: "Previews are temporarily unavailable. Please try again later.",
    });
  }

  const logPrefix = `[public-redesign:${rootDomain}]`;

  // Validates the domain and blocks private/loopback hosts.
  let websiteUrl;
  try {
    websiteUrl = normalizeWebsiteUrl(rootDomain);
  } catch (error) {
    return res.status(400).json({ ok: false, error: error.message });
  }

  try {
    const existing = await findLatestRedesignForDomain(rootDomain);
    if (existing) {
      // Someone may have submitted (or the admin ordered) without an email.
      if (!existing.email) {
        await setRedesignEmail(existing.id, email).catch((error) =>
          console.warn(`${logPrefix} Could not backfill email:`, error.message)
        );
      }
      console.log(`${logPrefix} Duplicate domain — returning existing preview.`);
      return res.json({
        ok: true,
        duplicate: true,
        status: "exists",
        token: existing.preview_token,
      });
    }

    const engine = resolveRedesignEngine(
      process.env.PUBLIC_REDESIGN_ENGINE || "claude-sonnet"
    );

    const pending = await insertPendingRedesign({
      websiteUrl,
      email,
      sourceType: "manual",
      sourceId: null,
      engine: engine.id,
      model: engine.model,
      maxTokens: DEFAULT_REDESIGN_MAX_TOKENS,
    });

    runRedesignGeneration({
      redesignId: pending.id,
      normalizedUrl: websiteUrl,
      engine,
      maxTokens: DEFAULT_REDESIGN_MAX_TOKENS,
      logPrefix: `${logPrefix}:${pending.id}`,
    });

    console.log(`${logPrefix} Queued generation (${engine.id}).`);
    return res.json({ ok: true, status: "generating", token: pending.preview_token });
  } catch (error) {
    console.error(`${logPrefix} Failed:`, error.message);
    const status = error.statusCode ?? 500;
    return res.status(status).json({
      ok: false,
      error:
        status < 500
          ? error.message
          : "Could not start your preview. Please try again in a minute.",
    });
  }
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Frontend origins allowed in Stripe success/cancel URLs. */
function siteOriginFromRequest(req) {
  const origin = req.headers.origin || "";
  if (
    /^http:\/\/localhost:\d+$/.test(origin) ||
    /^https:\/\/(www\.)?usetoolcrate\.com$/.test(origin)
  ) {
    return origin;
  }
  return "https://usetoolcrate.com";
}

// $9 "New Design Variation" checkout for the duplicate-domain paywall.
// Creates a Checkout Session with the domain/email in metadata; the /webhook
// handler picks up checkout.session.completed and queues the generation.
app.post("/api/variation-checkout", async (req, res) => {
  const rootDomain = normalizeRootDomain(req.body?.domain ?? req.body?.url);
  const email = String(req.body?.email ?? "").trim().toLowerCase();

  if (!rootDomain || !rootDomain.includes(".")) {
    return res.status(400).json({
      ok: false,
      error: "Please enter a valid website, e.g. yourbusiness.com",
    });
  }
  if (!EMAIL_RE.test(email)) {
    return res.status(400).json({ ok: false, error: "Please enter a valid email address." });
  }

  const priceId = process.env.STRIPE_VARIATION_PRICE_ID?.trim();
  if (!priceId) {
    console.error("[variation-checkout] STRIPE_VARIATION_PRICE_ID is not configured.");
    return res.status(503).json({
      ok: false,
      error: "Checkout is temporarily unavailable. Please try again later.",
    });
  }

  try {
    const stripe = getStripe();
    const origin = siteOriginFromRequest(req);

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: email,
      metadata: { type: "variation", domain: rootDomain, email },
      success_url: `${origin}/try/?variation=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/try/`,
    });

    return res.json({ ok: true, url: session.url });
  } catch (error) {
    console.error("[variation-checkout] Failed:", error.message);
    return res.status(500).json({
      ok: false,
      error: "Could not start checkout. Please try again in a minute.",
    });
  }
});

// Guards against Stripe redelivering the same completed session.
const processedVariationSessions = new Set();

/** checkout.session.completed with metadata.type === "variation" → queue a
 *  fresh generation; the design-ready Resend email fires on completion. */
function runVariationGenerationFromSession(session) {
  const logPrefix = `[variation:${session.id}]`;

  if (session.payment_status !== "paid") {
    console.warn(`${logPrefix} Session not paid (${session.payment_status}) — skipping.`);
    return;
  }
  if (processedVariationSessions.has(session.id)) {
    console.log(`${logPrefix} Already processed — skipping duplicate webhook.`);
    return;
  }
  processedVariationSessions.add(session.id);

  setImmediate(async () => {
    try {
      const rootDomain = normalizeRootDomain(session.metadata?.domain);
      const email =
        session.metadata?.email?.trim().toLowerCase() ||
        session.customer_details?.email?.trim().toLowerCase() ||
        null;

      if (!rootDomain) {
        console.error(`${logPrefix} No usable domain in session metadata.`);
        return;
      }

      const websiteUrl = normalizeWebsiteUrl(rootDomain);
      const engine = resolveRedesignEngine(
        process.env.PUBLIC_REDESIGN_ENGINE || "claude-sonnet"
      );

      const pending = await insertPendingRedesign({
        websiteUrl,
        email,
        sourceType: "manual",
        sourceId: null,
        engine: engine.id,
        model: engine.model,
        maxTokens: DEFAULT_REDESIGN_MAX_TOKENS,
      });

      console.log(`${logPrefix} Paid variation queued for ${rootDomain} (${pending.id}).`);

      runRedesignGeneration({
        redesignId: pending.id,
        normalizedUrl: websiteUrl,
        engine,
        maxTokens: DEFAULT_REDESIGN_MAX_TOKENS,
        logPrefix: `${logPrefix}:${pending.id}`,
      });
    } catch (error) {
      console.error(`${logPrefix} Failed to queue paid variation:`, error.message);
    }
  });
}

// Wait-screen question: "What's your biggest challenge right now?"
app.post("/api/preview-intent", async (req, res) => {
  const token = String(req.body?.token ?? "").trim();
  const intent = String(req.body?.intent ?? "").trim().slice(0, 200);

  if (!PREVIEW_TOKEN_RE.test(token)) {
    return res.status(400).json({ ok: false, error: "Invalid preview link." });
  }
  if (!intent) {
    return res.status(400).json({ ok: false, error: "intent is required." });
  }

  try {
    const updated = await saveRedesignLeadIntent(token, intent);

    if (!updated) {
      return res.status(404).json({ ok: false, error: "Preview not found." });
    }

    return res.json({ ok: true });
  } catch (error) {
    console.error("[preview-intent] Failed:", error.message);
    return res.status(500).json({ ok: false, error: "Could not save your answer." });
  }
});

app.use((err, req, res, next) => {
  if (req.path.startsWith("/api")) {
    return sendAuditError(res, err, "[api]");
  }
  next(err);
});

const server = app.listen(PORT);

server.on("listening", () => {
  console.log(`Audit API listening on http://localhost:${PORT}`);
});

server.on("error", (e) => {
  if (e.code === "EADDRINUSE") {
    console.error(`Port ${PORT} is already in use! The server failed to start.`);
    process.exit(1);
  } else {
    console.error("Server error:", e);
  }
});
