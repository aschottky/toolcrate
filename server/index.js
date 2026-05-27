import "./env.js";
import cors from "cors";
import express from "express";
import Stripe from "stripe";
import { runSiteAudit } from "./audit.js";
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
    console.log(`💰 Payment successful for: ${session.customer_details?.email}`);
  }

  res.json({ received: true });
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

app.post("/api/audit", async (req, res) => {
  const { websiteUrl } = req.body ?? {};

  try {
    const normalizedUrl = normalizeWebsiteUrl(websiteUrl);
    const scraped = await scrapeWebsiteText(normalizedUrl);
    const report = await runSiteAudit(scraped);

    res.json({
      ok: true,
      websiteUrl: normalizedUrl,
      scrapedMeta: {
        title: scraped.title,
        metaDescription: scraped.metaDescription,
        viewportMeta: scraped.viewportMeta,
        charCount: scraped.charCount,
      },
      report,
    });
  } catch (error) {
    const message = error?.message || "Audit failed.";
    const status =
      message.includes("required") ||
      message.includes("valid") ||
      message.includes("cannot be audited")
        ? 400
        : 500;

    console.error("[audit]", message, error);
    res.status(status).json({ ok: false, error: message });
  }
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
