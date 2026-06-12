import OpenAI from "openai";

let openaiClient;

function getOpenAI() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured on the server.");
  }
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openaiClient;
}

const REDESIGN_SYSTEM_PROMPT = `You are a world-class web designer and conversion strategist. You will receive scraped data from a local contractor's website including their company name, location, services, phone number, existing copy, colors, and any image URLs found on their site.

Your job is to generate a single, complete HTML file that reimagines this business's online presence as a stunning, high-converting landing page. This preview will be shown to the business owner as a "vision" of what their site could look like - it needs to make their jaw drop.

CREATIVE DIRECTION:

You have full creative freedom to choose a unique visual style, layout, and color palette. Do NOT default to the same design every time. Draw inspiration from the brand's existing colors and imagery, but elevate everything dramatically. Some directions you might explore (pick whichever fits the brand best, or invent your own):

- Bold editorial: oversized typography, stark contrast, asymmetric layout
- Premium dark mode: deep backgrounds, glowing accents, glass morphism cards
- Clean modern: lots of whitespace, strong grid, subtle shadows, confident typography
- High-energy local: big hero photo treatment, trust signals front and center, urgency-driven copy
- Luxury service: muted tones, refined serif + sans pairing, understated elegance

CONTENT RULES:

- Use their REAL company name, phone, city, services, and any taglines found in the scraped data
- If image URLs were found on their site, embed them directly using those URLs (use them as hero backgrounds, section images, or card imagery)
- Write sharp, conversion-focused copy using their actual service names and city - not generic filler
- Generate realistic-sounding Google reviews using their actual city name
- Trust signals should feel earned (pull from their data: years in business, service area, licensing info if present)

TECHNICAL RULES:

- Single HTML file, all CSS in a <style> tag
- Google Fonts via @import - pick a font pairing that fits the style you chose
- No JavaScript frameworks, no external CSS. Vanilla CSS only.
- Animations are encouraged (CSS only): scroll-in effects via @keyframes, hover lifts, glowing CTAs
- Must render beautifully at 1280px wide - it will be screenshotted by Puppeteer
- Fully responsive at all screen sizes. Use CSS media queries with breakpoints at 768px and 480px. On mobile: single column layout, stacked navigation, full-width buttons, font sizes scaled down. The site must look as good on a phone as it does at 1280px.
- The page must have: hero section, trust/stats bar, services section, testimonials, final CTA, footer
- Output ONLY raw HTML. No explanations. No markdown. No code fences.

RENDERING CORRECTNESS (hard requirements, regardless of style chosen):

- Contrast is non-negotiable: text on dark backgrounds must be light, text on light backgrounds must be dark. Never set a global light text color on body/html. No white-on-white or dark-on-dark anywhere, including stat numbers and phone numbers.
- If you use gradient text (background-clip: text; color: transparent), apply it ONLY to a small accent span - never to a whole headline.
- When layering a pattern or texture over a gradient background, combine them in ONE background-image declaration so the later rule doesn't overwrite the gradient.
- All hero content must sit inside a padded max-width container - text must never touch the viewport edge.
- Text over photos: any text placed on a photo background needs a dark overlay beneath it (e.g. linear-gradient(rgba(10,10,20,0.6), rgba(10,10,20,0.75)) layered over the image) - never put text directly on a busy or light image.
- Logos and mascot images are NOT backgrounds: if a scraped image is clearly a logo/mascot/badge, use it small (nav, footer, trust bar) or skip it - never stretch it behind a section.
- Every embedded photo must be size-constrained: fixed height (300-450px) with object-fit: cover, or aspect-ratio + overflow hidden - never let an image render at its natural full size.
- Use the company NAME for headings/logo text, not the site's full meta title string (e.g. "Liberty Roofing", not "Liberty Roofing | Mid-Michigan Roofing | Exterior Upgrades").
- ONLY embed image URLs that were explicitly provided as verified - never invent image paths, reviewer avatars, placeholder images, or stock photo URLs. A broken image icon ruins the whole preview. Testimonials need no photos - stars and text are enough.
- Every required section must be fully designed in the chosen style - services as styled cards/columns/rows with icons or imagery, never bare centered text lists.`;

/**
 * Strip markdown fences / preamble the model sometimes adds despite instructions.
 */
export function sanitizeHtmlOutput(raw) {
  let html = String(raw || "").trim();

  const fenceMatch = html.match(/```(?:html)?\s*\n?([\s\S]*?)\n?```/);
  if (fenceMatch) {
    html = fenceMatch[1].trim();
  }

  const docStart = html.search(/<!doctype html|<html[\s>]/i);
  if (docStart > 0) {
    html = html.slice(docStart);
  }

  return html;
}

export function validateRedesignHtml(html) {
  if (!html || html.length < 1000) {
    throw new Error("AI returned an incomplete redesign page.");
  }
  if (!/<html[\s>]/i.test(html) || !/<style[\s>]/i.test(html)) {
    throw new Error("AI redesign output is not a valid standalone HTML page.");
  }
  if (!/fonts\.googleapis\.com/i.test(html)) {
    throw new Error("AI redesign output is missing the Google Fonts import.");
  }
  if (!/<\/html>\s*$/i.test(html)) {
    throw new Error("AI redesign output is truncated (missing closing </html>).");
  }
  if (!/@media/i.test(html)) {
    throw new Error("AI redesign output has no media queries (not mobile responsive).");
  }
}

/**
 * Scraped site data → single-file landing page redesign (raw HTML string).
 * Standalone module — used as a separate follow-up step after the teardown audit.
 *
 * @param {{ textForAudit: string }} scraped — output of scrapeWebsiteText()
 * @returns {Promise<string>} complete HTML document
 */
const MAX_ATTEMPTS = 2;

const STYLE_DIRECTIONS = [
  "Bold editorial: oversized typography, stark contrast, asymmetric layout",
  "Premium dark mode: deep backgrounds, glowing accents, glass morphism cards",
  "Clean modern: lots of whitespace, strong grid, subtle shadows, confident typography",
  "High-energy local: big hero photo treatment, trust signals front and center, urgency-driven copy",
  "Luxury service: muted tones, refined serif + sans pairing, understated elegance",
];

const IMAGE_CHECK_TIMEOUT_MS = 5000;

/** Drop scraped image URLs that don't actually load (avoids broken <img> in the preview). */
export async function filterLoadableImageUrls(urls) {
  if (!urls?.length) return [];

  const checks = await Promise.allSettled(
    urls.map(async (url) => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), IMAGE_CHECK_TIMEOUT_MS);
      try {
        const response = await fetch(url, {
          method: "HEAD",
          signal: controller.signal,
          redirect: "follow",
        });
        const type = response.headers.get("content-type") || "";
        return response.ok && type.startsWith("image/") ? url : null;
      } catch {
        return null;
      } finally {
        clearTimeout(timeout);
      }
    })
  );

  return checks
    .map((result) => (result.status === "fulfilled" ? result.value : null))
    .filter(Boolean);
}

export function buildUserMessage(scraped, imageUrls) {
  const parts = [
    "Here is the scraped data from the business's current website. Output the complete redesigned landing page HTML:",
    "",
    scraped.textForAudit,
  ];

  if (imageUrls.length) {
    parts.push(
      "",
      "Verified image URLs from their site are attached below so you can SEE each one. Look at each image and decide how (or whether) to use it:",
      ...imageUrls.map((url, i) => `- Image ${i + 1}: ${url}`),
      "",
      "Image usage: real photos (job sites, crews, finished work, buildings) make great hero backgrounds and section imagery. Logos, mascots, badges, and certification marks must only appear small (nav, trust bar, footer) - never stretched as a background. Skip any image that would weaken the design."
    );
  }

  // Anti-convergence nudge: a randomly suggested starting direction per request,
  // so back-to-back generations don't all land on the same look.
  const suggestion =
    STYLE_DIRECTIONS[Math.floor(Math.random() * STYLE_DIRECTIONS.length)];
  parts.push(
    "",
    `Style suggestion for this one (use it only if it fits the brand, otherwise pick your own): ${suggestion}`
  );

  return parts.join("\n");
}

// gpt-4o caps completion output at 16384 tokens.
const OPENAI_MAX_OUTPUT_TOKENS = 16384;

export async function generateRedesignHtml(scraped, options = {}) {
  const openai = getOpenAI();
  const imageUrls = await filterLoadableImageUrls(scraped.imageUrls);
  const model =
    options.model ||
    process.env.OPENAI_REDESIGN_MODEL ||
    process.env.OPENAI_MODEL ||
    "gpt-4o-mini";
  const maxTokens = Math.min(
    Number(options.maxTokens) || 8000,
    OPENAI_MAX_OUTPUT_TOKENS
  );
  let lastError;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const completion = await openai.chat.completions.create({
      model,
      temperature: 0.85,
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: REDESIGN_SYSTEM_PROMPT },
        {
          role: "user",
          // Attach the actual images (low detail) so a vision-capable model
          // can tell photos from logos and pick brand colors from imagery.
          content: [
            { type: "text", text: buildUserMessage(scraped, imageUrls) },
            ...imageUrls.map((url) => ({
              type: "image_url",
              image_url: { url, detail: "low" },
            })),
          ],
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) {
      lastError = new Error("OpenAI returned an empty redesign response.");
      continue;
    }

    try {
      const html = sanitizeHtmlOutput(raw);
      validateRedesignHtml(html);
      return html;
    } catch (error) {
      lastError = error;
      console.warn(
        `[redesign] Attempt ${attempt}/${MAX_ATTEMPTS} failed validation: ${error.message}`
      );
    }
  }

  throw lastError ?? new Error("Redesign generation failed.");
}
