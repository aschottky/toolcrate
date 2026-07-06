import { apiUrl, normalizeClientError } from "../scripts/api-config.js";

const introPanel = document.getElementById("try-intro");
const processingPanel = document.getElementById("try-processing");
const contactPanel = document.getElementById("try-contact");
const tryForm = document.getElementById("try-form");
const contactForm = document.getElementById("try-contact-form");
const hasSiteYes = document.getElementById("has-site-yes");
const hasSiteNo = document.getElementById("has-site-no");
const fieldsExisting = document.getElementById("try-fields-existing");
const fieldsFresh = document.getElementById("try-fields-fresh");
const urlInput = document.getElementById("try-url");
const changeInput = document.getElementById("try-change");
const goalsInput = document.getElementById("try-goals");
const refsInput = document.getElementById("try-refs");
const companyInput = document.getElementById("try-company");
const serviceInput = document.getElementById("try-service");
const locationInput = document.getElementById("try-location");
const emailInput = document.getElementById("try-email");
const formError = document.getElementById("try-form-error");
const contactError = document.getElementById("try-contact-error");
const processingTitle = document.getElementById("try-processing-title");
const processingSub = document.getElementById("try-processing-sub");
const contactSub = document.getElementById("try-contact-sub");
const previewHint = document.getElementById("try-hint");
const trySubmitBtn = document.getElementById("try-submit");
const contactSubmitBtn = document.getElementById("try-contact-submit");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PROCESSING_MS = 2400;

const HINT_EXISTING =
  "Alexander will audit your current site and design a high-conversion preview.";
const HINT_FRESH =
  "Alexander will research your niche and design a custom preview from scratch.";

let previewToken = null;
let leadCompany = null;
let hasExistingSite = false;
let isBusy = false;

function hasExistingSiteSelected() {
  return Boolean(hasSiteYes?.checked);
}

function syncSiteModeUi() {
  const existing = hasExistingSiteSelected();
  if (fieldsExisting) fieldsExisting.hidden = !existing;
  if (fieldsFresh) fieldsFresh.hidden = existing;
  if (urlInput) urlInput.required = existing;
  if (goalsInput) goalsInput.required = !existing;
  if (previewHint) {
    previewHint.textContent = existing ? HINT_EXISTING : HINT_FRESH;
  }
}

function setPanel(panel) {
  for (const el of [introPanel, processingPanel, contactPanel]) {
    if (!el) continue;
    el.hidden = el !== panel;
  }
}

function setFormError(message) {
  if (!formError) return;
  formError.textContent = message || "";
  formError.hidden = !message;
}

function setContactError(message) {
  if (!contactError) return;
  contactError.textContent = message || "";
  contactError.hidden = !message;
}

function setTrySubmitting(submitting) {
  isBusy = submitting;
  if (trySubmitBtn) {
    trySubmitBtn.disabled = submitting;
    trySubmitBtn.classList.toggle("is-loading", submitting);
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
  const remaining = MIN_PROCESSING_MS - (Date.now() - startedAt);
  if (remaining > 0) {
    await new Promise((resolve) => setTimeout(resolve, remaining));
  }
}

function showProcessing(companyName, existingSite) {
  leadCompany = companyName;
  hasExistingSite = existingSite;
  if (processingTitle) {
    processingTitle.innerHTML = existingSite
      ? `Auditing <strong>${companyName}</strong>…`
      : `Designing <strong>${companyName}</strong>…`;
  }
  if (processingSub) {
    processingSub.textContent = existingSite
      ? "Alexander is reviewing your current site and conversion gaps."
      : "Alexander is researching your niche and mapping your preview.";
  }
  if (contactSub) {
    contactSub.textContent = existingSite
      ? "Your site audit is in progress. Add your email so Alexander can deliver your preview personally."
      : "Your preview is taking shape. Add your email so Alexander can deliver it personally.";
  }
  setPanel(processingPanel);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function showContact() {
  setPanel(contactPanel);
  emailInput?.focus();
}

function normalizeWebsiteInput(raw) {
  const value = raw.trim();
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  return `https://${value}`;
}

async function startPreviewRequest(payload) {
  const startedAt = Date.now();
  showProcessing(payload.companyName, payload.hasExistingSite);

  const response = await fetch(apiUrl("/api/public-redesign"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      blueprint: true,
      ...payload,
    }),
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

  if (data.token) {
    previewToken = data.token;
    leadCompany = data.company_name || payload.companyName;
    hasExistingSite = data.has_existing_site === true;
    return data.token;
  }

  throw new Error("Something went wrong. Please try again.");
}

for (const input of [hasSiteYes, hasSiteNo]) {
  input?.addEventListener("change", syncSiteModeUi);
}
syncSiteModeUi();

tryForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (isBusy) return;

  setFormError("");
  const existingSite = hasExistingSiteSelected();
  const companyName = companyInput?.value.trim() || "";
  const serviceType = serviceInput?.value.trim() || "";
  const location = locationInput?.value.trim() || "";
  const url = normalizeWebsiteInput(urlInput?.value || "");
  const primaryChange = changeInput?.value.trim() || "";
  const businessGoals = goalsInput?.value.trim() || "";
  const referenceLinks = refsInput?.value.trim() || "";

  if (companyName.length < 2) {
    setFormError("Please enter your company name.");
    companyInput?.focus();
    return;
  }
  if (serviceType.length < 2) {
    setFormError("Please enter your service type.");
    serviceInput?.focus();
    return;
  }
  if (location.length < 2) {
    setFormError("Please enter your location.");
    locationInput?.focus();
    return;
  }

  if (existingSite) {
    if (url.length < 8) {
      setFormError("Please enter your existing website URL.");
      urlInput?.focus();
      return;
    }
  } else if (businessGoals.length < 10) {
    setFormError("Please describe your business goals (a sentence or two is fine).");
    goalsInput?.focus();
    return;
  }

  const payload = {
    has_existing_site: existingSite,
    company_name: companyName,
    service_type: serviceType,
    location,
  };

  if (existingSite) {
    payload.url = url;
    if (primaryChange) payload.primary_change = primaryChange;
  } else {
    payload.business_goals = businessGoals;
    if (referenceLinks) payload.reference_links = referenceLinks;
  }

  setTrySubmitting(true);

  try {
    await startPreviewRequest({ ...payload, companyName, hasExistingSite: existingSite });
    showContact();
  } catch (error) {
    setPanel(introPanel);
    setFormError(normalizeClientError(error.message || ""));
  } finally {
    setTrySubmitting(false);
  }
});

contactForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (isBusy || !previewToken) return;

  setContactError("");
  const email = emailInput?.value.trim() || "";

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
      }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      setContactError(data.error || "Could not save your details. Please try again.");
      return;
    }

    try {
      sessionStorage.setItem("toolcrate_submit_email", email);
      sessionStorage.setItem("toolcrate_blueprint_mode", "1");
      sessionStorage.setItem("toolcrate_blueprint_company", leadCompany || "");
      sessionStorage.setItem(
        "toolcrate_has_existing_site",
        hasExistingSite ? "1" : "0"
      );
    } catch {
      /* private browsing */
    }

    const companyParam = encodeURIComponent(leadCompany || "");
    const siteParam = hasExistingSite ? "1" : "0";
    window.location.href = `${previewPathFor(previewToken)}&confirmed=1&blueprint=1&has_site=${siteParam}&email=${encodeURIComponent(email)}&company=${companyParam}`;
  } catch (error) {
    setContactError(normalizeClientError(error.message || ""));
  } finally {
    setContactSubmitting(false);
  }
});
