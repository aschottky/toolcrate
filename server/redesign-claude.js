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
- Fully responsive at all screen sizes. Use CSS media queries with breakpoints at 768px and 480px. On mobile: single column layout, stacked navigation, full-width buttons, font sizes scaled down. The site must look as good on a phone as it does at 1280px.

MOBILE NAVIGATION:

- If the design includes a hamburger menu icon, it MUST be functional using vanilla JS only (no libraries)
- Add a <script> tag at the bottom of the body with a click toggle that shows/hides the mobile nav menu
- The mobile menu when open should display nav links stacked vertically, full width, with a semi-transparent dark overlay background
- The hamburger icon should animate between ☰ and ✕ on toggle using a CSS transition

NO HORIZONTAL SCROLL OR ZOOM SHIFT:

- Add these rules to the top of the CSS: *, *::before, *::after { box-sizing: border-box; } and html, body { overflow-x: hidden; max-width: 100%; }
- Every section and container must use max-width with width: 100% - never fixed pixel widths wider than the viewport
- Images must have max-width: 100%; height: auto;
- No element should ever exceed 100vw in width

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
