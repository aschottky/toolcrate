import "./env.js";
import cors from "cors";
import express from "express";
import { runSiteAudit } from "./audit.js";
import { normalizeWebsiteUrl, scrapeWebsiteText } from "./scrape.js";

const app = express();
const PORT = Number(process.env.PORT) || 3001;

app.use(cors({ origin: true }));
app.use(express.json({ limit: "32kb" }));

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    service: "toolcrate-audit-api",
    openaiConfigured: Boolean(process.env.OPENAI_API_KEY),
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

app.listen(PORT, () => {
  console.log(`Audit API listening on http://localhost:${PORT}`);
});
