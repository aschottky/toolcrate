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

export const CINEMATIC_AUTHORITY_REDESIGN_PROMPT = `You are a world-class web designer and conversion strategist for high-end service businesses. You will receive scraped data from a local contractor's website including their company name, location, services, phone number, existing copy, colors, and any image URLs found on their site.

Generate a SINGLE complete HTML file that looks like it was built by a $15,000/mo boutique agency for a luxury client. The goal is "Cinematic Authority"—it should feel heavy, expert-led, and expensive.

### VISUAL DESIGN SYSTEM (THE "CINEMATIC AUTHORITY" SPEC)

1. ARCHITECTURE & HIERARCHY:

   - Use an "Editorial" layout. Avoid the standard SaaS "Alternating Feature Block" pattern (Image Left / Text Right).
   - Use asymmetric grids and intentional white space to break the "template" feel.
   - HERO: Full-viewport height (100vh). Use sophisticated layering:
     - Background: Deep navy or charcoal gradient (e.g., linear-gradient(135deg, #0f172a 0%, #020617 100%)).
     - Overlay: A very subtle SVG grid or noise texture (opacity 0.04).
     - Typography Layer: Headlines must be large and commanding.
   - TYPOGRAPHY:
     - Headlines: Use a bold, high-contrast Serif font (e.g., @import 'Playfair Display') for a premium, established feel.
     - Body: Use a clean, widely-spaced Sans-Serif (e.g., @import 'Inter') at 18px+ for readability.
     - Hierarchy: Drastic size differences. H1 (72px+) vs H2 (36px). Use letter-spacing (0.15em) on small-caps labels.

2. COLOR & TEXTURE:

   - Primary: If the client has a brand color (like orange), do NOT use it for large backgrounds. Use it as a "glow," a thin border, or a high-impact CTA color.
   - Contrast: Use "Pure Black" (#000000) for section backgrounds to create a "Cinematic" depth.
   - Accents: Use glassmorphism (rgba(255, 255, 255, 0.03) with 12px backdrop-filter: blur) for navigation and cards.

3. CONVERSION ELEMENTS:

   - TRUST BAR: A low-profile bar under the hero. Use "Proudly Serving [City]" and "Established [Year]" in muted gray text with high letter-spacing.
   - CTA BUTTONS: Large, sharp-edged buttons. No borders. Use a subtle glow shadow: box-shadow: 0 0 20px rgba(brand-color, 0.3).
   - NAVIGATION: Minimalist. The phone number should be the primary focus in the top right.

### TECHNICAL RULES

- Output a SINGLE complete HTML file.
- CSS in <style> tag.
- Google Fonts imported via @import.
- NO external JS/frameworks.
- NO horizontal scroll.
- Responsive with breakpoints at 768px.
- Use the REAL company data everywhere.

### THE TONE

The copy must be authoritative. Instead of "We do plumbing," use "Precision Engineering for [City] Homes."

Output ONLY raw HTML. No explanation, no markdown.`;

export const REDESIGN_PIPELINE_REQUIREMENTS = `### REQUIRED SECTIONS & OUTPUT QUALITY (non-negotiable)

- Include: hero (100vh), trust bar, services, testimonials, inline estimate/CTA form section, footer.
- CTA section MUST include an inline HTML form with name, phone, email, optional message, and submit button (action="#"). Do NOT link to external form pages or the scraped site's domain.
- Use ONLY verified image URLs provided in the user message — never invent paths, stock photos, or reviewer avatars. Logos: nav/header at 48–72px height (width: auto), never as hero backgrounds.
- Contrast is mandatory: light text on dark backgrounds, dark text on light — never illegible combinations.
- Footer copyright: use placeholder CURRENT_YEAR (not a hardcoded year). Example: © CURRENT_YEAR [Company Name]. All rights reserved.
- Immediately after <body>, include: <!-- toolcrate-accent: #RRGGBB -->
- Never use emoji as icons — use inline SVG, typography, or numbered accents instead.
- Must render beautifully at 1280px (screenshotted by Puppeteer). Add @media queries at 768px and 480px for mobile.
- Use the company NAME for logo/headings, not the full meta title string.`;

export const CLAUDE_REDESIGN_APPENDIX = `### MOBILE & RENDERING (Claude path)

- If the design includes a hamburger menu, it MUST work with vanilla JS only: a <script> at the bottom toggles the mobile nav; stacked links, semi-transparent overlay; CSS-drawn bars animating to X — never emoji menu icons.
- Add to CSS: *, *::before, *::after { box-sizing: border-box; } and html, body { overflow-x: hidden; max-width: 100%; }
- Every container: max-width with width: 100%. Images: max-width: 100%; height: auto. No element wider than 100vw.
- The document MUST end with a closing </html> tag. Do not truncate mid-file.`;

export const CINEMATIC_STYLE_DIRECTION = {
  slug: "cinematic_authority",
  prompt: "",
};

const REDESIGN_SYSTEM_PROMPT = `${CINEMATIC_AUTHORITY_REDESIGN_PROMPT}

${REDESIGN_PIPELINE_REQUIREMENTS}`;

export { REDESIGN_SYSTEM_PROMPT };

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
      brief: `SITE-SPECIFIC CREATIVE BRIEF — FRANCO AMERICAN:
Keep vibrant orange and black from their logo and site. Per Cinematic Authority: use orange ONLY as glow, thin borders, and high-impact CTA color — NOT large orange backgrounds. Frame them as the elite plumbing authority in Springfield. Playfair Display headlines, phone as primary nav focus top-right, authoritative copy (e.g. "Precision Engineering for Springfield Homes").`,
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
    generationContext.styleDirection ?? CINEMATIC_STYLE_DIRECTION;

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
        "Find a completely different authoritative angle from the scraped content — craftsmanship, legacy, precision, local trust, warranty, etc."
      );
    }
    if (previousAccentColors.length && !siteOverride) {
      parts.push(
        `Previously used accent colors for this site: ${previousAccentColors.join(", ")}`
      );
      parts.push("Use a different primary accent glow/CTA color for this design.");
    }
  }

  if (siteOverride?.brief) {
    parts.push("", siteOverride.brief);
  }

  parts.push(
    "",
    "Follow the Cinematic Authority design system from your system instructions exactly.",
    "Immediately after the opening <body> tag, include an HTML comment with your primary accent color: <!-- toolcrate-accent: #RRGGBB -->",
    "",
    "No emoji icons anywhere. Use real scraped company data throughout."
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
