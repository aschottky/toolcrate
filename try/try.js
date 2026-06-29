import { apiUrl, normalizeClientError } from "../scripts/api-config.js";

const form = document.getElementById("try-form");
const trySuccess = document.getElementById("try-success");
const queueModal = document.getElementById("queue-modal");
const trySuccessEmail = document.getElementById("try-success-email");
const trySuccessUrl = document.getElementById("try-success-url");
const tryDuplicateUrl = document.getElementById("try-duplicate-url");
const viewRedesignLink = document.getElementById("view-redesign-link");
const pageSub = document.getElementById("page-sub");
const pageTitle = document.getElementById("page-title");
const tryFooterNote = document.getElementById("try-footer-note");
const firstNameInput = document.getElementById("first-name-input");
const emailInput = document.getElementById("email-input");
const input = document.getElementById("website-input");
const submitBtn = document.getElementById("submit-btn");
const submitLabel = submitBtn?.querySelector(".try-submit-label");
const formError = document.getElementById("form-error");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_SUBMIT_FEEDBACK_MS = 450;

let isSubmitting = false;

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

function isValidFirstName(value) {
  const name = String(value || "").trim();
  return name.length > 0 && !/[@.]/.test(name);
}

function isFormValid() {
  const domain = normalizeRootDomain(input.value);
  return (
    isValidFirstName(firstNameInput.value) &&
    EMAIL_RE.test(emailInput.value.trim()) &&
    Boolean(domain && domain.includes("."))
  );
}

function updateSubmitState() {
  submitBtn.disabled = isSubmitting || !isFormValid();
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

  updateSubmitState();
}

function previewViewLinkFor(token) {
  return new URL(
    `../preview-view/?t=${encodeURIComponent(token)}`,
    window.location.href
  ).toString();
}

function setError(message) {
  formError.textContent = message || "";
}

function setSubmitting(submitting) {
  isSubmitting = submitting;
  submitBtn.classList.toggle("is-loading", submitting);
  if (submitLabel) {
    submitLabel.textContent = submitting
      ? "Submitting your request…"
      : "Submit for Alexander's Review →";
  }
  updateSubmitState();
}

async function waitForSubmitFeedback(startedAt) {
  const elapsed = Date.now() - startedAt;
  const remaining = MIN_SUBMIT_FEEDBACK_MS - elapsed;
  if (remaining > 0) {
    await new Promise((resolve) => setTimeout(resolve, remaining));
  }
}

function hideFormForResultState() {
  form.hidden = true;
  pageSub.hidden = true;
  if (tryFooterNote) {
    tryFooterNote.hidden = true;
  }
  document.body.classList.add("is-success");
}

function showSuccessState(email, domain) {
  hideFormForResultState();
  trySuccess.hidden = false;
  if (pageTitle) {
    pageTitle.textContent = "Success! Your redesign is in the queue.";
  }
  if (trySuccessEmail) {
    trySuccessEmail.textContent = email;
  }
  if (trySuccessUrl) {
    trySuccessUrl.textContent = domain;
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function showDuplicateModal(domain, token, ready) {
  if (tryDuplicateUrl) {
    tryDuplicateUrl.textContent = domain;
  }
  if (viewRedesignLink) {
    if (ready && token) {
      viewRedesignLink.href = previewViewLinkFor(token);
      viewRedesignLink.hidden = false;
    } else {
      viewRedesignLink.hidden = true;
    }
  }
  queueModal.hidden = false;
  document.body.classList.add("modal-open");
  requestAnimationFrame(() => queueModal.classList.add("is-visible"));
}

for (const field of [firstNameInput, emailInput, input]) {
  field.addEventListener("input", updateSubmitState);
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  setError("");

  const firstNameRaw = firstNameInput.value.trim();
  const emailRaw = emailInput.value.trim();
  const domain = normalizeRootDomain(input.value);

  if (!isValidFirstName(firstNameRaw)) {
    setError("Please enter your first name.");
    firstNameInput.focus();
    return;
  }

  if (!EMAIL_RE.test(emailRaw)) {
    setError("Please enter a valid email address.");
    emailInput.focus();
    return;
  }

  const email = emailRaw;

  if (!domain || !domain.includes(".")) {
    setError("Please enter a valid website, e.g. yourbusiness.com");
    input.focus();
    return;
  }

  input.value = domain;
  const submitStartedAt = Date.now();
  setSubmitting(true);

  try {
    const response = await fetch(apiUrl("/api/public-redesign"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: domain,
        email,
        first_name: firstNameRaw,
      }),
    });

    const data = await response.json().catch(() => ({}));
    await waitForSubmitFeedback(submitStartedAt);

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
      showDuplicateModal(domain, data.token, Boolean(data.ready));
      return;
    }

    if (data.status === "received" || data.ok) {
      showSuccessState(email, domain);
      return;
    }

    setError("Something went wrong. Please try again.");
  } catch (error) {
    await waitForSubmitFeedback(submitStartedAt);
    setError(normalizeClientError(error.message || ""));
  } finally {
    setSubmitting(false);
  }
});

prefillFromQueryParams();
updateSubmitState();
