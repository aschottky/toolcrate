import { apiUrl } from "../scripts/api-config.js";

const token = new URLSearchParams(window.location.search).get("t")?.trim();
const params = new URLSearchParams(window.location.search);

const isBlueprintFlow =
  params.get("blueprint") === "1" ||
  (() => {
    try {
      return sessionStorage.getItem("toolcrate_blueprint_mode") === "1";
    } catch {
      return false;
    }
  })();

const isSubmissionConfirmed =
  params.get("confirmed") === "1" ||
  isBlueprintFlow ||
  Boolean(
    (() => {
      try {
        return sessionStorage.getItem("toolcrate_submit_email")?.trim();
      } catch {
        return "";
      }
    })()
  );

const STRATEGY_PHONE_E164 = "+18188699928";
const LOG_PREFIX = "[ToolCrate Preview]";

const loader = document.getElementById("loader");
const confirmed = document.getElementById("confirmed");
const confirmedTitle = document.getElementById("confirmed-title");
const confirmedCopy = document.getElementById("confirmed-copy");
const queueBadge = document.getElementById("queue-badge");
const queueBadgeText = document.getElementById("queue-badge-text");
const saveStrategyBtn = document.getElementById("save-strategy-btn");

/** Stable 2–5 queue depth from token (social proof, not live data). */
function queueSitesAhead(previewToken) {
  let sum = 0;
  for (let i = 0; i < previewToken.length; i += 1) {
    sum += previewToken.charCodeAt(i);
  }
  return 2 + (sum % 4);
}

function resolveCompanyName(apiCompany) {
  const fromQuery = params.get("company")?.trim() || "";
  const fromStorage = (() => {
    try {
      return sessionStorage.getItem("toolcrate_blueprint_company")?.trim() || "";
    } catch {
      return "";
    }
  })();
  return apiCompany || fromStorage || fromQuery || "your business";
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function applyStandardConfirmationCopy(email) {
  confirmedTitle.textContent = "URL Received. I'm on it.";
  confirmedTitle.classList.remove("unavailable-title");
  if (confirmedCopy) {
    confirmedCopy.innerHTML = `I've received your site details and I'm personally reviewing your conversion structure now. I'll have your custom redesign preview and audit sent to <strong class="confirmed-email" id="confirmed-email">${escapeHtml(email)}</strong> within the next 2 hours.`;
  }
}

function applyBlueprintConfirmationCopy(email, companyName) {
  confirmedTitle.textContent = "Blueprint Initiated.";
  confirmedTitle.classList.remove("unavailable-title");
  if (confirmedCopy) {
    confirmedCopy.innerHTML = `I'm sketching out a custom conversion structure for <strong class="confirmed-company">${escapeHtml(companyName)}</strong> now. I'll send your brand-new site concept and strategy to <strong class="confirmed-email" id="confirmed-email">${escapeHtml(email)}</strong> within 2 hours.`;
  }
}
function resolveEmail(apiEmail) {
  const fromStorage = (() => {
    try {
      return sessionStorage.getItem("toolcrate_submit_email")?.trim() || "";
    } catch {
      return "";
    }
  })();
  const fromQuery = params.get("email")?.trim() || "";
  return apiEmail || fromStorage || fromQuery || "your email";
}

function showLoaderError(title, detail) {
  loader.hidden = false;
  loader.classList.add("error");
  loader.innerHTML = `<h1>${title}</h1><p>${detail}</p>`;
  confirmed.hidden = true;
}

function downloadAlexanderVCard() {
  const vcard = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    "FN:Alexander Schottky",
    "ORG:ToolCrate",
    `TEL;TYPE=CELL:${STRATEGY_PHONE_E164}`,
    "EMAIL:support@usetoolcrate.com",
    "URL:https://usetoolcrate.com",
    "NOTE:ToolCrate strategy line — website conversion specialist",
    "END:VCARD",
  ].join("\r\n");

  const blob = new Blob([vcard], { type: "text/vcard;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "Alexander-Schottky-ToolCrate.vcf";
  link.click();
  URL.revokeObjectURL(url);
}

function showSubmissionConfirmed({
  email,
  showQueue = true,
  buildMode,
  companyName,
}) {
  loader.hidden = true;
  confirmed.hidden = false;

  const resolvedEmail = resolveEmail(email);
  const isBlueprint = buildMode === "NEW_SITE_BUILD" || isBlueprintFlow;

  if (isBlueprint) {
    applyBlueprintConfirmationCopy(resolvedEmail, resolveCompanyName(companyName));
  } else {
    applyStandardConfirmationCopy(resolvedEmail);
  }

  if (showQueue && token) {
    const ahead = queueSitesAhead(token);
    queueBadgeText.textContent = `Currently reviewing: ${ahead} site${ahead === 1 ? "" : "s"} ahead of you`;
    queueBadge.hidden = false;
  }

  saveStrategyBtn?.addEventListener("click", downloadAlexanderVCard);

  console.log(`${LOG_PREFIX} submission confirmed`, {
    token: token?.slice(0, 8),
    email: resolvedEmail,
    blueprint: isBlueprint,
  });
}

function showRedesignUnavailable() {
  loader.hidden = true;
  confirmed.hidden = false;
  queueBadge.hidden = true;

  confirmedTitle.textContent = "Redesign Unavailable";
  confirmedTitle.classList.add("unavailable-title");

  const copyBlocks = confirmed.querySelectorAll(".confirmed-copy");
  if (copyBlocks[0]) {
    copyBlocks[0].textContent =
      "We hit a snag building your visual redesign. Your site analysis is still accurate, and Alexander has been notified.";
  }
  if (copyBlocks[1]) {
    copyBlocks[1].textContent =
      "If you're in a rush, call my strategy line below. My assistant Rachel can prioritize your audit or get you on my calendar for a deep dive.";
  }
}

async function fetchPreviewStatus() {
  const response = await fetch(
    apiUrl(`/api/preview-status?t=${encodeURIComponent(token)}`)
  );
  if (!response.ok) {
    throw new Error("Preview not found.");
  }
  return response.json();
}

async function loadPreview() {
  if (!token) {
    showLoaderError(
      "Missing preview link",
      "This link looks incomplete. Please use the exact link you were sent."
    );
    return;
  }

  try {
    const status = await fetchPreviewStatus();

    if (status.status === "ready") {
      window.location.href = `../roast/?t=${encodeURIComponent(token)}`;
      return;
    }

    // Post-submit flow: always confirm receipt — redesign runs in the background.
    if (isSubmissionConfirmed) {
      showSubmissionConfirmed({
        email: status.email,
        showQueue: status.status !== "failed" && status.status !== "redesign_failed",
        buildMode: status.build_mode,
        companyName: status.company_name,
      });
      return;
    }

    if (status.status === "failed" || status.status === "redesign_failed") {
      // Blueprint submissions with contact on file — never show a dead-end error page.
      if (status.build_mode === "NEW_SITE_BUILD" && status.email) {
        showSubmissionConfirmed({
          email: status.email,
          showQueue: false,
          buildMode: status.build_mode,
          companyName: status.company_name,
        });
        return;
      }
      showRedesignUnavailable();
      return;
    }

    showSubmissionConfirmed({
      email: status.email,
      showQueue: true,
      buildMode: status.build_mode,
      companyName: status.company_name,
    });
  } catch (error) {
    console.error(`${LOG_PREFIX} load failed`, error?.message || error);
    showLoaderError(
      "Could not load preview",
      "The server may be waking up. Please refresh in 30 seconds."
    );
  }
}

loadPreview();
