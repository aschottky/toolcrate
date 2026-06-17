import { apiUrl } from "../scripts/api-config.js";

const loadingEl = document.getElementById("loading-state");
const successContent = document.getElementById("success-content");
const successHeading = document.getElementById("success-heading");
const successMessage = document.getElementById("success-message");
const emailCta = document.getElementById("email-cta");
const errorState = document.getElementById("error-state");

const DEFAULT_MESSAGE =
  "We've received your payment and you'll hear from Alexander within 24 hours to kick things off.";

function showError() {
  loadingEl.hidden = true;
  successContent.hidden = true;
  errorState.hidden = false;
}

function showSuccess({ email }) {
  loadingEl.hidden = true;
  errorState.hidden = true;

  successHeading.textContent = "You're in!";
  successMessage.textContent = email
    ? `${DEFAULT_MESSAGE} Watch for an email at ${email}.`
    : DEFAULT_MESSAGE;

  if (email) {
    emailCta.href = `mailto:${encodeURIComponent(email)}`;
  }

  successContent.hidden = false;
}

async function init() {
  const sessionId = new URLSearchParams(window.location.search)
    .get("session_id")
    ?.trim();

  if (!sessionId) {
    window.location.replace("/");
    return;
  }

  try {
    const response = await fetch(
      apiUrl(
        `/api/checkout/session?session_id=${encodeURIComponent(sessionId)}`
      )
    );
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      showError();
      return;
    }

    showSuccess({ email: data.email || null });
  } catch {
    showError();
  }
}

init();
