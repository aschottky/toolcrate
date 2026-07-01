import { randomUUID } from "node:crypto";

export const NEW_SITE_BUILD = "NEW_SITE_BUILD";
export const BLUEPRINT_URL_PREFIX = "blueprint://new-site/";
export const DEFAULT_BLUEPRINT_BRAND_COLORS = ["#1e293b"];

export const FOUNDING_DESIGNER_BLUEPRINT_PREFIX = `The client does not have an existing website. Act as a Founding Designer building their flagship digital identity from scratch. Use the provided Company Name, Service, and Location to create a high-authority brand "Blueprint" that dominates their local market. You MUST include at least two trade-relevant Unsplash photographs (hero + one section) — never ship a text-only layout.

`;

export function isBlueprintBuild(websiteUrl) {
  return String(websiteUrl || "").startsWith(BLUEPRINT_URL_PREFIX);
}

export function buildBlueprintWebsiteUrl({ companyName, serviceType, location }) {
  const id = randomUUID().replace(/-/g, "").slice(0, 12);
  const params = new URLSearchParams({
    company: companyName.trim(),
    service: serviceType.trim(),
    location: location.trim(),
  });
  return `${BLUEPRINT_URL_PREFIX}${id}?${params.toString()}`;
}

export function parseBlueprintWebsiteUrl(websiteUrl) {
  if (!isBlueprintBuild(websiteUrl)) return null;

  try {
    const withoutPrefix = String(websiteUrl).slice(BLUEPRINT_URL_PREFIX.length);
    const queryIndex = withoutPrefix.indexOf("?");
    const query = queryIndex === -1 ? "" : withoutPrefix.slice(queryIndex + 1);
    const params = new URLSearchParams(query);

    const companyName = params.get("company")?.trim() || "";
    const serviceType = params.get("service")?.trim() || "";
    const location = params.get("location")?.trim() || "";

    if (!companyName) return null;

    return {
      buildMode: NEW_SITE_BUILD,
      companyName,
      serviceType,
      location,
    };
  } catch {
    return null;
  }
}

/**
 * Synthetic scrape payload for businesses with no existing website.
 * Matches the shape expected by the cinematic redesign engine.
 */
export function buildBlueprintScrapedData(blueprint) {
  const companyName = blueprint.companyName?.trim() || "";
  const serviceType = blueprint.serviceType?.trim() || "";
  const location = blueprint.location?.trim() || "";
  const brandColors = blueprint.brandColors ?? DEFAULT_BLUEPRINT_BRAND_COLORS;

  const textForAudit = [
    "URL: (no existing website)",
    `BUILD_MODE: ${NEW_SITE_BUILD}`,
    "",
    `Company Name: ${companyName}`,
    `Service Type: ${serviceType}`,
    `Primary Location: ${location}`,
    `Brand Colors: ${brandColors.join(", ")}`,
    "",
    "There is NO existing website to scrape or redesign.",
    "Generate a complete landing page from scratch — hero, utility bar, services, testimonials, inline CTA form, footer.",
    "Invent professional, conversion-focused copy appropriate for this trade and city.",
    "No verified scraped_images — use trade-appropriate Unsplash URLs per system instructions (AI Image Researcher). Apply cinematic filter/overlay styling.",
    "Use a prominent tel: CTA with a placeholder callback number if none is provided.",
  ].join("\n");

  return {
    isBlueprint: true,
    buildMode: NEW_SITE_BUILD,
    companyName,
    location,
    services: serviceType,
    scrapedImages: [],
    brandColors,
    textForAudit,
    title: companyName,
    metaDescription: `${serviceType} in ${location}`,
    imageUrls: [],
    charCount: textForAudit.length,
    scrapeSource: "blueprint",
  };
}

function readBlueprintFields(body) {
  const companyName = String(body?.company_name ?? body?.companyName ?? "").trim();
  const serviceType = String(body?.service_type ?? body?.serviceType ?? "").trim();
  const location = String(body?.location ?? "").trim();
  const url = String(body?.url ?? body?.websiteUrl ?? "").trim();
  const buildMode = String(body?.build_mode ?? body?.buildMode ?? "").trim().toUpperCase();

  return { companyName, serviceType, location, url, buildMode };
}

export function normalizeBlueprintRequest(body) {
  const { companyName, serviceType, location, url, buildMode } = readBlueprintFields(body);

  const isBlueprint =
    buildMode === NEW_SITE_BUILD ||
    (!url && companyName && serviceType && location);

  if (!isBlueprint) {
    return { isBlueprint: false };
  }

  if (companyName.length < 2) {
    return { isBlueprint: true, error: "Please enter your company name." };
  }
  if (serviceType.length < 2) {
    return { isBlueprint: true, error: "Please enter your service type." };
  }
  if (location.length < 2) {
    return { isBlueprint: true, error: "Please enter your location." };
  }

  return {
    isBlueprint: true,
    blueprint: { companyName, serviceType, location },
  };
}
