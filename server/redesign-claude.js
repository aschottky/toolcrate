import Anthropic from "@anthropic-ai/sdk";
import {
  buildUserMessage,
  filterLoadableImageUrls,
  sanitizeHtmlOutput,
  validateRedesignHtml,
} from "./redesign.js";

let anthropicClient;

function getAnthropic() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not configured on the server.");
  }
  if (!anthropicClient) {
    anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return anthropicClient;
}

const CLAUDE_REDESIGN_SYSTEM_PROMPT = `You are a world-class conversion-focused web designer. You will receive scraped data from a local contractor's current website. Generate a SINGLE complete HTML file that looks like it was built by a $15,000/mo agency - something that would make the business owner's jaw drop when they see it compared to their current site.

Use their real company name, phone, location, services, colors, and any image URLs found in the scraped data. Make it stunning, unique, and conversion-focused.

TECHNICAL RULES:
- All CSS in a style tag, Google Fonts via @import, no external frameworks
- Looks great at 1280px wide - will be screenshotted by Puppeteer
- Output ONLY raw HTML, no explanation, no markdown fences`;

const MAX_ATTEMPTS = 2;

/**
 * Claude-powered copy of generateRedesignHtml() — same scrape input, same
 * sanitize/validate pipeline, Anthropic instead of OpenAI.
 *
 * @param {{ textForAudit: string, imageUrls?: string[] }} scraped — output of scrapeWebsiteText()
 * @returns {Promise<string>} complete HTML document
 */
export async function generateRedesignHtmlClaude(scraped, options = {}) {
  const anthropic = getAnthropic();
  const imageUrls = await filterLoadableImageUrls(scraped.imageUrls);
  const model =
    options.model || process.env.ANTHROPIC_REDESIGN_MODEL || "claude-opus-4-5";
  // Claude writes rich pages; 8192 tokens truncates mid-CSS and renders blank.
  const maxTokens = Number(options.maxTokens) || 20000;
  let lastError;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const message = await anthropic.messages.create({
      model,
      max_tokens: maxTokens,
      system: CLAUDE_REDESIGN_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: buildUserMessage(scraped, imageUrls),
        },
      ],
    });

    if (message.stop_reason === "max_tokens") {
      lastError = new Error("Claude redesign output was truncated (max_tokens).");
      console.warn(`[redesign-claude] Attempt ${attempt}/${MAX_ATTEMPTS}: truncated output.`);
      continue;
    }

    const raw = message.content?.[0]?.text;
    if (!raw) {
      lastError = new Error("Claude returned an empty redesign response.");
      continue;
    }

    try {
      const html = sanitizeHtmlOutput(raw);
      validateRedesignHtml(html);
      return html;
    } catch (error) {
      lastError = error;
      console.warn(
        `[redesign-claude] Attempt ${attempt}/${MAX_ATTEMPTS} failed validation: ${error.message}`
      );
    }
  }

  throw lastError ?? new Error("Claude redesign generation failed.");
}
