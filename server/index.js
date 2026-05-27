import "./env.js";
import cors from "cors";
import express from "express";
import Stripe from "stripe";
import { runSiteAudit } from "./audit.js";
import { sendAuditReportEmail } from "./email.js";
import { generateAuditPDF } from "./pdf.js";
import { sendAuditError } from "./errors.js";
import { normalizeWebsiteUrl, scrapeWebsiteText } from "./scrape.js";

const app = express();
const PORT = Number(process.env.PORT) || 4000;

let stripeClient;

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

async function buildAuditPdf(websiteUrl, logPrefix) {
  try {
    console.log(`${logPrefix} Normalizing URL: ${websiteUrl}`);
    const normalizedUrl = normalizeWebsiteUrl(websiteUrl);

    console.log(`${logPrefix} Scraping [${normalizedUrl}]...`);
    const scraped = await scrapeWebsiteText(normalizedUrl);

    console.log(`${logPrefix} Running AI...`);
    const report = await runSiteAudit(scraped);

    console.log(`${logPrefix} Generating PDF...`);
    const pdfBuffer = await generateAuditPDF(report, normalizedUrl);

    console.log(`${logPrefix} PDF ready (${pdfBuffer.length} bytes)`);
    return { pdfBuffer, normalizedUrl, report };
  } catch (error) {
    console.error(`${logPrefix} Pipeline error:`, error?.message, error);
    throw error;
  }
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
  const logPrefix = `[audit:${sessionId ?? "unknown"}]`;

  setImmediate(async () => {
    try {
      console.log(`${logPrefix} Normalizing URL: ${websiteUrl}`);
      const normalizedUrl = normalizeWebsiteUrl(websiteUrl);

      console.log(`${logPrefix} Scraping [${normalizedUrl}]...`);
      const scraped = await scrapeWebsiteText(normalizedUrl);

      console.log(`${logPrefix} Running AI...`);
      const report = await runSiteAudit(scraped);

      console.log(`${logPrefix} Audit Complete.`, {
        url: normalizedUrl,
        seo: report.seo?.score,
        leadCapture: report.leadCapture?.score,
        mobile: report.mobile?.score,
        trust: report.trust?.score,
        messaging: report.messaging?.score,
        performance: report.performance?.score,
        security: report.security?.score,
      });

      console.log(`${logPrefix} Generating PDF...`);
      const pdfBuffer = await generateAuditPDF(report, normalizedUrl);

      if (!customerEmail) {
        console.warn(`${logPrefix} No customer email — skipping send.`);
        return;
      }

      console.log(`${logPrefix} Sending Email to ${customerEmail}...`);
      await sendAuditReportEmail(customerEmail, normalizedUrl, pdfBuffer);

      console.log(`${logPrefix} Delivery Complete!`);
    } catch (err) {
      console.error(`${logPrefix} Audit failed:`, err.message);
      console.error(err);
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

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    service: "toolcrate-audit-api",
    openaiConfigured: Boolean(process.env.OPENAI_API_KEY),
    stripeConfigured: Boolean(process.env.STRIPE_SECRET_KEY),
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

    const { pdfBuffer } = await buildAuditPdf(websiteUrl, logPrefix);
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
