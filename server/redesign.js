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

export const LOCAL_SERVICE_CONVERSION_RULES = `LOCAL SERVICE BUSINESS CONVERSION RULES (hard requirements for trades, plumbers, HVAC, roofers, and similar):

COLOR & BRAND ACCURACY:
- Extract PRIMARY brand colors from the scraped site, logo image, and CSS. If the logo is orange and black, the redesign MUST feature orange and black as primary/accent colors — not as minor accents only.
- Do NOT default to generic "SaaS navy", cool slate, or blue-gray palettes unless the scraped brand clearly uses those colors.
- CTA buttons must be high-contrast: if the section background is dark or blue, use the brand's warm accent (e.g. orange) for primary buttons.

VISUAL WEIGHT — WARMTH & AUTHORITY:
- Local service businesses need warmth and authority — not cold corporate minimalism.
- Prefer imagery that suggests real people, crews, trucks, jobs in progress, or active service scenarios. Use scraped site photos when they show real work.
- Avoid cold, empty, ultra-minimalist layouts and generic clinical stock-photo aesthetics.

CONVERSION COPY:
- Headlines must be PUNCHY and BENEFIT-DRIVEN (e.g. "Same-Day Plumbing in Springfield") — not poetic, vague, or clever for its own sake.
- Subheads must state a concrete offer, speed, or proof point — not filler.
- The phone number is the #1 conversion action for trades: display it prominently in the header/nav as a bold, clickable tel: link — never footer-only.

TONE & STYLE:
- Target: "Modern Industrial" or "High-Performance Professional" — full, energetic layouts with bold typography and strong section breaks.
- AVOID: Ultra-minimalist, clinical, sparse, or "empty" designs with excessive white space and timid type.
- The page should feel FULL and energetic — every section should have clear visual weight.`;

const REDESIGN_SYSTEM_PROMPT = `You are a world-class web designer and conversion strategist. You will receive scraped data from a local contractor's website including their company name, location, services, phone number, existing copy, colors, and any image URLs found on their site.

Your job is to generate a single, complete HTML file that reimagines this business's online presence as a stunning, high-converting landing page. This preview will be shown to the business owner as a "vision" of what their site could look like - it needs to make their jaw drop.

${LOCAL_SERVICE_CONVERSION_RULES}

CREATIVE DIRECTION:

The user message includes a MANDATORY STYLE DIRECTION — treat every bullet as a hard constraint. Do not fall back to generic dark-overlay split heroes, default orange accents, or serif headlines unless that direction requires them. Never substitute SaaS navy for a brand that uses other colors.

HEADLINE: Write a headline freshly conceived for this specific site and style direction. Headlines must be punchy and benefit-driven — not poetic. Do not default to the most obvious brand pun or the company name. Match the style direction's voice — short and punchy for bold type-led, clear value statement for light professional, unexpected for editorial.

CONTENT RULES:

- Use their REAL company name, phone, city, services, and any taglines found in the scraped data
- If image URLs were found on their site, embed them directly using those URLs (use them as hero backgrounds, section images, or card imagery)
- Write sharp, conversion-focused copy using their actual service names and city - not generic filler
- Generate realistic-sounding Google reviews using their actual city name
- Trust signals should feel earned (pull from their data: years in business, service area, licensing info if present)

ICONS - CRITICAL RULE:
Never use emoji characters as icons anywhere in the design. Not in feature grids, not in service cards, not in bullet points, not anywhere.

Instead, use ONE of these approaches:
- Inline SVG icons (simple, clean line icons - use heroicons or similar vocabulary)
- A single stylized letter or number in a styled box (e.g. a bold "01", "02" in a colored circle)
- A minimal geometric shape (a small colored line, dot, or bracket as a visual accent)
- Pure typography with strong hierarchy - no icon at all

The design must look like it was built by a professional agency, not assembled from emoji shortcuts.

SECTION CONTRAST - REQUIRED:
The page must alternate between light and dark sections to create visual rhythm. Do not use the same background color for more than two consecutive sections. The hero's light/dark treatment is defined by the MANDATORY STYLE DIRECTION in the user message.

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

2. Subheading: Smaller (18-20px), lighter weight, gives context. Not more than 2 lines unless the direction says otherwise.

3. CTAs: Two buttons - primary (filled, brand accent color) and secondary (ghost/outline). Both must be clearly visible against the hero background.

4. Visual treatment: Only use full-bleed photo + dark overlay when the assigned style direction requires it.

5. Trust signal: A small badge or inline text row when it fits the direction.

HEADER / NAV — PHONE FIRST:
- The business phone number from scraped data MUST appear in the header or top nav bar — bold, visible, and wrapped in a tel: link. This is non-negotiable for local service businesses.

SERVICE CARDS:
- Use a simple numbered accent (01, 02, 03...) OR a small colored top border on each card as the visual identifier - no emojis
- Each card should have: a clear service name (bold, 18-20px), a 1-2 sentence description, and a subtle CTA link ("Get a Quote →")
- Cards should have a slight border or shadow to separate them from the background - they should feel like cards, not floating text blocks
- On a dark background, use a slightly lighter card surface tinted with the brand palette — not generic navy unless the brand is navy

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
- Text over photos: any text placed on a photo background needs a gradient overlay darker at the bottom where text sits and lighter/transparent at the top - never a flat uniform overlay, and never put text directly on a busy or light image without overlay.
- Logos and mascot images are NOT backgrounds: if a scraped image is clearly a logo/mascot/badge, use it in the nav/header at min-height 48px, max-height 72px, width: auto — or as a small trust-bar/footer mark. If the logo cannot load, fall back to bold company-name text. Never stretch a logo as a background or render it tiny/broken.
- Every embedded photo must be size-constrained: fixed height (300-450px) with object-fit: cover, or aspect-ratio + overflow hidden - never let an image render at its natural full size.
- Use the company NAME for headings/logo text, not the site's full meta title string (e.g. "Liberty Roofing", not "Liberty Roofing | Mid-Michigan Roofing | Exterior Upgrades").
- ONLY embed image URLs that were explicitly provided as verified - never invent image paths, reviewer avatars, placeholder images, or stock photo URLs. A broken image icon ruins the whole preview. Testimonials need no photos - stars and text are enough.
- Every required section must be fully designed in the chosen style - services as styled cards with numbered accents, SVG icons, or colored borders - never emoji icons, never bare centered text lists.

CTA / ESTIMATE SECTION - REQUIRED:
The CTA or estimate section MUST include a visible inline HTML form with name, phone, email, and an optional message field. Do NOT render a button that links to an external form page - that is the exact conversion problem this redesign is solving. The form does not need a real backend - use action="#". Style it to look polished and intentional (styled inputs, spacing, on-brand colors) - not default browser form styling. Required fields at minimum:
- <input type="text" placeholder="Your Name">
- <input type="tel" placeholder="Phone Number">
- <input type="email" placeholder="Email Address">
- <textarea placeholder="Tell us about your project (optional)"></textarea>
- <button type="submit">Get My Free Estimate</button> (or equivalent)
Hero CTAs may scroll to this form or use tel: links. Never include links or hrefs pointing to the original scraped website's domain anywhere in the page.

FOOTER COPYRIGHT:
In the footer copyright line, use the placeholder CURRENT_YEAR - do not hardcode a year. Example: © CURRENT_YEAR [Company Name]. All rights reserved.`;

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

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Hostnames to strip from href/action (apex + www). */
function oldSiteHostnames(websiteUrl) {
  try {
    const hostname = new URL(websiteUrl).hostname.toLowerCase();
    const apex = hostname.replace(/^www\./, "");
    return [...new Set([apex, `www.${apex}`])];
  } catch {
    return [];
  }
}

export function extractWebsiteUrlFromScraped(scraped) {
  const match = scraped?.textForAudit?.match(/^URL:\s*(\S+)/m);
  return match?.[1] || null;
}

/** Replace links/actions pointing at the scraped site's domain with #. */
export function stripOldSiteLinks(html, websiteUrl) {
  if (!html || !websiteUrl) return html;

  const hosts = oldSiteHostnames(websiteUrl);
  if (!hosts.length) return html;

  let result = String(html);
  for (const host of hosts) {
    const hostRe = escapeRegExp(host);
    for (const attr of ["href", "action"]) {
      result = result.replace(
        new RegExp(`${attr}=(["'])https?:\\/\\/${hostRe}[^"']*\\1`, "gi"),
        `${attr}="#"`
      );
      result = result.replace(
        new RegExp(`${attr}=(["'])\\/\\/${hostRe}[^"']*\\1`, "gi"),
        `${attr}="#"`
      );
    }
  }

  return result;
}

/** Resolve CURRENT_YEAR placeholder and stale hardcoded copyright years. */
export function normalizeCopyrightYear(html) {
  if (!html) return html;

  const currentYear = new Date().getFullYear();
  let result = String(html);

  result = result.replace(/CURRENT_YEAR/g, String(currentYear));
  result = result.replace(/(&copy;|©)\s*\d{4}/g, `© ${currentYear}`);
  result = result.replace(/Copyright\s+\d{4}/gi, `Copyright ${currentYear}`);

  return result;
}

/** Remove pictographic emoji from visible HTML — keeps ★ • → in copy. */
export function stripEmojiFromHtmlBody(html) {
  const parts = String(html || "").split(
    /(<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>)/gi
  );

  return parts
    .map((part) => {
      if (/^<(style|script)/i.test(part)) return part;
      return part.replace(/\p{Extended_Pictographic}/gu, "");
    })
    .join("");
}

/**
 * Best-effort fixes for common model output issues before strict validation.
 * Does not guarantee pass — retries still run when validation fails.
 */
export function repairRedesignHtml(html) {
  let fixed = String(html || "").trim();
  if (!fixed) return fixed;

  if (!/<html[\s>]/i.test(fixed)) {
    fixed = `<!DOCTYPE html>\n<html lang="en">\n${fixed}`;
  }

  if (!/<head[\s>]/i.test(fixed)) {
    fixed = fixed.replace(/<html([^>]*)>/i, "<html$1>\n<head></head>");
  }

  if (!/<style[\s>]/i.test(fixed)) {
    fixed = fixed.replace(/<\/head>/i, "<style></style>\n</head>");
  }

  if (!/fonts\.googleapis\.com/i.test(fixed)) {
    const fontImport =
      '@import url("https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap");';
    fixed = fixed.replace(/<style([^>]*)>/i, `<style$1>\n${fontImport}\n`);
  }

  if (!/@media/i.test(fixed)) {
    const mediaQueries = `
@media (max-width: 768px) {
  .container, .wrap, main { padding-left: 1rem; padding-right: 1rem; }
}
@media (max-width: 480px) {
  h1 { font-size: clamp(2rem, 8vw, 2.75rem); }
  .btn, button, a.button { width: 100%; }
}`;
    fixed = fixed.replace(/<\/style>/i, `${mediaQueries}\n</style>`);
  }

  if (!/<\/body>/i.test(fixed)) {
    fixed += "\n</body>";
  }
  if (!/<\/html>\s*$/i.test(fixed)) {
    fixed += "\n</html>";
  }

  return stripEmojiFromHtmlBody(fixed);
}

export function prepareRedesignHtml(raw, websiteUrl) {
  let html = repairRedesignHtml(sanitizeHtmlOutput(raw));
  if (websiteUrl) {
    html = stripOldSiteLinks(html, websiteUrl);
  }
  return normalizeCopyrightYear(html);
}

/** Pictographic emoji in page body (allows ★ → • etc. used in professional copy). */
export function htmlContainsEmojiIcons(html) {
  const stripped = String(html || "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "");
  return /\p{Extended_Pictographic}/u.test(stripped);
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
  if (htmlContainsEmojiIcons(html)) {
    throw new Error("AI redesign output uses emoji characters as icons.");
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

const STYLE_DIRECTION_SPECS = [
  {
    slug: "bold_type_led",
    prompt: `STYLE DIRECTION 1 - BOLD TYPE-LED
- Hero: White or off-white background, NO dark overlay, text is the hero
- Typography: Extra-bold sans-serif headline (900 weight), very large (80-100px), black or near-black text
- Color: One strong accent color (not orange unless scraped brand uses it), used sparingly
- Layout: Centered hero, headline takes up 60% of the viewport, CTA buttons below
- Unique element: A large typographic "stamp" or badge (e.g. "EST. 2004" or service area) as a decorative element
- Feel: Modernist poster, bold, confident, no photography required in the hero`,
  },
  {
    slug: "light_professional",
    prompt: `STYLE DIRECTION 2 - LIGHT PROFESSIONAL
- Hero: Light gray or pure white background, image confined to a right-column card with rounded corners and a drop shadow - NOT full bleed
- Typography: Clean geometric sans-serif, medium weight
- Color: Light palette, one muted accent (slate blue, forest green, warm gray - whatever fits the brand)
- Layout: Classic split - text left 55%, image card right 45%
- Unique element: A horizontal stat bar below the hero ("1,200+ Roofs Replaced · A+ BBB · 20 Years in KC")
- Feel: Established professional firm, trust-forward, approachable`,
  },
  {
    slug: "dark_dramatic",
    prompt: `STYLE DIRECTION 3 - DARK DRAMATIC
- Hero: Dark background ONLY if a high-quality photo justifies it, photo must be full bleed with overlay
- Typography: Serif display font for headline, contrasting weight between headline and subtext
- Color: Deep background, single warm accent
- Layout: Text lower-left anchored, image fills upper right - NOT centered
- Unique element: Vertical text element or side label along one edge
- Feel: Premium, cinematic - ONLY use this direction if verified photos are high quality. If no good photos exist, adapt toward Style 2 instead.`,
  },
  {
    slug: "high_energy_local",
    prompt: `STYLE DIRECTION 4 - HIGH ENERGY LOCAL
- Hero: Bold color block background (NOT dark - think deep red, navy, forest green, burnt orange based on brand colors)
- Typography: Tall condensed sans-serif headline in white, large
- Color: High contrast - saturated background block, white text, one bright accent for CTAs
- Layout: Full-width stacked, headline centered and dominant, trust badges in a row below
- Unique element: A "service area" callout prominently placed ("Proudly Serving Kansas City & Surrounding Areas")
- Feel: Energetic local business, approachable, community-rooted`,
  },
  {
    slug: "editorial_magazine",
    prompt: `STYLE DIRECTION 5 - EDITORIAL MAGAZINE
- Hero: Asymmetric grid layout - headline in large serif on one side, image cropped unconventionally on the other
- Typography: Mix of serif display (headline) and clean sans-serif (body) - intentional contrast
- Color: Mostly neutral with one editorial accent (deep burgundy, forest, slate)
- Layout: Intentional white space, elements do NOT fill every pixel
- Unique element: A pull-quote or short brand manifesto line in large italic type below the hero
- Feel: Architecture firm or high-end home services brand, sophisticated`,
  },
];

export const STYLE_DIRECTION_SLUGS = STYLE_DIRECTION_SPECS.map((spec) => spec.slug);

/** Pick a style direction, excluding previously used slugs for this URL when possible. */
export function pickStyleDirectionForGeneration({
  imageUrls = [],
  usedStyleDirections = [],
} = {}) {
  let pool = STYLE_DIRECTION_SPECS;
  if (!imageUrls?.length) {
    pool = pool.filter((spec) => spec.slug !== "dark_dramatic");
  }

  const available = pool.filter((spec) => !usedStyleDirections.includes(spec.slug));
  const candidates = available.length > 0 ? available : pool;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

function normalizeHexColor(value) {
  if (!value) return null;
  const hex = String(value).trim();
  if (/^#[0-9a-fA-F]{3}$/.test(hex)) {
    const r = hex[1];
    const g = hex[2];
    const b = hex[3];
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }
  if (/^#[0-9a-fA-F]{6}$/.test(hex)) {
    return hex.toUpperCase();
  }
  return null;
}

/** Extract hero headline text from generated HTML for deduplication on reruns. */
export function extractHeroHeadline(html) {
  const h1Match = String(html || "").match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (!h1Match) return null;

  const text = h1Match[1]
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return text ? text.slice(0, 240) : null;
}

/** Extract primary accent hex from meta comment or CSS heuristics. */
export function extractPrimaryAccentColor(html) {
  const source = String(html || "");

  const metaMatch = source.match(/<!--\s*toolcrate-accent:\s*(#[0-9a-fA-F]{3,8})\s*-->/i);
  if (metaMatch) {
    return normalizeHexColor(metaMatch[1]);
  }

  const varMatch = source.match(
    /--(?:accent|primary|brand|color-primary)[^:]*:\s*(#[0-9a-fA-F]{3,8})/i
  );
  if (varMatch) {
    return normalizeHexColor(varMatch[1]);
  }

  const btnMatch = source.match(
    /\.(?:btn|button|cta|primary)[^{]*\{[^}]*background(?:-color)?:\s*(#[0-9a-fA-F]{3,8})/i
  );
  if (btnMatch) {
    return normalizeHexColor(btnMatch[1]);
  }

  return null;
}

export function buildRedesignGenerationResult(html, styleDirectionSlug) {
  return {
    html,
    styleDirection: styleDirectionSlug,
    heroHeadline: extractHeroHeadline(html),
    primaryAccentColor: extractPrimaryAccentColor(html),
  };
}

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

/** Site-specific creative overrides (e.g. known test / flagship clients). */
export function getSiteSpecificDesignOverride(websiteUrl, textForAudit) {
  const haystack = `${websiteUrl || ""} ${textForAudit || ""}`.toLowerCase();
  if (/franco[\s-]?american|francoamerican/.test(haystack)) {
    return {
      forceStyleSlug: "high_energy_local",
      brief: `SITE-SPECIFIC CREATIVE BRIEF — FRANCO AMERICAN (hard override on colors and tone):
Keep the vibrant Orange and Black branding from their logo and site. Frame them as the elite, high-energy plumbing authority in Springfield. Use bold sans-serif fonts and high-contrast buttons (orange CTAs on dark/black sections). Do NOT substitute navy, slate, or generic SaaS blue.
Headlines must be punchy and benefit-driven. Phone number must be front and center in the header. Layout should feel full and energetic — modern industrial, not minimalist or clinical.`,
    };
  }
  return null;
}

export function buildUserMessage(scraped, imageUrls, generationContext = {}) {
  const websiteUrl = extractWebsiteUrlFromScraped(scraped);
  const siteOverride = getSiteSpecificDesignOverride(websiteUrl, scraped.textForAudit);

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
      "Image usage: real photos (job sites, crews, finished work, buildings) make great hero backgrounds and section imagery. Logos/mascots: use ONLY in nav/header at 48–72px height (width: auto), or small trust-bar/footer — never as hero backgrounds. If no usable logo, use bold company-name text in the header instead of a broken image."
    );
  }

  let styleDirection =
    generationContext.styleDirection ??
    pickStyleDirectionForGeneration({
      imageUrls,
      usedStyleDirections: generationContext.usedStyleDirections ?? [],
    });

  if (siteOverride?.forceStyleSlug) {
    styleDirection =
      STYLE_DIRECTION_SPECS.find((spec) => spec.slug === siteOverride.forceStyleSlug) ??
      styleDirection;
  }

  const previousHeadlines = generationContext.previousHeadlines ?? [];
  const previousAccentColors = generationContext.previousAccentColors ?? [];

  if (previousHeadlines.length || previousAccentColors.length) {
    parts.push("", "IMPORTANT - PREVIOUS DESIGNS TO AVOID:");
    if (previousHeadlines.length) {
      parts.push(
        "The following headline angles were already used for this site. Do NOT reuse them or close variations:"
      );
      for (const headline of previousHeadlines) {
        parts.push(`- "${headline}"`);
      }
      parts.push(
        "Find a completely different angle from the scraped content. If previous designs focused on one theme (sustainability, energy, family, etc.), this one must lead with a different value: speed, craftsmanship, local trust, storm damage expertise, warranty, etc."
      );
    }
    if (previousAccentColors.length && !siteOverride) {
      parts.push(
        `Previously used accent colors for this site: ${previousAccentColors.join(", ")}`
      );
      parts.push("Use a different primary accent color for this design.");
    }
  }

  if (siteOverride?.brief) {
    parts.push("", siteOverride.brief);
  }

  parts.push(
    "",
    "MANDATORY STYLE DIRECTION — treat every bullet below as a hard constraint, not a loose suggestion. Do not fall back to generic dark-overlay split heroes, default orange accents, or serif headlines unless this direction requires them:",
    "",
    styleDirection.prompt,
    "",
    "Immediately after the opening <body> tag, include an HTML comment with your primary accent color: <!-- toolcrate-accent: #RRGGBB -->",
    "",
    "Alternate light and dark sections for visual rhythm in the rest of the page. No emoji icons anywhere. Follow this direction's hero scale and layout rules — not a generic template."
  );

  return { message: parts.join("\n"), styleDirection };
}

// gpt-4o caps completion output at 16384 tokens.
const OPENAI_MAX_OUTPUT_TOKENS = 16384;

export async function generateRedesignHtml(scraped, options = {}) {
  const openai = getOpenAI();
  const imageUrls = await filterLoadableImageUrls(scraped.imageUrls);
  const exclusions = options.generationExclusions ?? {};
  const { message: userMessage, styleDirection } = buildUserMessage(scraped, imageUrls, {
    styleDirection: options.styleDirection,
    usedStyleDirections: exclusions.styleDirections ?? [],
    previousHeadlines: exclusions.heroHeadlines ?? [],
    previousAccentColors: exclusions.primaryAccentColors ?? [],
  });
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
            { type: "text", text: userMessage },
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
      const websiteUrl =
        options.websiteUrl || extractWebsiteUrlFromScraped(scraped);
      const html = prepareRedesignHtml(raw, websiteUrl);
      validateRedesignHtml(html);
      return buildRedesignGenerationResult(html, styleDirection.slug);
    } catch (error) {
      lastError = error;
      console.warn(
        `[redesign] Attempt ${attempt}/${MAX_ATTEMPTS} failed validation: ${error.message}`
      );
    }
  }

  throw lastError ?? new Error("Redesign generation failed.");
}
