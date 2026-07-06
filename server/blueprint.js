import { randomUUID } from "node:crypto";

export const NEW_SITE_BUILD = "NEW_SITE_BUILD";
export const BLUEPRINT_URL_PREFIX = "blueprint://new-site/";
export const DEFAULT_BLUEPRINT_BRAND_COLORS = ["#1e293b"];

export const BLUEPRINT_LEAD_VISION = "VISION_CONCEPT";
export const BLUEPRINT_LEAD_SITE_AUDIT = "SITE_AUDIT";

export const FOUNDING_DESIGNER_BLUEPRINT_PREFIX = `The client does not have an existing website. Act as a Founding Designer building their flagship digital identity from scratch. Use the provided Company Name, Service, and Location to create a high-authority brand "Blueprint" that dominates their local market. You MUST include at least two trade-relevant Unsplash photographs (hero + one section) — never ship a text-only layout.

`;

export function isBlueprintBuild(websiteUrl) {
  return String(websiteUrl || "").startsWith(BLUEPRINT_URL_PREFIX);
}

export function buildBlueprintWebsiteUrl({
  companyName,
  serviceType,
  location,
  businessGoals,
  referenceLinks,
}) {
  const id = randomUUID().replace(/-/g, "").slice(0, 12);
  const params = new URLSearchParams({
    company: companyName.trim(),
    service: serviceType.trim(),
    location: location.trim(),
  });
  if (businessGoals?.trim()) {
    params.set("goals", businessGoals.trim().slice(0, 2000));
  }
  if (referenceLinks?.trim()) {
    params.set("refs", referenceLinks.trim().slice(0, 500));
  }
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
    const businessGoals = params.get("goals")?.trim() || "";
    const referenceLinks = params.get("refs")?.trim() || "";

    if (!companyName) return null;

    return {
      buildMode: NEW_SITE_BUILD,
      companyName,
      serviceType,
      location,
      businessGoals,
      referenceLinks,
    };
  } catch {
    return null;
  }
}

/** Structured lead_intent for Free Blueprint submissions (admin + confirmation). */
export function buildBlueprintLeadIntent(fields) {
  const lines = [`TYPE:${fields.type}`];
  if (fields.companyName) lines.push(`COMPANY:${fields.companyName}`);
  if (fields.serviceType) lines.push(`SERVICE:${fields.serviceType}`);
  if (fields.location) lines.push(`LOCATION:${fields.location}`);
  if (fields.primaryChange) lines.push(`CHANGE:${fields.primaryChange}`);
  if (fields.businessGoals) lines.push(`GOALS:${fields.businessGoals}`);
  if (fields.referenceLinks) lines.push(`REFS:${fields.referenceLinks}`);
  return lines.join("\n");
}

export function parseBlueprintLeadIntent(leadIntent) {
  const raw = String(leadIntent ?? "").trim();
  if (!raw) return null;

  const parsed = { type: null };
  for (const line of raw.split("\n")) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (key === "TYPE") parsed.type = value;
    if (key === "COMPANY") parsed.companyName = value;
    if (key === "SERVICE") parsed.serviceType = value;
    if (key === "LOCATION") parsed.location = value;
    if (key === "CHANGE") parsed.primaryChange = value;
    if (key === "GOALS") parsed.businessGoals = value;
    if (key === "REFS") parsed.referenceLinks = value;
  }

  return parsed.type ? parsed : null;
}

export function inferBlueprintLeadType({ websiteUrl, leadIntent }) {
  const parsed = parseBlueprintLeadIntent(leadIntent);
  if (parsed?.type === BLUEPRINT_LEAD_SITE_AUDIT) return BLUEPRINT_LEAD_SITE_AUDIT;
  if (parsed?.type === BLUEPRINT_LEAD_VISION) return BLUEPRINT_LEAD_VISION;
  if (isBlueprintBuild(websiteUrl)) return BLUEPRINT_LEAD_VISION;
  return null;
}

export function hasExistingSiteFromLead({ websiteUrl, leadIntent }) {
  return inferBlueprintLeadType({ websiteUrl, leadIntent }) === BLUEPRINT_LEAD_SITE_AUDIT;
}

/**
 * Synthetic scrape payload for businesses with no existing website.
 * Matches the shape expected by the cinematic redesign engine.
 */
export function buildBlueprintScrapedData(blueprint) {
  const companyName = blueprint.companyName?.trim() || "";
  const serviceType = blueprint.serviceType?.trim() || "";
  const location = blueprint.location?.trim() || "";
  const businessGoals = blueprint.businessGoals?.trim() || "";
  const referenceLinks = blueprint.referenceLinks?.trim() || "";
  const brandColors = blueprint.brandColors ?? DEFAULT_BLUEPRINT_BRAND_COLORS;

  const textForAudit = [
    "URL: (no existing website)",
    `BUILD_MODE: ${NEW_SITE_BUILD}`,
    "",
    `Company Name: ${companyName}`,
    `Service Type: ${serviceType}`,
    `Primary Location: ${location}`,
    `Brand Colors: ${brandColors.join(", ")}`,
    businessGoals ? `Business Goals: ${businessGoals}` : "",
    referenceLinks ? `Reference Links / Inspiration: ${referenceLinks}` : "",
    "",
    "There is NO existing website to scrape or redesign.",
    "Generate a complete landing page from scratch — hero, utility bar, services, testimonials, inline CTA form, footer.",
    "Invent professional, conversion-focused copy appropriate for this trade and city.",
    "No verified scraped_images — use trade-appropriate Unsplash URLs per system instructions (AI Image Researcher). Apply cinematic filter/overlay styling.",
    "Use a prominent tel: CTA with a placeholder callback number if none is provided.",
  ]
    .filter(Boolean)
    .join("\n");

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
  const url = String(body?.url ?? body?.websiteUrl ?? body?.website_url ?? "").trim();
  const buildMode = String(body?.build_mode ?? body?.buildMode ?? "").trim().toUpperCase();
  const hasExistingSite =
    body?.has_existing_site === true ||
    body?.hasExistingSite === true ||
    String(body?.has_existing_site ?? "").toLowerCase() === "true";
  const primaryChange = String(
    body?.primary_change ?? body?.primaryChange ?? body?.change_request ?? ""
  ).trim();
  const businessGoals = String(
    body?.business_goals ?? body?.businessGoals ?? body?.goals ?? ""
  ).trim();
  const referenceLinks = String(
    body?.reference_links ?? body?.referenceLinks ?? body?.references ?? ""
  ).trim();

  return {
    companyName,
    serviceType,
    location,
    url,
    buildMode,
    hasExistingSite,
    primaryChange,
    businessGoals,
    referenceLinks,
  };
}

export function normalizeBlueprintRequest(body) {
  const fields = readBlueprintFields(body);
  const {
    companyName,
    serviceType,
    location,
    url,
    buildMode,
    hasExistingSite,
    primaryChange,
    businessGoals,
    referenceLinks,
  } = fields;

  const isBlueprintForm =
    buildMode === NEW_SITE_BUILD ||
    body?.blueprint === true ||
    body?.blueprint === "1" ||
    typeof body?.has_existing_site === "boolean" ||
    (!url && companyName && serviceType && location);

  if (!isBlueprintForm && !hasExistingSite && !buildMode) {
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

  if (hasExistingSite) {
    if (!url || url.length < 4) {
      return { isBlueprint: true, error: "Please enter your existing website URL." };
    }
    return {
      isBlueprint: true,
      hasExistingSite: true,
      existingSite: {
        websiteUrl: url,
        primaryChange,
        companyName,
        serviceType,
        location,
      },
    };
  }

  const visionExplicit =
    body?.has_existing_site === false ||
    body?.hasExistingSite === false ||
    String(body?.has_existing_site ?? "").toLowerCase() === "false";

  if (visionExplicit && businessGoals.length < 10) {
    return {
      isBlueprint: true,
      error: "Please describe your business goals (a sentence or two is fine).",
    };
  }

  return {
    isBlueprint: true,
    hasExistingSite: false,
    blueprint: {
      companyName,
      serviceType,
      location,
      businessGoals,
      referenceLinks,
    },
  };
}
