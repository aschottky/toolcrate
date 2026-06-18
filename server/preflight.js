import OpenAI from "openai";

const WHALE_PAGE_THRESHOLD = 50;
const SITEMAP_FETCH_TIMEOUT_MS = 10_000;
const MAX_CHILD_SITEMAPS = 8;
const LINK_DENSITY_THRESHOLD = 50;
const AI_SAMPLE_CHARS = 4_000;

const GATEKEEPER_SYSTEM_PROMPT = `You are the Gatekeeper for ToolCrate, an AI website redesign platform focused on local service businesses and the Full Build tier (core conversion site, up to 10 pages).

Your job is to review scraped homepage text and decide whether this lead is a good fit for an automated Full Build preview and conversion-focused redesign.

Approve local service businesses that would benefit from a clearer lead-capture site: roofers, plumbers, HVAC, lawyers, clinics, landscapers, contractors, and similar trades.

Use these rejection criteria when the site is NOT a good Full Build fit:

- 'enterprise_scale': The site is a massive corporate entity, large e-commerce store, or huge directory that exceeds our Small Business scope.
- 'low_intent_land': The URL leads to a parked domain, a generic Under Construction placeholder, or a blank login screen with zero context.
- 'incompatible_trade': The business is not a service-based trade (e.g., it is a global SaaS, a digital product store, or a news site) and would not benefit from our local-conversion template.
- 'no_room_for_improvement': The site is already a top-tier, custom-coded masterpiece. Redesigning it with AI would be a downgrade for the client.

You must respond with a strict JSON object matching this structure: { "suitable": true or false, "reason": "approved" or one of the rejection criteria above, "business_category": "identified trade or industry" }`;

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  Accept: "application/xml,text/xml,text/plain,*/*;q=0.8",
};

const AI_REJECTION_REASONS = new Set([
  "enterprise_scale",
  "low_intent_land",
  "incompatible_trade",
  "no_room_for_improvement",
]);

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

export class PreflightRejectedError extends Error {
  constructor(preflight) {
    super(`Preflight rejected: ${preflight.reason}`);
    this.name = "PreflightRejectedError";
    this.code = "PREFLIGHT_REJECTED";
    this.preflight = preflight;
  }
}

/** Internal log label for rejected leads (ASCII only). */
export function preflightLogCode(preflight) {
  if (preflight?.suitable) {
    return "APPROVED";
  }
  if (preflight?.reason === "enterprise_scale") {
    return "MANUAL_OUTREACH_REQUIRED";
  }
  if (preflight?.reason === "low_intent_land") {
    return "INVALID_URL_REJECTED";
  }
  return "PREFLIGHT_REJECTED";
}

function countLocTags(xml) {
  const matches = String(xml || "").match(/<loc>\s*[^<]+\s*<\/loc>/gi);
  return matches?.length ?? 0;
}

function extractLocUrls(xml) {
  const urls = [];
  const pattern = /<loc>\s*([^<]+?)\s*<\/loc>/gi;
  let match;
  while ((match = pattern.exec(String(xml || ""))) !== null) {
    urls.push(match[1].trim());
  }
  return urls;
}

async function fetchSitemapXml(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SITEMAP_FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: BROWSER_HEADERS,
    });

    if (!response.ok) {
      return null;
    }

    const contentType = response.headers.get("content-type") || "";
    const text = await response.text();
    if (!text?.trim()) {
      return null;
    }

    if (
      !contentType.includes("xml") &&
      !text.includes("<urlset") &&
      !text.includes("<sitemapindex")
    ) {
      return null;
    }

    return text;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function countSitemapPages(websiteUrl) {
  let origin;
  try {
    origin = new URL(websiteUrl).origin;
  } catch {
    return { pageCount: null, source: null };
  }

  const rootXml = await fetchSitemapXml(`${origin}/sitemap.xml`);
  if (!rootXml) {
    return { pageCount: null, source: null };
  }

  if (/<sitemapindex/i.test(rootXml)) {
    const childUrls = extractLocUrls(rootXml).slice(0, MAX_CHILD_SITEMAPS);
    let total = 0;

    for (const childUrl of childUrls) {
      const childXml = await fetchSitemapXml(childUrl);
      if (!childXml) continue;
      total += countLocTags(childXml);
      if (total > WHALE_PAGE_THRESHOLD) {
        return { pageCount: total, source: "sitemap_index" };
      }
    }

    return { pageCount: total || null, source: total ? "sitemap_index" : null };
  }

  const pageCount = countLocTags(rootXml);
  return {
    pageCount: pageCount || null,
    source: pageCount ? "sitemap" : null,
  };
}

function countHomepageLinkDensity(scrapedText, websiteUrl) {
  let origin;
  try {
    origin = new URL(websiteUrl).origin.replace(/\/$/, "");
  } catch {
    return 0;
  }

  const urls = String(scrapedText || "").match(/https?:\/\/[^\s<>"']+/gi) ?? [];
  const sameOrigin = new Set();

  for (const raw of urls) {
    try {
      const parsed = new URL(raw.replace(/[),.;]+$/, ""));
      if (parsed.origin.replace(/\/$/, "") === origin) {
        sameOrigin.add(`${parsed.pathname}${parsed.search}`.replace(/\/$/, "") || "/");
      }
    } catch {
      // ignore malformed URLs in scrape text
    }
  }

  return sameOrigin.size;
}

function buildTechnicalRejection(pageCount, check) {
  return {
    suitable: false,
    reason: "enterprise_scale",
    pageCount,
    check,
    logCode: preflightLogCode({ suitable: false, reason: "enterprise_scale" }),
  };
}

async function runTechnicalCheck(scrapedText, websiteUrl) {
  const { pageCount, source } = await countSitemapPages(websiteUrl);

  if (pageCount != null && pageCount > WHALE_PAGE_THRESHOLD) {
    return buildTechnicalRejection(pageCount, source);
  }

  const linkDensity = countHomepageLinkDensity(scrapedText, websiteUrl);
  if (linkDensity > LINK_DENSITY_THRESHOLD) {
    return buildTechnicalRejection(linkDensity, "link_density");
  }

  return { suitable: true, reason: "approved", pageCount: pageCount ?? undefined };
}

function normalizeAiPreflight(parsed) {
  const suitable = parsed?.suitable === true;
  const reason = suitable
    ? "approved"
    : AI_REJECTION_REASONS.has(parsed?.reason)
      ? parsed.reason
      : "incompatible_trade";

  const business_category =
    typeof parsed?.business_category === "string"
      ? parsed.business_category.trim()
      : typeof parsed?.business_type === "string"
        ? parsed.business_type.trim()
        : "unknown";

  const result = {
    suitable,
    reason,
    business_category,
    check: "ai_screen",
  };

  if (!suitable) {
    result.logCode = preflightLogCode(result);
  }

  return result;
}

async function runAiScreen(scrapedText) {
  const openai = getOpenAI();
  const sample = String(scrapedText || "").slice(0, AI_SAMPLE_CHARS);

  const completion = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: GATEKEEPER_SYSTEM_PROMPT },
      {
        role: "user",
        content: `Homepage scrape sample (first ${AI_SAMPLE_CHARS} characters):\n\n${sample}`,
      },
    ],
  });

  const raw = completion.choices[0]?.message?.content?.trim();
  if (!raw) {
    throw new Error("Preflight AI screen returned an empty response.");
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) {
      throw new Error("Preflight AI screen returned invalid JSON.");
    }
    parsed = JSON.parse(match[0]);
  }

  return normalizeAiPreflight(parsed);
}

/**
 * Pre-flight qualification before expensive Claude Opus redesign/roast calls.
 *
 * @param {string} scrapedText - output of scrapeWebsiteText().textForAudit
 * @param {string} websiteUrl - normalized site URL
 * @returns {Promise<{ suitable: boolean, reason: string, business_category?: string, pageCount?: number, check?: string, logCode?: string }>}
 */
export async function evaluateLeadSuitability(scrapedText, websiteUrl) {
  const technical = await runTechnicalCheck(scrapedText, websiteUrl);
  if (!technical.suitable) {
    return technical;
  }

  const ai = await runAiScreen(scrapedText);
  if (technical.pageCount != null) {
    ai.sitemapPageCount = technical.pageCount;
  }
  return ai;
}

export async function assertLeadSuitable(scrapedText, websiteUrl) {
  const result = await evaluateLeadSuitability(scrapedText, websiteUrl);
  if (!result.suitable) {
    throw new PreflightRejectedError(result);
  }
  return result;
}
