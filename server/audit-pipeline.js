import { runSiteAudit } from "./audit.js";
import { generateAuditPDF } from "./pdf.js";
import { normalizeWebsiteUrl, scrapeWebsiteText } from "./scrape.js";

/**
 * Scrape → AI audit → PDFKit buffer (same pipeline as paid Stripe buyers).
 */
export async function buildAuditPdf(websiteUrl, logPrefix = "[audit]") {
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
