import { apiUrl } from "../scripts/api-config.js";

const token = new URLSearchParams(window.location.search).get("t")?.trim();
const params = new URLSearchParams(window.location.search);

const STRATEGY_PHONE_DISPLAY = "(818) 869-9928";
const STRATEGY_PHONE_E164 = "+18188699928";
const LOG_PREFIX = "[ToolCrate Preview]";

const loader = document.getElementById("loader");
const confirmed = document.getElementById("confirmed");
const confirmedTitle = document.getElementById("confirmed-title");
const confirmedEmail = document.getElementById("confirmed-email");
const queueBadge = document.getElementById("queue-badge");
const queueBadgeText = document.getElementById("queue-badge-text");
const textAlexanderBtn = document.getElementById("text-alexander-btn");
const addContactBtn = document.getElementById("add-contact-btn");

/** Stable 2–5 queue depth from token (social proof, not live data). */
function queueSitesAhead(previewToken) {
  let sum = 0;
  for (let i = 0; i < previewToken.length; i += 1) {
    sum += previewToken.charCodeAt(i);
  }
  return 2 + (sum % 4);
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

function showSubmissionConfirmed({ email, websiteUrl, showQueue = true }) {
  loader.hidden = true;
  confirmed.hidden = false;

  confirmedEmail.textContent = email;

  if (showQueue && token) {
    const ahead = queueSitesAhead(token);
    queueBadgeText.textContent = `Currently reviewing: ${ahead} site${ahead === 1 ? "" : "s"} ahead of you`;
    queueBadge.hidden = false;
  }

  const smsBody = websiteUrl
    ? `Hi Alexander — I just submitted ${websiteUrl} for a ToolCrate redesign.`
    : "Hi Alexander — I just submitted my site for a ToolCrate redesign.";
  textAlexanderBtn.href = `sms:${STRATEGY_PHONE_E164}?body=${encodeURIComponent(smsBody)}`;

  addContactBtn?.addEventListener("click", downloadAlexanderVCard);

  console.log(`${LOG_PREFIX} submission confirmed`, { token: token?.slice(0, 8), email });
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
      "If you're in a rush, reach out on the strategy line below — Alexander can help directly.";
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

    if (status.status === "failed" || status.status === "redesign_failed") {
      showRedesignUnavailable();
      return;
    }

    showSubmissionConfirmed({
      email: resolveEmail(status.email),
      websiteUrl: status.website_url,
      showQueue: true,
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
