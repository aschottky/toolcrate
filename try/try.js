import { apiUrl, normalizeClientError } from "../scripts/api-config.js";

const form = document.getElementById("try-form");
const firstNameInput = document.getElementById("first-name-input");
const emailInput = document.getElementById("email-input");
const input = document.getElementById("website-input");
const submitBtn = document.getElementById("submit-btn");
const formError = document.getElementById("form-error");
const splash = document.getElementById("splash");
const splashError = document.getElementById("splash-error");
const existingPreviewLink = document.getElementById("existing-preview-link");
const newDesignLink = document.getElementById("new-design-link");
const variationSuccess = document.getElementById("variation-success");

// Instantly cold-email CTA (plain text — no query params; form collects everything on-page):
// https://usetoolcrate.com/try
//
// URL param pre-fill (?first=, ?email=, ?url=) is for HTML channels only (SMS, ManyChat, etc.).

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

function isValidWebsiteParam(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return false;

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const { hostname } = new URL(trimmed);
      return Boolean(hostname && hostname.includes("."));
    } catch {
      return false;
    }
  }

  const domain = trimmed.replace(/^www\./i, "").split(/[/?#]/)[0];
  return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i.test(domain);
}

function prefillFromQueryParams() {
  const params = new URLSearchParams(window.location.search);

  const first = params.get("first")?.trim();
  if (first) {
    firstNameInput.value = first;
  }

  const email = params.get("email")?.trim();
  if (email && email.includes("@")) {
    emailInput.value = email;
  }

  const urlParam = params.get("url")?.trim();
  if (urlParam && isValidWebsiteParam(urlParam)) {
    input.value = normalizeRootDomain(urlParam) || urlParam.replace(/^https?:\/\//i, "").split(/[/?#]/)[0];
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

  const firstNameRaw = firstNameInput.value.trim();
  const emailRaw = emailInput.value.trim();
  const domain = normalizeRootDomain(input.value);

  let email = null;
  if (emailRaw) {
    if (!emailRaw.includes("@")) {
      setError("Please enter a valid email address.");
      emailInput.focus();
      return;
    }
    email = emailRaw;
  }

  if (!domain || !domain.includes(".")) {
    setError("Please enter a valid website, e.g. yourbusiness.com");
    input.focus();
    return;
  }

  input.value = domain;
  lastSubmission = { domain, email: email || "" };
  setSubmitting(true);

  try {
    const response = await fetch(apiUrl("/api/public-redesign"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: domain,
        email: email || "",
        first_name: firstNameRaw || "",
      }),
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

prefillFromQueryParams();

// Back from a successful $9 variation checkout
// (success_url: /try/?variation=success&session_id=...).
if (new URLSearchParams(window.location.search).get("variation") === "success") {
  variationSuccess.hidden = false;
}
