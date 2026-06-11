import * as cheerio from "cheerio";

const MAX_TEXT_CHARS = 14_000;
const MAX_HEAD_HTML_CHARS = 2_500;
const FETCH_TIMEOUT_MS = 15_000;
const JINA_TIMEOUT_MS = 25_000;

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "[::1]",
]);

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Cache-Control": "no-cache",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Sec-Fetch-User": "?1",
  "Upgrade-Insecure-Requests": "1",
};

function isPrivateIpv4(hostname) {
  const parts = hostname.split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return false;
  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  return false;
}

export function normalizeWebsiteUrl(input) {
  const trimmed = String(input || "").trim();
  if (!trimmed) {
    throw new Error("Website URL is required.");
  }

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let parsed;

  try {
    parsed = new URL(withProtocol);
  } catch {
    throw new Error("Please enter a valid website URL.");
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Only HTTP and HTTPS URLs are supported.");
  }

  const hostname = parsed.hostname.replace(/^\[|\]$/g, "").toLowerCase();

  if (BLOCKED_HOSTNAMES.has(hostname) || isPrivateIpv4(hostname)) {
    throw new Error("That URL cannot be audited.");
  }

  return parsed.toString();
}

function extractTechnicalSignals($) {
  const headInner = $("head").html()?.trim() || "";
  const headHtml = headInner
    ? `<head>${headInner}</head>`
    : "(no head element found)";

  const metaGenerator =
    $('meta[name="generator"]').attr("content")?.trim() ||
    $('meta[name="Generator"]').attr("content")?.trim() ||
    "(not found)";

  const scriptCount = $("script").length;
  const images = $("img");
  const imgCount = images.length;
  let imagesMissingAlt = 0;
  let imagesWithLazyLoading = 0;

  images.each((_, el) => {
    const alt = $(el).attr("alt");
    if (!alt?.trim()) imagesMissingAlt++;

    const loading = ($(el).attr("loading") || "").toLowerCase();
    const lazyAttr = $(el).attr("data-src") || $(el).attr("data-lazy-src");
    if (loading === "lazy" || lazyAttr) imagesWithLazyLoading++;
  });

  const imagesWithoutLazy = imgCount - imagesWithLazyLoading;

  return {
    headHtml: headHtml.slice(0, MAX_HEAD_HTML_CHARS),
    metaGenerator,
    scriptCount,
    imgCount,
    imagesMissingAlt,
    imagesWithLazyLoading,
    imagesWithoutLazy,
  };
}

/** True only for actual bot/challenge interstitial pages — not CDN mentions. */
export function isBotChallengePage(html) {
  if (!html?.trim()) return true;

  const lower = html.toLowerCase();

  const challengeMarkers = [
    "cf-browser-verification",
    "cf-challenge-running",
    "challenge-platform",
    "__cf_chl_opt",
    "cf-turnstile-response",
    "checking your browser before accessing",
    "enable javascript and cookies to continue",
    "attention required! | cloudflare",
    "ddos protection by cloudflare",
    "please wait while your request is being verified",
  ];

  if (challengeMarkers.some((marker) => lower.includes(marker))) {
    return true;
  }

  if (html.length < 1500 && /<\s*title[^>]*>\s*just a moment/i.test(html)) {
    return true;
  }

  return false;
}

const MAX_IMAGE_URLS = 10;

/** Absolute, embeddable image URLs (skips icons, sprites, data URIs, svg). */
function extractImageUrls($, baseUrl) {
  const urls = [];
  const seen = new Set();

  $("img").each((_, el) => {
    const src =
      $(el).attr("src") || $(el).attr("data-src") || $(el).attr("data-lazy-src");
    if (!src || src.startsWith("data:")) return;

    let absolute;
    try {
      absolute = new URL(src, baseUrl).toString();
    } catch {
      return;
    }

    if (!/^https?:/i.test(absolute)) return;
    if (/\.(svg|gif|ico)(\?|$)/i.test(absolute)) return;
    if (/sprite|icon|favicon|logo-?small|pixel|tracking/i.test(absolute)) return;
    if (seen.has(absolute)) return;

    seen.add(absolute);
    urls.push(absolute);
  });

  return urls.slice(0, MAX_IMAGE_URLS);
}

function parseHtmlToScraped(websiteUrl, html, { source = "direct" } = {}) {
  const $raw = cheerio.load(html);
  const technical = extractTechnicalSignals($raw);
  const imageUrls = extractImageUrls($raw, websiteUrl);

  const $ = cheerio.load(html);
  $("script, style, noscript, svg, iframe").remove();

  const title = $("title").first().text().trim();
  const metaDescription =
    $('meta[name="description"]').attr("content")?.trim() ||
    $('meta[property="og:description"]').attr("content")?.trim() ||
    "";

  const headings = [];
  $("h1, h2, h3").each((_, el) => {
    const text = $(el).text().replace(/\s+/g, " ").trim();
    if (text) headings.push(`${el.tagName.toUpperCase()}: ${text}`);
  });

  const ctaSnippets = [];
  $("a, button").each((_, el) => {
    const text = $(el).text().replace(/\s+/g, " ").trim();
    if (/contact|call|quote|schedule|book|get started|free estimate/i.test(text)) {
      ctaSnippets.push(text.slice(0, 120));
    }
  });

  const bodyText = $("body").text().replace(/\s+/g, " ").trim();
  const viewportMeta = $('meta[name="viewport"]').attr("content") || "not found";

  const sections = [
    `URL: ${websiteUrl}`,
    `Scrape source: ${source}`,
    `Title: ${title || "(none)"}`,
    `Meta description: ${metaDescription || "(none)"}`,
    `Viewport meta: ${viewportMeta}`,
    "",
    "Technical signals:",
    `Meta generator (CMS hint): ${technical.metaGenerator}`,
    `Script tags: ${technical.scriptCount}`,
    `Image tags: ${technical.imgCount}`,
    `Images missing alt attribute: ${technical.imagesMissingAlt}`,
    `Images with lazy-loading (loading=lazy or data-src): ${technical.imagesWithLazyLoading}`,
    `Images without lazy-loading: ${technical.imagesWithoutLazy}`,
    "",
    "Head HTML (for CMS / stack detection):",
    technical.headHtml,
    "",
    "Headings:",
    ...(headings.length ? headings.slice(0, 25) : ["(none)"]),
    "",
    "Likely CTA labels:",
    ...(ctaSnippets.length ? [...new Set(ctaSnippets)].slice(0, 15) : ["(none detected)"]),
    "",
    "Body text excerpt:",
    bodyText.slice(0, MAX_TEXT_CHARS),
  ];

  const combined = sections.join("\n");

  return {
    title,
    metaDescription,
    viewportMeta,
    technical,
    imageUrls,
    textForAudit: combined,
    charCount: combined.length,
    scrapeSource: source,
  };
}

async function fetchHtmlDirect(websiteUrl) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(websiteUrl, {
      signal: controller.signal,
      redirect: "follow",
      headers: BROWSER_HEADERS,
    });

    if (!response.ok) {
      if ([401, 403, 429].includes(response.status)) {
        throw new Error(`BLOCKED_HTTP_${response.status}`);
      }
      throw new Error(`Website returned HTTP ${response.status}.`);
    }

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml")) {
      throw new Error("That URL did not return an HTML page.");
    }

    const html = await response.text();

    if (!html?.trim() || html.length < 200) {
      throw new Error("BLOCKED_EMPTY");
    }

    if (isBotChallengePage(html)) {
      throw new Error("BLOCKED_CHALLENGE");
    }

    return html;
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error("The website took too long to respond.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function parseJinaReaderText(readerText) {
  const titleMatch = readerText.match(/^Title:\s*(.+)$/m);
  const title = titleMatch?.[1]?.trim() || "";

  const markdownMatch = readerText.match(
    /Markdown Content:\s*\n([\s\S]+?)(?:\n\n(?:URL Source:|Published Time:|Warning:)|$)/
  );
  const markdown = markdownMatch?.[1]?.trim() || readerText.trim();

  return { title, markdown };
}

function buildScrapedFromReaderText(websiteUrl, readerText) {
  const { title, markdown } = parseJinaReaderText(readerText);

  if (markdown.length < 120) {
    throw new Error("BLOCKED_CHALLENGE");
  }

  const headings = [];
  for (const line of markdown.split("\n")) {
    const match = line.match(/^(#{1,3})\s+(.+)/);
    if (match) {
      headings.push(`H${match[1].length}: ${match[2].trim()}`);
    }
  }

  const ctaSnippets = [];
  for (const line of markdown.split("\n")) {
    const text = line.replace(/^#+\s*/, "").trim();
    if (/contact|call|quote|schedule|book|get started|free estimate/i.test(text)) {
      ctaSnippets.push(text.slice(0, 120));
    }
  }

  const sections = [
    `URL: ${websiteUrl}`,
    "Scrape source: reader-fallback (direct fetch was blocked; technical counts are limited)",
    `Title: ${title || "(none)"}`,
    "Meta description: (not available via reader fallback)",
    "Viewport meta: (not available via reader fallback)",
    "",
    "Technical signals:",
    "Meta generator (CMS hint): (not available via reader fallback)",
    "Script tags: (not available via reader fallback)",
    "Image tags: (not available via reader fallback)",
    "",
    "Headings:",
    ...(headings.length ? headings.slice(0, 25) : ["(none)"]),
    "",
    "Likely CTA labels:",
    ...(ctaSnippets.length ? [...new Set(ctaSnippets)].slice(0, 15) : ["(none detected)"]),
    "",
    "Page content (markdown):",
    markdown.slice(0, MAX_TEXT_CHARS),
  ];

  const combined = sections.join("\n");

  return {
    title,
    metaDescription: "",
    viewportMeta: "not available (reader fallback)",
    technical: {
      headHtml: "(reader fallback — head HTML not captured)",
      metaGenerator: "(not available)",
      scriptCount: 0,
      imgCount: 0,
      imagesMissingAlt: 0,
      imagesWithLazyLoading: 0,
      imagesWithoutLazy: 0,
    },
    imageUrls: [],
    textForAudit: combined,
    charCount: combined.length,
    scrapeSource: "reader-fallback",
  };
}

async function fetchViaJinaReader(websiteUrl) {
  const jinaUrl = `https://r.jina.ai/${websiteUrl}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), JINA_TIMEOUT_MS);

  const headers = {
    Accept: "text/plain",
    "X-Return-Format": "markdown",
  };

  const apiKey = process.env.JINA_API_KEY?.trim();
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  try {
    const response = await fetch(jinaUrl, {
      signal: controller.signal,
      headers,
    });

    if (!response.ok) {
      throw new Error(`Reader fallback failed (HTTP ${response.status}).`);
    }

    const text = await response.text();
    return buildScrapedFromReaderText(websiteUrl, text);
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error("Reader fallback timed out.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function shouldTryReaderFallback(error) {
  const message = error?.message || "";
  return (
    message.startsWith("BLOCKED_") ||
    /could not reach|blocking automated access/i.test(message)
  );
}

export async function scrapeWebsiteText(websiteUrl) {
  try {
    const html = await fetchHtmlDirect(websiteUrl);
    return parseHtmlToScraped(websiteUrl, html, { source: "direct" });
  } catch (directError) {
    if (!shouldTryReaderFallback(directError)) {
      if (directError.message.startsWith("BLOCKED_")) {
        throw new Error("Website appears to use bot protection (e.g. Cloudflare).");
      }
      throw directError;
    }

    console.warn(
      `[scrape] Direct fetch failed for ${websiteUrl} (${directError.message}); trying reader fallback...`
    );

    try {
      const scraped = await fetchViaJinaReader(websiteUrl);
      console.log(`[scrape] Reader fallback succeeded for ${websiteUrl}`);
      return scraped;
    } catch (fallbackError) {
      console.error(
        `[scrape] Reader fallback failed for ${websiteUrl}:`,
        fallbackError.message
      );
      throw new Error(
        "We couldn't access this website — it may be blocking our scanner. Reply to your audit email and we'll run it manually or refund you."
      );
    }
  }
}
