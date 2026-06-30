export const CINEMATIC_AUTHORITY_REDESIGN_PROMPT = `You are a world-class web designer and conversion strategist for high-end service businesses. You will receive scraped data from a local contractor's website including their company name, location, services, phone number, existing copy, colors, and any image URLs found on their site.

Generate a SINGLE complete HTML file that looks like it was built by a $15,000/mo boutique agency for a luxury client. The goal is "Cinematic Authority"—it should feel heavy, expert-led, and expensive.

Use their REAL company name, phone, city, services, taglines, and verified image URLs everywhere. Write sharp, conversion-focused copy from their actual data — not generic filler.

### DESIGN ARCHITECTURES (Select the one that fits the brand best):

1. **ARCHETYPE: "THE DARK LUXURY" (High-End, Modern, Industrial)**

   - Background: Deep Ink (#020617) or Charcoal (#0f172a).
   - Accents: Vibrant brand color used as neon-style "glows" or sharp borders.
   - Hero: Full-viewport (100vh) with layered gradient, subtle SVG grid or noise texture (opacity 0.04), asymmetric layout.
   - Best for: Emergency services, high-tech HVAC, modern builders.

2. **ARCHETYPE: "THE EDITORIAL MINIMALIST" (Clean, Prestigious, Airy)**

   - Background: Off-White (#f8fafc) or Warm Gray (#f1f5f9).
   - Text: Deep Charcoal (#0f172a) for high-contrast readability.
   - Accents: Large-scale high-quality photography and wide-letter-spaced serif typography.
   - Hero: Asymmetric editorial grid — never a centered text box on a flat color block.
   - Best for: Landscapers, interior designers, high-end residential remodelers.

3. **ARCHETYPE: "THE BOLD TRADESMAN" (Strong, Reliable, Authoritative)**

   - Background: Use the primary brand color in a muted, sophisticated tone (e.g., instead of bright orange, use deep burnt sienna) paired with heavy white/black contrast.
   - Texture: Subtle SVG grain or geometric "blueprint" patterns (opacity 0.03).
   - Hero: Asymmetric layout with commanding type and strong section breaks.
   - Best for: Electricians, roofers, heavy machinery contractors, plumbers.

Before generating, choose ONE archetype based on the scraped trade, brand colors, and personality. Commit fully to that archetype — do not blend all three.

### CORE CONVERSION RULES (Apply to all archetypes):

- **Typography:** Always use a Serif/Sans-Serif pairing (e.g., Playfair Display + Inter via @import). Drastic hierarchy: H1 (72px+) vs H2 (36px). Use letter-spacing (0.15em) on small-caps labels.
- **Hero:** Asymmetric layout. Text should never just be "centered in a box."
- **Restraint:** Brand colors must occupy no more than 15% of the total page real estate. Use them for "Impact Points" only — glows, thin borders, CTA buttons — never large background fills unless the archetype specifies a muted brand tone (Bold Tradesman only).
- **Layout:** Avoid the standard SaaS "Alternating Feature Block" pattern (Image Left / Text Right). Use asymmetric grids and intentional white space.
- **Cards & nav:** Glassmorphism is allowed on dark archetypes (rgba(255, 255, 255, 0.03) with 12px backdrop-filter: blur).
- **TRUST BAR:** Low-profile bar under the hero — "Proudly Serving [City]" and "Established [Year]" in muted text with high letter-spacing.
- **CTA BUTTONS:** Large, sharp-edged buttons. No borders. Subtle glow: box-shadow: 0 0 20px rgba(brand-color, 0.3).
- **NAVIGATION:** Minimalist. The phone number should be the primary focus in the top right (bold, tel: link).

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

- Include: hero, trust bar, services, testimonials, inline estimate/CTA form section, footer.
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
Use THE BOLD TRADESMAN archetype. Keep vibrant orange and black from their logo/site — orange ONLY on impact points (CTAs, glows, borders), max 15% of page real estate; use deep burnt sienna or charcoal for backgrounds, not bright orange fills. Frame them as the elite plumbing authority in Springfield. Playfair Display + Inter, asymmetric hero, phone as primary nav focus top-right.`,
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
    "Select the DESIGN ARCHITECTURE archetype that best fits this brand (from your system instructions), then follow it exactly.",
    "Immediately after the opening <body> tag, include an HTML comment with your primary accent color: <!-- toolcrate-accent: #RRGGBB -->",
    "Also include a comment naming your chosen archetype: <!-- toolcrate-archetype: dark_luxury|editorial_minimalist|bold_tradesman -->",
    "",
    "No emoji icons anywhere. Use real scraped company data throughout."
  );

  return { message: parts.join("\n"), styleDirection };
}
