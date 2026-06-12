import { apiUrl, normalizeClientError } from "../scripts/api-config.js";

const form = document.getElementById("try-form");
const emailInput = document.getElementById("email-input");
const input = document.getElementById("website-input");
const submitBtn = document.getElementById("submit-btn");
const formError = document.getElementById("form-error");
const splash = document.getElementById("splash");
const splashError = document.getElementById("splash-error");
const existingPreviewLink = document.getElementById("existing-preview-link");
const newDesignLink = document.getElementById("new-design-link");
const variationSuccess = document.getElementById("variation-success");

// Remembered from the duplicate submission so the $9 checkout knows
// which domain/email to attach as session metadata.
let lastSubmission = null;

/** Client-side mirror of server/url-utils.js — root domain only, lowercased. */
function normalizeRootDomain(value) {
  const trimmed = String(value || "").trim().toLowerCase();
  if (!trimmed) return null;

  const withProtocol = /^[a-z][a-z0-9+.-]*:\/\//.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  try {
    const { hostname } = new URL(withProtocol);
    const domain = hostname.replace(/^www\./, "").replace(/\.+$/, "");
    return domain || null;
  } catch {
    return null;
  }
}

function previewLinkFor(token) {
  // /try/ and /preview/ are sibling pages — same origin in dev and prod.
  return new URL(
    `../preview/?t=${encodeURIComponent(token)}`,
    window.location.href
  ).toString();
}

function setError(message) {
  formError.textContent = message || "";
}

function setSubmitting(submitting) {
  submitBtn.disabled = submitting;
  submitBtn.textContent = submitting
    ? "Starting your preview…"
    : "Generate My Free Preview →";
}

function showSplash(token) {
  existingPreviewLink.href = previewLinkFor(token);
  splash.hidden = false;
  requestAnimationFrame(() => splash.classList.add("is-visible"));
}

let startingCheckout = false;

// "$9 New Design Variation" → Stripe Checkout (session created server-side
// with domain/email metadata; the webhook queues the generation after payment).
newDesignLink.addEventListener("click", async (event) => {
  event.preventDefault();
  if (startingCheckout || !lastSubmission) return;

  startingCheckout = true;
  splashError.hidden = true;
  const originalLabel = newDesignLink.textContent;
  newDesignLink.textContent = "Opening secure checkout…";

  try {
    const response = await fetch(apiUrl("/api/variation-checkout"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(lastSubmission),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.url) {
      throw new Error(data.error || "Could not start checkout. Please try again.");
    }

    window.location.href = data.url;
  } catch (error) {
    splashError.textContent = normalizeClientError(error.message || "");
    splashError.hidden = false;
    newDesignLink.textContent = originalLabel;
    startingCheckout = false;
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  setError("");

  const email = emailInput.value.trim();
  const domain = normalizeRootDomain(input.value);

  if (!email || !email.includes("@")) {
    setError("Please enter your email address.");
    emailInput.focus();
    return;
  }

  if (!domain || !domain.includes(".")) {
    setError("Please enter a valid website, e.g. yourbusiness.com");
    input.focus();
    return;
  }

  input.value = domain;
  lastSubmission = { domain, email };
  setSubmitting(true);

  try {
    const response = await fetch(apiUrl("/api/public-redesign"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: domain, email }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      setError(
        data.error ||
          (response.status === 429
            ? "Too many requests — please try again in an hour."
            : "Something went wrong. Please try again.")
      );
      return;
    }

    if (data.duplicate || data.status === "exists") {
      showSplash(data.token);
      return;
    }

    // status: "generating" — the preview page's wait screen takes over.
    window.location.href = previewLinkFor(data.token);
  } catch (error) {
    setError(normalizeClientError(error.message || ""));
  } finally {
    setSubmitting(false);
  }
});

// Back from a successful $9 variation checkout
// (success_url: /try/?variation=success&session_id=...).
if (new URLSearchParams(window.location.search).get("variation") === "success") {
  variationSuccess.hidden = false;
}
