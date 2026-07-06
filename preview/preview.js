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

const LOG_PREFIX = "[ToolCrate Preview]";

const loader = document.getElementById("loader");
const confirmed = document.getElementById("confirmed");
const confirmedTitle = document.getElementById("confirmed-title");
const confirmedCopy = document.getElementById("confirmed-copy");
const confirmedFooter = confirmed?.querySelector(".confirmed-footer");
const queueBadge = document.getElementById("queue-badge");
const queueBadgeText = document.getElementById("queue-badge-text");

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
  confirmedTitle.textContent = "Your Blueprint is in the works.";
  confirmedTitle.classList.remove("unavailable-title");
  if (confirmedCopy) {
    const emailBit =
      email && email !== "your email"
        ? ` We'll send your custom visual concept to <strong class="confirmed-email" id="confirmed-email">${escapeHtml(email)}</strong> shortly.`
        : " You'll receive your custom visual concept shortly.";
    confirmedCopy.innerHTML = `Alexander has received your request and is personally reviewing your site and goals.${emailBit}`;
  }
  if (confirmedFooter) {
    confirmedFooter.textContent =
      "You can close this tab — we'll email you when your Blueprint is ready.";
  }
}

function resolveHasExistingSite(apiValue) {
  if (typeof apiValue === "boolean") return apiValue;
  const fromQuery = params.get("has_site");
  if (fromQuery === "1") return true;
  if (fromQuery === "0") return false;
  try {
    const stored = sessionStorage.getItem("toolcrate_has_existing_site");
    if (stored === "1") return true;
    if (stored === "0") return false;
  } catch {
    /* private browsing */
  }
  return false;
}

function applyBlueprintConfirmationCopy(email, companyName, hasExistingSite) {
  confirmedTitle.textContent = "Got it.";
  confirmedTitle.classList.remove("unavailable-title");
  const action = hasExistingSite ? "auditing your site" : "mapping your new concept";
  if (confirmedCopy) {
    const emailBit =
      email && email !== "your email"
        ? ` We'll send your Blueprint to <strong class="confirmed-email" id="confirmed-email">${escapeHtml(email)}</strong> when it's ready.`
        : "";
    confirmedCopy.innerHTML = `Alexander is ${action} now. You'll see the Blueprint soon.${emailBit}`;
  }
  if (confirmedFooter) {
    confirmedFooter.textContent =
      "You can close this tab — we'll email you when your Blueprint is ready.";
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

function showSubmissionConfirmed({
  email,
  showQueue = true,
  buildMode,
  companyName,
  statusLabel,
  hasExistingSite,
}) {
  loader.hidden = true;
  confirmed.hidden = false;

  const resolvedEmail = resolveEmail(email);
  const isBlueprint = buildMode === "NEW_SITE_BUILD" || isBlueprintFlow || typeof hasExistingSite === "boolean";
  const existingSite = resolveHasExistingSite(hasExistingSite);

  if (isBlueprint) {
    applyBlueprintConfirmationCopy(resolvedEmail, resolveCompanyName(companyName), existingSite);
  } else {
    applyStandardConfirmationCopy(resolvedEmail);
  }

  if (showQueue && token) {
    const label =
      statusLabel ||
      (existingSite ? "Site Audit in Progress" : isBlueprint ? "Blueprint in Progress" : "Review in Progress");
    queueBadgeText.textContent = label;
    queueBadge.hidden = false;
  } else {
    queueBadge.hidden = true;
  }

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
  const bridge = document.getElementById("confirmed-bridge");
  if (bridge) {
    bridge.innerHTML =
      'Questions? Email <a href="mailto:support@usetoolcrate.com" style="color:#c4b5fd;font-weight:600;text-decoration:none;">support@usetoolcrate.com</a>.';
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
        statusLabel: status.status_label,
        hasExistingSite: status.has_existing_site,
      });
      return;
    }

    if (status.status === "failed" || status.status === "redesign_failed") {
      // Blueprint submissions with contact on file — never show a dead-end error page.
      if (
        (status.build_mode === "NEW_SITE_BUILD" || status.has_existing_site) &&
        status.email
      ) {
        showSubmissionConfirmed({
          email: status.email,
          showQueue: false,
          buildMode: status.build_mode,
          companyName: status.company_name,
          statusLabel: status.status_label,
          hasExistingSite: status.has_existing_site,
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
      statusLabel: status.status_label,
      hasExistingSite: status.has_existing_site,
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
