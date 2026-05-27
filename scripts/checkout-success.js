const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

let landingContent;
let successView;
let processingPanel;
let readyPanel;
let fallbackPanel;
let progressBar;
let fallbackError;
let fallbackForm;
let downloadAgainBtn;

let latestPdfBlob = null;
let latestPdfUrl = null;
let listenersBound = false;

export function initCheckoutSuccess() {
  landingContent = document.getElementById("landing-content");

  const params = new URLSearchParams(window.location.search);
  if (params.get("success") !== "true") return;

  const sessionId = params.get("session_id")?.trim();
  if (!sessionId) return;

  mountSuccessView();
  bindListeners();
  showSuccessView();
  startAuditFetch(sessionId);
}

function mountSuccessView() {
  if (document.getElementById("checkout-success")) return;

  const template = document.getElementById("checkout-success-template");
  const mount = document.getElementById("checkout-success-mount");
  if (!template || !mount) return;

  const fragment = template.content.cloneNode(true);
  mount.replaceChildren(fragment);

  successView = document.getElementById("checkout-success");
  processingPanel = document.getElementById("success-processing");
  readyPanel = document.getElementById("success-ready");
  fallbackPanel = document.getElementById("success-fallback");
  progressBar = document.getElementById("success-progress-bar");
  fallbackError = document.getElementById("fallback-error");
  fallbackForm = document.getElementById("fallback-form");
  downloadAgainBtn = document.getElementById("download-again-btn");
}

function bindListeners() {
  if (listenersBound) return;
  listenersBound = true;

  fallbackForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const websiteUrl = document.getElementById("fallback-url")?.value?.trim();
    if (!websiteUrl) return;

    hideAllPanels();
    processingPanel.hidden = false;
    setProgress(15);
    fallbackError.hidden = true;

    try {
      const blob = await fetchAuditPdfManual(websiteUrl);
      triggerDownload(blob);
      showReadyState();
    } catch (error) {
      showFallbackState(error.message);
    }
  });

  downloadAgainBtn?.addEventListener("click", () => {
    if (latestPdfBlob) triggerDownload(latestPdfBlob);
  });
}

function showSuccessView() {
  landingContent?.setAttribute("hidden", "");
  document.title = "Processing Your Audit — Website Tear Down";
  hideAllPanels();
  processingPanel.hidden = false;
  setProgress(8);
}

function hideAllPanels() {
  if (!processingPanel) return;
  processingPanel.hidden = true;
  readyPanel.hidden = true;
  fallbackPanel.hidden = true;
}

async function startAuditFetch(sessionId) {
  setProgress(12);

  try {
    const blob = await fetchAuditPdfBySession(sessionId);
    setProgress(100);
    triggerDownload(blob);
    showReadyState();
  } catch (error) {
    showFallbackState(error.message, error.code);
  }
}

async function fetchAuditPdfBySession(sessionId) {
  const url = `${API_BASE}/api/audit-status?session_id=${encodeURIComponent(sessionId)}`;
  return fetchAuditPdf(url, { onProgress: simulateProgress });
}

async function fetchAuditPdfManual(websiteUrl) {
  const url = `${API_BASE}/api/audit-pdf`;
  return fetchAuditPdf(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ websiteUrl }),
    onProgress: simulateProgress,
  });
}

async function fetchAuditPdf(url, options = {}) {
  const { method = "GET", headers, body, onProgress } = options;
  onProgress?.(20);

  const response = await fetch(url, { method, headers, body });
  onProgress?.(55);

  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/pdf")) {
    onProgress?.(90);
    const blob = await response.blob();
    onProgress?.(100);
    return blob;
  }

  let payload = {};
  try {
    payload = await response.json();
  } catch {
    payload = { error: "Unexpected server response." };
  }

  const err = new Error(payload.error || "Could not generate your audit.");
  err.code = payload.code;
  throw err;
}

function simulateProgress() {
  const current = Number(progressBar?.style.width?.replace("%", "") || 8);
  const next = Math.min(current + 6 + Math.random() * 8, 92);
  setProgress(next);
}

function setProgress(percent) {
  if (progressBar) progressBar.style.width = `${percent}%`;
}

function triggerDownload(blob) {
  if (latestPdfUrl) URL.revokeObjectURL(latestPdfUrl);

  latestPdfBlob = blob;
  latestPdfUrl = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = latestPdfUrl;
  link.download = "Website-Audit.pdf";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function showReadyState() {
  hideAllPanels();
  readyPanel.hidden = false;
  document.title = "Your Audit is Ready — Website Tear Down";
}

function showFallbackState(message, code) {
  hideAllPanels();
  fallbackPanel.hidden = false;

  if (fallbackError) {
    fallbackError.hidden = false;
    fallbackError.textContent =
      message ||
      "Something went wrong pulling your website from checkout. Enter your URL below.";
  }

  if (code === "MISSING_WEBSITE_URL") {
    fallbackError.textContent =
      "We didn't receive your website URL at checkout. Enter it below and we'll run your audit now.";
  }

  document.title = "Enter Your Website URL — Website Tear Down";
}
