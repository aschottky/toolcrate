import { randomUUID } from "node:crypto";

export const NEW_SITE_BUILD = "NEW_SITE_BUILD";
export const BLUEPRINT_URL_PREFIX = "blueprint://new-site/";

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
 */
export function buildBlueprintScrapedData(blueprint) {
  const { companyName, serviceType, location } = blueprint;

  const textForAudit = [
    "URL: (no existing website)",
    `BUILD_MODE: ${NEW_SITE_BUILD}`,
    "",
    `Company Name: ${companyName}`,
    `Service Type: ${serviceType}`,
    `Primary Location: ${location}`,
    "",
    "There is NO existing website to scrape or redesign.",
    "Generate a complete landing page from scratch — hero, utility bar, trust bar, services, testimonials, inline CTA form, footer.",
    "Invent professional, conversion-focused copy appropriate for this trade and city.",
    "No verified image URLs — use typography, CSS gradients, subtle SVG patterns, and asymmetric layout instead of stock photos.",
    "Use a prominent tel: CTA with a placeholder callback number if none is provided.",
  ].join("\n");

  return {
    textForAudit,
    title: companyName,
    metaDescription: `${serviceType} in ${location}`,
    imageUrls: [],
    charCount: textForAudit.length,
    scrapeSource: "blueprint",
    buildMode: NEW_SITE_BUILD,
  };
}

export function normalizeBlueprintRequest(body) {
  const buildMode = String(body?.build_mode ?? "").trim().toUpperCase();
  const companyName = String(body?.company_name ?? "").trim();
  const serviceType = String(body?.service_type ?? "").trim();
  const location = String(body?.location ?? "").trim();

  const isBlueprint =
    buildMode === NEW_SITE_BUILD ||
    (!String(body?.url ?? "").trim() && companyName && serviceType && location);

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
