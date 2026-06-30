import { apiUrl, normalizeClientError } from "./api-config.js";

const introPanel = document.getElementById("hero-intro");
const processingPanel = document.getElementById("hero-processing");
const contactPanel = document.getElementById("hero-contact");
const urlForm = document.getElementById("hero-url-form");
const contactForm = document.getElementById("hero-contact-form");
const urlInput = document.getElementById("hero-url-input");
const emailInput = document.getElementById("hero-email-input");
const phoneInput = document.getElementById("hero-phone-input");
const urlError = document.getElementById("hero-form-error");
const contactError = document.getElementById("hero-contact-error");
const processingTitle = document.getElementById("hero-processing-title");
const urlSubmitBtn = document.getElementById("hero-url-submit");
const contactSubmitBtn = document.getElementById("hero-contact-submit");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PROCESSING_MS = 2800;

let previewToken = null;
let activeDomain = null;
let isBusy = false;

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

function isValidWebsite(value) {
  const domain = normalizeRootDomain(value);
  if (!domain || !domain.includes(".")) return false;
  return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i.test(domain);
}

function setPanel(panel) {
  for (const el of [introPanel, processingPanel, contactPanel]) {
    if (!el) continue;
    el.hidden = el !== panel;
  }
}

function setUrlError(message) {
  if (!urlError) return;
  urlError.textContent = message || "";
  urlError.hidden = !message;
}

function setContactError(message) {
  if (!contactError) return;
  contactError.textContent = message || "";
  contactError.hidden = !message;
}

function setUrlSubmitting(submitting) {
  isBusy = submitting;
  if (urlSubmitBtn) {
    urlSubmitBtn.disabled = submitting;
    urlSubmitBtn.classList.toggle("is-loading", submitting);
  }
}

function setContactSubmitting(submitting) {
  isBusy = submitting;
  if (contactSubmitBtn) {
    contactSubmitBtn.disabled = submitting;
    contactSubmitBtn.classList.toggle("is-loading", submitting);
  }
}

function previewPathFor(token) {
  return `/preview/?t=${encodeURIComponent(token)}`;
}

async function waitForProcessingBeat(startedAt) {
  const elapsed = Date.now() - startedAt;
  const remaining = MIN_PROCESSING_MS - elapsed;
  if (remaining > 0) {
    await new Promise((resolve) => setTimeout(resolve, remaining));
  }
}

function showProcessing(domain) {
  activeDomain = domain;
  if (processingTitle) {
    processingTitle.innerHTML = `Analyzing <strong>${domain}</strong>…`;
  }
  setPanel(processingPanel);
  document.getElementById("hero")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function showContact() {
  setPanel(contactPanel);
  emailInput?.focus();
}

async function startRedesign(domain) {
  const startedAt = Date.now();
  showProcessing(domain);

  const response = await fetch(apiUrl("/api/public-redesign"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: domain }),
  });

  const data = await response.json().catch(() => ({}));
  await waitForProcessingBeat(startedAt);

  if (!response.ok) {
    throw new Error(
      data.error ||
        (response.status === 429
          ? "Too many requests — please try again in an hour."
          : "Something went wrong. Please try again.")
    );
  }

  if (data.duplicate || data.status === "exists") {
    previewToken = data.token;
    if (data.ready) {
      window.location.href = previewPathFor(data.token);
      return null;
    }
    return data.token;
  }

  if (data.token) {
    previewToken = data.token;
    return data.token;
  }

  throw new Error("Something went wrong. Please try again.");
}

urlForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (isBusy) return;

  setUrlError("");
  const domain = normalizeRootDomain(urlInput?.value);

  if (!isValidWebsite(urlInput?.value)) {
    setUrlError("Please enter a valid website, e.g. smithplumbing.com");
    urlInput?.focus();
    return;
  }

  if (urlInput) urlInput.value = domain;
  setUrlSubmitting(true);

  try {
    const token = await startRedesign(domain);
    if (token === null) return;
    showContact();
  } catch (error) {
    setPanel(introPanel);
    setUrlError(normalizeClientError(error.message || ""));
  } finally {
    setUrlSubmitting(false);
  }
});

contactForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (isBusy || !previewToken) return;

  setContactError("");
  const email = emailInput?.value.trim() || "";
  const phone = phoneInput?.value.trim() || "";

  if (!EMAIL_RE.test(email)) {
    setContactError("Please enter a valid email address.");
    emailInput?.focus();
    return;
  }

  setContactSubmitting(true);

  try {
    const response = await fetch(apiUrl("/api/public-redesign/contact"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: previewToken,
        email,
        phone: phone || undefined,
      }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      setContactError(
        data.error ||
          "Could not save your details. Please try again."
      );
      return;
    }

    try {
      sessionStorage.setItem("toolcrate_submit_email", email);
    } catch {
      /* private browsing */
    }

    window.location.href = `${previewPathFor(previewToken)}&confirmed=1&email=${encodeURIComponent(email)}`;
  } catch (error) {
    setContactError(normalizeClientError(error.message || ""));
  } finally {
    setContactSubmitting(false);
  }
});
