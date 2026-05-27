import * as cheerio from "cheerio";

const MAX_TEXT_CHARS = 14_000;
const MAX_HEAD_HTML_CHARS = 2_500;
const FETCH_TIMEOUT_MS = 15_000;

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "[::1]",
]);

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

export async function scrapeWebsiteText(websiteUrl) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let response;

  try {
    response = await fetch(websiteUrl, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent":
          "ToolcrateAuditBot/1.0 (+https://github.com/aschottky/toolcrate; site audit MVP)",
        Accept: "text/html,application/xhtml+xml",
      },
    });
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error("The website took too long to respond.");
    }
    throw new Error(
      "Could not reach that website. It may be offline or blocking automated access."
    );
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    if ([401, 403, 429].includes(response.status)) {
      throw new Error(
        `Website blocked our scanner (HTTP ${response.status}). Bot protection may be enabled.`
      );
    }
    throw new Error(`Website returned HTTP ${response.status}.`);
  }

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html") && !contentType.includes("application/xhtml")) {
    throw new Error("That URL did not return an HTML page.");
  }

  const html = await response.text();

  if (!html?.trim() || html.length < 200) {
    throw new Error(
      "Website returned very little content. Bot protection may be enabled."
    );
  }

  if (/cloudflare|access denied|bot detection|cf-browser-verification/i.test(html)) {
    throw new Error("Website appears to use bot protection (e.g. Cloudflare).");
  }

  const $raw = cheerio.load(html);
  const technical = extractTechnicalSignals($raw);

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
    textForAudit: combined,
    charCount: combined.length,
  };
}
