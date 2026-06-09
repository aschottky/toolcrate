import "./env.js";
import cors from "cors";
import express from "express";
import Stripe from "stripe";
import { runSiteAudit } from "./audit.js";
import { buildAuditPdf } from "./audit-pipeline.js";
import { sendAuditReportEmail } from "./email.js";
import { generateAuditPDF } from "./pdf.js";
import { sendAuditError } from "./errors.js";
import { handleInstantlyWebhook } from "./instantly-webhook.js";
import { normalizeWebsiteUrl, scrapeWebsiteText } from "./scrape.js";
import { registerAdminRoutes } from "./admin.js";
import { processNurtureEmails } from "./nurture.js";
import { processWarmLeadNurture } from "./warm-lead-nurture.js";
import {
  findAuditByStripeSessionId,
  isSupabaseConfigured,
  markInitialEmailSent,
  saveAuditRecord,
} from "./supabase.js";

const app = express();
const PORT = Number(process.env.PORT) || 4000;

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
