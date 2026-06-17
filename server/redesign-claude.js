import Anthropic from "@anthropic-ai/sdk";
import { CLAUDE_OPUS_MODEL } from "./anthropic-models.js";
import {
  buildUserMessage,
  filterLoadableImageUrls,
  prepareRedesignHtml,
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

CRITICAL - UNIQUENESS RULES:

You are designing for a SPECIFIC business, not a generic roofing company. Every design must feel custom-built for this exact company. Follow these rules without exception:

1. COLOR PALETTE - Extract the dominant brand colors from the scraped site content (look for color mentions, CSS, or logo description). Use THOSE colors as the primary palette. If no colors are found, choose a palette based on the company name, location, or personality - NOT generic red/maroon. Acceptable defaults include: navy + gold, forest green + cream, charcoal + orange, slate blue + white, deep green + copper. Never default to dark red unless the business explicitly uses it.

2. HERO STYLE - The user message includes a MANDATORY STYLE DIRECTION. That direction overrides these defaults. When no style direction conflicts, vary the hero — do NOT default to background-image-with-dark-overlay every time.

3. TYPOGRAPHY - Match the style direction's typography rules exactly. Do not default to the same serif + sans pairing on every design.

4. HEADLINE - Write a headline freshly conceived for this specific site and style direction. Do not default to the most obvious brand pun or the company name. Think about what makes this business unique from the scraped data — their specialty, their location, their story — and write a headline that fits the style direction's voice. A bold type-led design needs a short punchy headline (3-6 words). A light professional design needs a clear value statement. An editorial design needs something unexpected. Write the headline to match the style, not just the brand.

5. LAYOUT SECTIONS - Vary the order and selection of sections beyond the hero. Not every site needs Services → About → Testimonials in that exact order.

Before generating, briefly note to yourself: what makes THIS company different from a generic roofer? Design around that answer.

ICONS - CRITICAL RULE:
Never use emoji characters as icons anywhere in the design. Not in feature grids, not in service cards, not in bullet points, not anywhere.

Instead, use ONE of these approaches:
- Inline SVG icons (simple, clean line icons - use heroicons or similar vocabulary)
- A single stylized letter or number in a styled box (e.g. a bold "01", "02" in a colored circle)
- A minimal geometric shape (a small colored line, dot, or bracket as a visual accent)
- Pure typography with strong hierarchy - no icon at all

The design must look like it was built by a professional agency, not assembled from emoji shortcuts.

SECTION CONTRAST - REQUIRED:
The page must alternate between light and dark sections to create visual rhythm. Do not use the same background color for more than two consecutive sections. The hero's light/dark treatment is defined by the MANDATORY STYLE DIRECTION — do not force a dark hero if the direction calls for white or a color block.

Suggested pattern for sections AFTER the hero:
- Stats / Trust bar: Light or white - clean, credible
- Services: Dark or medium tone - structured
- About / Why Us: Light with a strong image - warm, human
- Testimonials: Light or subtle texture - trustworthy
- CTA: Dark or strong brand color - urgent, action-oriented
- Footer: Dark - grounding

Use the brand's accent color (extracted from their site) as a punchy highlight, not as the entire palette. White space is not the enemy - it makes the dark sections hit harder.

HERO SECTION - WOW FACTOR:
The hero must follow the MANDATORY STYLE DIRECTION in the user message. These rules apply when the direction does not specify otherwise:

1. Headline typography: Match the direction's scale and weight — do not use 56-72px serif on every design.

2. Subheading: Smaller, lighter weight, gives context. Not more than 2 lines unless the direction says otherwise.

3. CTAs: Two buttons - primary (filled, brand accent color) and secondary (ghost/outline). Both must be clearly visible against the hero background.

4. Visual treatment: Only use full-bleed photo + dark overlay when the assigned style direction requires it (e.g. Style 3).

5. Trust signal: A small badge or inline text row when it fits the direction. Use plain text or ★ characters for stars — never emoji.

SERVICE CARDS:
- Use a simple numbered accent (01, 02, 03...) OR a small colored top border on each card as the visual identifier - no emojis
- Each card should have: a clear service name (bold, 18-20px), a 1-2 sentence description, and a subtle CTA link ("Get a Quote →")
- Cards should have a slight border or shadow to separate them from the background - they should feel like cards, not floating text blocks
- On a dark background, use a slightly lighter card surface (e.g. navy #1a2a4a on a #0f1e36 background) for depth

LOGO / BRAND HEADER:
- If a logo image exists in the verified image URLs, render it in the nav/header at min-height 48px, max-height 72px, width: auto (preserve aspect ratio). The brand area must feel intentional and prominent.
- If no logo image is available or it would fail to load, use the company name as bold styled text in the header instead — never a broken image, tiny placeholder, or afterthought-sized logo.

TECHNICAL RULES:
- All CSS in a style tag, Google Fonts via @import, no external frameworks
- Looks great at 1280px wide - will be screenshotted by Puppeteer
- Fully responsive at all screen sizes. Use CSS media queries with breakpoints at 768px and 480px. On mobile: single column layout, stacked navigation, full-width buttons, font sizes scaled down. The site must look as good on a phone as it does at 1280px.
- The document MUST end with a closing </html> tag. Do not truncate mid-file.

MOBILE NAVIGATION:

- If the design includes a hamburger menu icon, it MUST be functional using vanilla JS only (no libraries)
- Add a <script> tag at the bottom of the body with a click toggle that shows/hides the mobile nav menu
- The mobile menu when open should display nav links stacked vertically, full width, with a semi-transparent dark overlay background
- The hamburger icon should be three CSS-drawn bars (or a minimal inline SVG), animating to an X on toggle using a CSS transition - never use emoji characters for menu icons

NO HORIZONTAL SCROLL OR ZOOM SHIFT:

- Add these rules to the top of the CSS: *, *::before, *::after { box-sizing: border-box; } and html, body { overflow-x: hidden; max-width: 100%; }
- Every section and container must use max-width with width: 100% - never fixed pixel widths wider than the viewport
- Images must have max-width: 100%; height: auto;
- No element should ever exceed 100vw in width

- Output ONLY raw HTML, no explanation, no markdown fences`;

const MAX_ATTEMPTS = 3;

function buildRetryNote(attempt, lastError, stopReason) {
  if (attempt === 1) return "";

  const parts = [
    "",
    `RETRY ${attempt}/${MAX_ATTEMPTS} — your previous output was rejected.`,
  ];

  if (stopReason === "max_tokens") {
    parts.push(
      "The HTML was TRUNCATED (hit max_tokens). Generate a complete page that fits: keep CSS compact, fewer sections if needed, but MUST include Google Fonts @import, @media (768px and 480px), and a closing </html> tag."
    );
  } else if (lastError?.message) {
    parts.push(`Validation error: ${lastError.message}`);
    parts.push(
      "Fix this and output the FULL corrected HTML file only. Required: Google Fonts @import in <style>, @media queries, no emoji icons, closing </html>."
    );
  }

  return parts.join("\n");
}

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
  const model = CLAUDE_OPUS_MODEL;
  console.log(`[Redesign] Using model: ${model}`);
  const maxTokens = Number(options.maxTokens) || 32000;
  const baseUserMessage = buildUserMessage(scraped, imageUrls);
  let lastError;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const retryNote = buildRetryNote(attempt, lastError, null);
    const stream = anthropic.messages.stream({
      model,
      max_tokens: maxTokens,
      system: CLAUDE_REDESIGN_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: baseUserMessage + retryNote,
        },
      ],
    });

    const message = await stream.finalMessage();

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
      const html = prepareRedesignHtml(raw);
      validateRedesignHtml(html);
      console.log(
        `[redesign-claude] Attempt ${attempt}/${MAX_ATTEMPTS} succeeded (${html.length} chars).`
      );
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
