import "./env.js";
import cors from "cors";
import express from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { runSiteAudit } from "./audit.js";
import { buildAuditPdf } from "./audit-pipeline.js";
import { sendAuditReportEmail, sendNewLeadReviewNotification, sendSubmissionConfirmationEmail, sendWelcomeEmail, normalizeProspectFirstName, getResend } from "./email.js";
import { generateAuditPDF } from "./pdf.js";
import { sendAuditError, sendRedesignError } from "./errors.js";
import { handleInstantlyWebhook } from "./instantly-webhook.js";
import { normalizeWebsiteUrl, scrapeWebsiteText } from "./scrape.js";
import { evaluateLeadSuitability, preflightLogCode } from "./preflight.js";
import { generateRedesignHtml } from "./redesign-claude.js";
import { registerAdminRoutes, runPreviewGeneration } from "./admin.js";
import { registerCheckoutRoutes } from "./checkout.js";
import {
  assertStripeKeyMatchesSession,
  getStripeForSessionId,
  getStripeForStandardCheckout,
  getStripeLiveSecretKey,
  getStripeMode,
  getStripeSecretKeyForSessionId,
  getStripeTestSecretKey,
} from "./stripe-keys.js";
import {
  DEFAULT_REDESIGN_MAX_TOKENS,
  resolveRedesignEngine,
} from "./redesign-engines.js";
import { DEFAULT_PUBLIC_REDESIGN_ENGINE } from "./anthropic-models.js";
import { sanitizeRoastBulletList } from "../scripts/roast-bullet-sanitize.js";
import { normalizeRootDomain } from "./url-utils.js";
import {
  buildBlueprintScrapedData,
  buildBlueprintWebsiteUrl,
  buildBlueprintLeadIntent,
  BLUEPRINT_LEAD_SITE_AUDIT,
  BLUEPRINT_LEAD_VISION,
  inferBlueprintLeadType,
  isBlueprintBuild,
  normalizeBlueprintRequest,
  parseBlueprintLeadIntent,
  parseBlueprintWebsiteUrl,
} from "./blueprint.js";
import { processNurtureEmails } from "./nurture.js";
import { processWarmLeadNurture } from "./warm-lead-nurture.js";
import {
  fetchRedesignByToken,
  findAuditByStripeSessionId,
  findLatestRedesignForDomain,
  fetchPreviousDesignExclusions,
  insertPendingRedesign,
  insertPendingReview,
  setRedesignEmail,
  setRedesignFirstName,
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

const processedTierPurchases = new Set();

function runWelcomeEmailFromSession(session) {
  const tier = session.metadata?.tier;
  const logPrefix = `[webhook:${session.id}]`;

  if (processedTierPurchases.has(session.id)) {
    console.log(`${logPrefix} Welcome email already sent — skipping duplicate.`);
    return;
  }
  processedTierPurchases.add(session.id);

  setImmediate(async () => {
    try {
      const customerEmail = session.customer_details?.email?.trim();
      if (!customerEmail) {
        console.warn(`${logPrefix} No customer email — skipping welcome email.`);
        return;
      }

      const customerName = session.customer_details?.name?.trim() || null;
      console.log(`💳 New ${tier} purchase from ${customerEmail}`);
      const result = await sendWelcomeEmail(customerEmail, customerName, tier);
      console.log(`${logPrefix} Welcome email sent (${result?.id ?? "ok"}).`);
    } catch (err) {
      console.error(`${logPrefix} Welcome email failed:`, err.message);
    }
  });
}

app.use(cors({ origin: true }));

const stripeWebhookRaw = express.raw({ type: "application/json" });

// Stripe webhook (must be BEFORE express.json)
function handleStripeWebhook(req, res) {
  console.log("🔔 Stripe webhook hit");
  const sig = req.headers["stripe-signature"];
  let event;

  try {
    const stripe = getStripeForStandardCheckout();
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
    console.log("✅ Stripe signature verified");
  } catch (err) {
    console.error("❌ Stripe webhook signature error:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type !== "checkout.session.completed") {
    return res.status(200).json({ received: true });
  }

  const session = event.data.object;
  console.log(
    `💰 checkout.session.completed: ${session.customer_details?.email ?? "(no email)"}`
  );

  // $9 "New Design Variation" (duplicate-domain paywall on /try).
  if (session.metadata?.type === "variation") {
    res.status(200).json({ received: true });
    runVariationGenerationFromSession(session);
    return;
  }

  if (
    session.metadata?.tier === "full-build" ||
    session.metadata?.tier === "conversion-os"
  ) {
    res.status(200).json({ received: true });
    runWelcomeEmailFromSession(session);
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
  return res.status(200).json({ received: true });
}

app.post("/api/webhook/stripe", stripeWebhookRaw, handleStripeWebhook);
// Legacy path — keep until Stripe Dashboard endpoint is updated
app.post("/webhook", stripeWebhookRaw, handleStripeWebhook);

app.use(express.json({ limit: "32kb" }));

app.post("/api/apply", async (req, res) => {
  const { name, website, businessType, frustration, timeline } = req.body ?? {};

  const trimmedName = String(name ?? "").trim();
  const trimmedWebsite = String(website ?? "").trim();
  const trimmedBusinessType = String(businessType ?? "").trim();
  const trimmedFrustration = String(frustration ?? "").trim();
  const trimmedTimeline = String(timeline ?? "").trim();

  if (!trimmedName || !trimmedBusinessType || !trimmedFrustration) {
    return res.status(400).json({
      error: "name, businessType, and frustration are required.",
    });
  }

  let normalizedWebsite = trimmedWebsite;
  if (trimmedWebsite) {
    try {
      normalizedWebsite = normalizeWebsiteUrl(trimmedWebsite);
    } catch {
      return res.status(400).json({
        error: "Please enter a valid website URL.",
      });
    }
  }

  const escapeHtml = (value) =>
    String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111;">
      <h2 style="margin: 0 0 16px;">New Founding Member Application</h2>
      <table style="border-collapse: collapse; width: 100%; max-width: 560px;">
        <tr>
          <td style="padding: 8px 0; font-weight: 600; vertical-align: top;">Full Name</td>
          <td style="padding: 8px 0;">${escapeHtml(trimmedName)}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; font-weight: 600; vertical-align: top;">Business Website</td>
          <td style="padding: 8px 0;">${escapeHtml(normalizedWebsite || "—")}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; font-weight: 600; vertical-align: top;">Business Type</td>
          <td style="padding: 8px 0;">${escapeHtml(trimmedBusinessType)}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; font-weight: 600; vertical-align: top;">Biggest Frustration</td>
          <td style="padding: 8px 0;">${escapeHtml(trimmedFrustration).replace(/\n/g, "<br>")}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; font-weight: 600; vertical-align: top;">Timeline</td>
          <td style="padding: 8px 0;">${escapeHtml(trimmedTimeline || "—")}</td>
        </tr>
      </table>
      <p style="margin: 24px 0 0; color: #555;">Follow up manually using the business website above.</p>
    </div>
  `.trim();

  try {
    const resend = getResend();
    const { error } = await resend.emails.send({
      from: "ToolCrate <onboarding@usetoolcrate.com>",
      to: "alexander@usetoolcrate.com",
      subject: `New Founding Member Application - ${trimmedName}`,
      html,
    });

    if (error) {
      console.error("[apply] Resend error:", error);
      return res.status(500).json({ error: "Failed to send application." });
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error("[apply]", err.message);
    return res.status(500).json({ error: "Failed to send application." });
  }
});

app.post("/api/intake", async (req, res) => {
  const {
    name,
    businessName,
    website,
    description,
    idealCustomer,
    primaryGoal,
    frustration,
    hasLogo,
    additionalNotes,
  } = req.body ?? {};

  const trimmedName = String(name ?? "").trim();
  const trimmedBusinessName = String(businessName ?? "").trim();
  const trimmedWebsite = String(website ?? "").trim();
  const trimmedDescription = String(description ?? "").trim();
  const trimmedIdealCustomer = String(idealCustomer ?? "").trim();
  const trimmedPrimaryGoal = String(primaryGoal ?? "").trim();
  const trimmedFrustration = String(frustration ?? "").trim();
  const trimmedHasLogo = String(hasLogo ?? "").trim();
  const trimmedAdditionalNotes = String(additionalNotes ?? "").trim();

  if (
    !trimmedName ||
    !trimmedBusinessName ||
    !trimmedWebsite ||
    !trimmedDescription ||
    !trimmedFrustration
  ) {
    return res.status(400).json({
      error: "name, businessName, website, description, and frustration are required.",
    });
  }

  let normalizedWebsite = trimmedWebsite;
  try {
    normalizedWebsite = normalizeWebsiteUrl(trimmedWebsite);
  } catch {
    return res.status(400).json({
      error: "Please enter a valid website URL.",
    });
  }

  const escapeHtml = (value) =>
    String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  const formatMultiline = (value) =>
    escapeHtml(value || "—").replace(/\n/g, "<br>");

  const rows = [
    ["Your Name", trimmedName],
    ["Business Name", trimmedBusinessName],
    ["Website URL", normalizedWebsite],
    ["What the business does", trimmedDescription],
    ["Ideal customer", trimmedIdealCustomer || "—"],
    ["Primary site goal", trimmedPrimaryGoal || "—"],
    ["#1 frustration", trimmedFrustration],
    ["Logo status", trimmedHasLogo || "—"],
    ["Additional notes", trimmedAdditionalNotes || "—"],
  ];

  const tableRows = rows
    .map(
      ([label, value]) => `
        <tr>
          <td style="padding: 10px 16px 10px 0; font-weight: 600; vertical-align: top; width: 38%; color: #374151; border-bottom: 1px solid #e5e7eb;">${escapeHtml(label)}</td>
          <td style="padding: 10px 0; vertical-align: top; color: #111827; border-bottom: 1px solid #e5e7eb;">${formatMultiline(value)}</td>
        </tr>`
    )
    .join("");

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111;">
      <h2 style="margin: 0 0 16px;">New Client Intake — ${escapeHtml(trimmedBusinessName)}</h2>
      <table style="border-collapse: collapse; width: 100%; max-width: 640px;">
        ${tableRows}
      </table>
    </div>
  `.trim();

  try {
    const resend = getResend();
    const { error } = await resend.emails.send({
      from: "ToolCrate <onboarding@usetoolcrate.com>",
      to: "alexander@usetoolcrate.com",
      subject: `New Client Intake - ${trimmedBusinessName} (${trimmedName})`,
      html,
    });

    if (error) {
      console.error("[intake] Resend error:", error);
      return res.status(500).json({ error: "Failed to send intake form." });
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error("[intake]", err.message);
    return res.status(500).json({ error: "Failed to send intake form." });
  }
});

app.post("/api/webhooks/instantly", handleInstantlyWebhook);

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    service: "toolcrate-audit-api",
    openaiConfigured: Boolean(process.env.OPENAI_API_KEY),
    stripeConfigured: Boolean(getStripeLiveSecretKey() || getStripeTestSecretKey()),
    stripeMode: getStripeMode(),
    stripeLiveConfigured: Boolean(getStripeLiveSecretKey()),
    stripeTestConfigured: Boolean(getStripeTestSecretKey()),
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
    const secretKey = getStripeSecretKeyForSessionId(sessionId);
    assertStripeKeyMatchesSession(sessionId, secretKey);
    const stripe = getStripeForSessionId(sessionId);
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
registerCheckoutRoutes(app, { siteOriginFromRequest });

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
async function handleRedesign(req, res, { websiteUrl, asHtml, generate, logPrefix, body }) {
  const blueprintRequest = normalizeBlueprintRequest(body ?? {});

  if (blueprintRequest.isBlueprint) {
    if (blueprintRequest.error) {
      return res.status(400).json({
        ok: false,
        error: blueprintRequest.error,
        code: "INVALID_REQUEST",
      });
    }

    try {
      const { companyName, serviceType, location } = blueprintRequest.blueprint;
      const scraped = buildBlueprintScrapedData(blueprintRequest.blueprint);

      console.log(
        `${logPrefix} Blueprint mode (isBlueprint=true) — skipping scrape for "${companyName}"`
      );

      const result = await generate(scraped, { isBlueprint: true });
      console.log(`${logPrefix} Blueprint redesign ready (${result.html.length} chars)`);

      if (asHtml) {
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        return res.send(result.html);
      }

      return res.json({
        ok: true,
        isBlueprint: true,
        build_mode: "NEW_SITE_BUILD",
        companyName,
        serviceType,
        location,
        html: result.html,
        styleDirection: result.styleDirection,
        heroHeadline: result.heroHeadline,
        primaryAccentColor: result.primaryAccentColor,
      });
    } catch (error) {
      return sendRedesignError(res, error, logPrefix);
    }
  }

  if (!websiteUrl) {
    return res.status(400).json({
      ok: false,
      error:
        "Pass websiteUrl, or blueprint fields: companyName, serviceType, and location (no url).",
      code: "INVALID_REQUEST",
    });
  }

  try {
    const normalizedUrl = normalizeWebsiteUrl(websiteUrl);

    console.log(`${logPrefix} Scraping [${normalizedUrl}]...`);
    const scraped = await scrapeWebsiteText(normalizedUrl);

    const preflight = await evaluateLeadSuitability(scraped.textForAudit, normalizedUrl);
    if (!preflight.suitable) {
      const logCode = preflight.logCode ?? preflightLogCode(preflight);
      console.warn(
        `${logPrefix} [preflight] ${logCode}: ${preflight.reason}${preflight.pageCount != null ? ` (${preflight.pageCount} pages)` : ""}`
      );
      return res.status(422).json({
        ok: false,
        error: "This site is not eligible for an automated redesign preview.",
        code: "PREFLIGHT_REJECTED",
        reason: preflight.reason,
        pageCount: preflight.pageCount ?? null,
      });
    }

    console.log(`${logPrefix} Generating redesign HTML...`);
    const generationExclusions = await fetchPreviousDesignExclusions(normalizedUrl);
    const result = await generate(scraped, {
      websiteUrl: normalizedUrl,
      generationExclusions,
    });
    console.log(`${logPrefix} Redesign ready (${result.html.length} chars)`);

    if (asHtml) {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      return res.send(result.html);
    }

    return res.json({
      ok: true,
      websiteUrl: normalizedUrl,
      html: result.html,
      styleDirection: result.styleDirection,
      heroHeadline: result.heroHeadline,
      primaryAccentColor: result.primaryAccentColor,
    });
  } catch (error) {
    if (error?.code === "PREFLIGHT_REJECTED") {
      return res.status(422).json({
        ok: false,
        error: "This site is not eligible for an automated redesign preview.",
        code: "PREFLIGHT_REJECTED",
        reason: error.preflight?.reason ?? error.message,
        pageCount: error.preflight?.pageCount ?? null,
      });
    }
    return sendRedesignError(res, error, logPrefix);
  }
}

function registerRedesignRoutes(path, generate, logPrefix) {
  // Pipeline use: POST JSON { websiteUrl } → { ok, websiteUrl, html }
  // Blueprint: POST JSON { companyName, serviceType, location } (no url) → same engine, skip scrape.
  // (or raw text/html with format=html for Puppeteer's page.goto).
  app.post(path, (req, res) => {
    const { websiteUrl, format } = req.body ?? {};
    const asHtml = format === "html" || req.query.format === "html";
    return handleRedesign(req, res, {
      websiteUrl,
      asHtml,
      generate,
      logPrefix,
      body: req.body ?? {},
    });
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
// Legacy alias — same Claude Sonnet engine as /api/redesign
registerRedesignRoutes(
  "/api/redesign-claude",
  generateRedesignHtml,
  "[redesign]"
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

function parseRoastBulletsFromDb(raw) {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
  return null;
}

function roastBulletTexts(raw) {
  const parsed = parseRoastBulletsFromDb(raw);
  if (!parsed?.length) return null;
  const sanitized = sanitizeRoastBulletList(parsed, 6);
  return sanitized.length ? sanitized : null;
}

function previewSessionStatus(redesign) {
  const texts = roastBulletTexts(redesign.roast_bullets);
  const roastDone =
    redesign.roast_status === "roast_ready" || redesign.roast_status === "ready";

  if (redesign.status === "failed") {
    if (texts?.length && roastDone) {
      return "redesign_failed";
    }
    return "failed";
  }

  if (redesign.html) return "ready";

  if (texts?.length && roastDone) {
    return "roast_ready";
  }

  return "pending";
}

function previewStatusPayload(redesign) {
  const status = previewSessionStatus(redesign);
  const roast_status = redesign.roast_status ?? "pending";
  const redesign_status = redesign.status ?? (redesign.html ? "ready" : "pending");
  const blueprint = isBlueprintBuild(redesign.website_url)
    ? parseBlueprintWebsiteUrl(redesign.website_url)
    : null;

  const payload = {
    status,
    roast_status,
    redesign_status,
  };

  if (status !== "ready" && status !== "failed" && status !== "redesign_failed") {
    payload.status_label = blueprint ? "Blueprint in Progress" : "Review in Progress";
  }

  if (redesign.email) {
    payload.email = redesign.email;
  }
  if (redesign.website_url) {
    payload.website_url = redesign.website_url;
  }

  if (blueprint) {
    payload.build_mode = blueprint.buildMode;
    payload.company_name = blueprint.companyName;
    payload.service_type = blueprint.serviceType;
    payload.location = blueprint.location;
    payload.has_existing_site = false;
  }

  const leadType = inferBlueprintLeadType({
    websiteUrl: redesign.website_url,
    leadIntent: redesign.lead_intent,
  });
  if (leadType === BLUEPRINT_LEAD_SITE_AUDIT) {
    payload.has_existing_site = true;
    payload.blueprint_lead_type = "Site Audit";
    if (status !== "ready" && status !== "failed" && status !== "redesign_failed") {
      payload.status_label = "Site Audit in Progress";
    }
    const parsedIntent = parseBlueprintLeadIntent(redesign.lead_intent);
    if (parsedIntent?.companyName) payload.company_name = parsedIntent.companyName;
  } else if (leadType === BLUEPRINT_LEAD_VISION) {
    payload.has_existing_site = false;
    payload.blueprint_lead_type = "Vision Concept";
    if (status !== "ready" && status !== "failed" && status !== "redesign_failed") {
      payload.status_label = "Blueprint in Progress";
    }
  }

  if (status === "roast_ready" || status === "ready") {
    const roast_bullets = roastBulletTexts(redesign.roast_bullets);
    if (roast_bullets?.length) {
      payload.roast_bullets = roast_bullets;
    }
  }

  return payload;
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
  const blueprintRequest = normalizeBlueprintRequest(req.body ?? {});

  if (blueprintRequest.isBlueprint) {
    if (blueprintRequest.error) {
      return res.status(400).json({ ok: false, error: blueprintRequest.error });
    }

    if (!isSupabaseConfigured()) {
      return res.status(503).json({
        ok: false,
        error: "Previews are temporarily unavailable. Please try again later.",
      });
    }

    const { companyName, serviceType, location } = blueprintRequest.blueprint ?? blueprintRequest.existingSite ?? {};
    const logPrefix = `[public-redesign:blueprint:${companyName.slice(0, 24)}]`;

    try {
      const engine = resolveRedesignEngine(
        process.env.PUBLIC_REDESIGN_ENGINE || DEFAULT_PUBLIC_REDESIGN_ENGINE
      );

      if (blueprintRequest.hasExistingSite) {
        const { websiteUrl, primaryChange } = blueprintRequest.existingSite;
        let normalizedUrl;
        try {
          normalizedUrl = normalizeWebsiteUrl(normalizeRootDomain(websiteUrl));
        } catch (error) {
          return res.status(400).json({ ok: false, error: error.message });
        }

        const leadIntent = buildBlueprintLeadIntent({
          type: BLUEPRINT_LEAD_SITE_AUDIT,
          companyName,
          serviceType,
          location,
          primaryChange,
        });

        const pending = await insertPendingRedesign({
          websiteUrl: normalizedUrl,
          email: null,
          firstName: null,
          sourceType: "manual",
          sourceId: null,
          engine: engine.id,
          model: engine.model,
          maxTokens: DEFAULT_REDESIGN_MAX_TOKENS,
          leadIntent,
        });

        console.log(`${logPrefix} Site-audit blueprint lead captured for ${normalizedUrl}.`);
        return res.json({
          ok: true,
          status: "processing",
          token: pending.preview_token,
          has_existing_site: true,
          company_name: companyName,
          service_type: serviceType,
          location,
        });
      }

      const { businessGoals, referenceLinks } = blueprintRequest.blueprint;
      const websiteUrl = buildBlueprintWebsiteUrl(blueprintRequest.blueprint);
      const leadIntent = buildBlueprintLeadIntent({
        type: BLUEPRINT_LEAD_VISION,
        companyName,
        serviceType,
        location,
        businessGoals,
        referenceLinks,
      });

      const pending = await insertPendingRedesign({
        websiteUrl,
        email: null,
        firstName: null,
        sourceType: "manual",
        sourceId: null,
        engine: engine.id,
        model: engine.model,
        maxTokens: DEFAULT_REDESIGN_MAX_TOKENS,
        leadIntent,
      });

      console.log(`${logPrefix} Vision-concept blueprint lead captured (no auto-generation).`);
      return res.json({
        ok: true,
        status: "processing",
        token: pending.preview_token,
        build_mode: "NEW_SITE_BUILD",
        has_existing_site: false,
        company_name: companyName,
        service_type: serviceType,
        location,
      });
    } catch (error) {
      console.error(`${logPrefix} Failed:`, error.message);
      const status = error.statusCode ?? 500;
      return res.status(status).json({
        ok: false,
        error:
          status < 500
            ? error.message
            : "Could not start your blueprint. Please try again in a minute.",
      });
    }
  }

  const rootDomain = normalizeRootDomain(req.body?.url);
  const emailRaw = String(req.body?.email ?? "").trim().toLowerCase();
  const firstName = normalizeProspectFirstName(req.body?.first_name);
  let email = null;
  if (emailRaw) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw)) {
      return res.status(400).json({
        ok: false,
        error: "Please enter a valid email address.",
      });
    }
    email = emailRaw;
  }

  if (!rootDomain || !rootDomain.includes(".")) {
    return res.status(400).json({
      ok: false,
      error: "Please enter a valid website, e.g. yourbusiness.com",
    });
  }

  if (email && !firstName) {
    return res.status(400).json({
      ok: false,
      error: "Please enter your first name.",
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
      const emailWasMissing = !existing.email;
      // Someone may have submitted (or the admin ordered) without an email.
      if (emailWasMissing && email) {
        await setRedesignEmail(existing.id, email).catch((error) =>
          console.warn(`${logPrefix} Could not backfill email:`, error.message)
        );
      }
      if (firstName) {
        await setRedesignFirstName(existing.id, firstName).catch((error) =>
          console.warn(`${logPrefix} Could not backfill first name:`, error.message)
        );
      }
      if (emailWasMissing && email) {
        const reviewUrl = `https://usetoolcrate.com/preview-view/?t=${encodeURIComponent(existing.preview_token)}`;
        insertPendingReview({
          redesignId: existing.id,
          websiteUrl: existing.website_url ?? websiteUrl,
          leadEmail: email,
          previewToken: existing.preview_token,
        }).catch((error) =>
          console.warn(`${logPrefix} Pending review insert failed:`, error.message)
        );
        sendNewLeadReviewNotification({
          businessUrl: existing.website_url ?? websiteUrl,
          userEmail: email,
          userName: firstName,
          reviewUrl,
        }).catch((error) =>
          console.warn(`${logPrefix} New-lead notification failed:`, error.message)
        );
      }
      console.log(`${logPrefix} Duplicate domain — already in queue.`);
      return res.json({
        ok: true,
        duplicate: true,
        status: "exists",
        token: existing.preview_token,
        ready: existing.status === "ready",
        url: rootDomain,
      });
    }

    const engine = resolveRedesignEngine(
      process.env.PUBLIC_REDESIGN_ENGINE || DEFAULT_PUBLIC_REDESIGN_ENGINE
    );

    const pending = await insertPendingRedesign({
      websiteUrl,
      email,
      firstName,
      sourceType: "manual",
      sourceId: null,
      engine: engine.id,
      model: engine.model,
      maxTokens: DEFAULT_REDESIGN_MAX_TOKENS,
    });

    if (email) {
      const reviewUrl = `https://usetoolcrate.com/preview-view/?t=${encodeURIComponent(pending.preview_token)}`;

      insertPendingReview({
        redesignId: pending.id,
        websiteUrl,
        leadEmail: email,
        previewToken: pending.preview_token,
      }).catch((error) =>
        console.warn(`${logPrefix} Pending review insert failed:`, error.message)
      );

      sendNewLeadReviewNotification({
        businessUrl: websiteUrl,
        userEmail: email,
        userName: firstName,
        reviewUrl,
      }).catch((error) =>
        console.warn(`${logPrefix} New-lead notification failed:`, error.message)
      );

      console.log(`${logPrefix} Lead captured with email (no auto-generation).`);
      return res.json({ ok: true, status: "received", token: pending.preview_token });
    }

    console.log(`${logPrefix} Lead captured — contact pending (no auto-generation).`);
    return res.json({
      ok: true,
      status: "processing",
      token: pending.preview_token,
      url: rootDomain,
    });
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

app.post("/api/public-redesign/contact", publicRedesignLimiter, async (req, res) => {
  const token = String(req.body?.token ?? "").trim();
  const emailRaw = String(req.body?.email ?? "").trim().toLowerCase();
  const firstName = normalizeProspectFirstName(req.body?.first_name);

  if (!PREVIEW_TOKEN_RE.test(token)) {
    return res.status(400).json({ ok: false, error: "Invalid preview session." });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw)) {
    return res.status(400).json({
      ok: false,
      error: "Please enter a valid email address.",
    });
  }

  if (!isSupabaseConfigured()) {
    return res.status(503).json({
      ok: false,
      error: "Previews are temporarily unavailable. Please try again later.",
    });
  }

  try {
    const redesign = await fetchRedesignByToken(token);
    if (!redesign) {
      return res.status(404).json({ ok: false, error: "Preview session not found." });
    }

    const logPrefix = `[public-redesign-contact:${token.slice(0, 8)}]`;

    if (!redesign.email) {
      await setRedesignEmail(redesign.id, emailRaw);
    }
    if (firstName) {
      await setRedesignFirstName(redesign.id, firstName).catch((error) =>
        console.warn(`${logPrefix} Could not set first name:`, error.message)
      );
    }

    const reviewUrl = `https://usetoolcrate.com/preview-view/?t=${encodeURIComponent(token)}`;

    insertPendingReview({
      redesignId: redesign.id,
      websiteUrl: redesign.website_url,
      leadEmail: emailRaw,
      previewToken: token,
    }).catch((error) =>
      console.warn(`${logPrefix} Pending review insert failed:`, error.message)
    );

    sendNewLeadReviewNotification({
      businessUrl: redesign.website_url,
      userEmail: emailRaw,
      userName: firstName,
      reviewUrl,
      blueprintLeadType: inferBlueprintLeadType({
        websiteUrl: redesign.website_url,
        leadIntent: redesign.lead_intent,
      }),
    }).catch((error) =>
      console.warn(`${logPrefix} New-lead notification failed:`, error.message)
    );

    const blueprintMeta = parseBlueprintWebsiteUrl(redesign.website_url);
    sendSubmissionConfirmationEmail({
      customerEmail: emailRaw,
      firstName,
      isBlueprint: Boolean(blueprintMeta),
      companyName: blueprintMeta?.companyName,
      websiteUrl: blueprintMeta ? null : redesign.website_url,
    }).catch((error) =>
      console.warn(`${logPrefix} Submission confirmation email failed:`, error.message)
    );

    console.log(`${logPrefix} Contact captured for ${redesign.website_url}.`);
    return res.json({ ok: true, status: "received", token });
  } catch (error) {
    console.error("[public-redesign/contact] Failed:", error.message);
    return res.status(500).json({
      ok: false,
      error: "Could not save your contact details. Please try again.",
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
    const stripe = getStripeForStandardCheckout();
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
        process.env.PUBLIC_REDESIGN_ENGINE || DEFAULT_PUBLIC_REDESIGN_ENGINE
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

      runPreviewGeneration({
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
