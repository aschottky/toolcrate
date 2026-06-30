import { apiUrl, normalizeClientError } from "../scripts/api-config.js";

const introPanel = document.getElementById("blueprint-intro");
const processingPanel = document.getElementById("blueprint-processing");
const contactPanel = document.getElementById("blueprint-contact");
const blueprintForm = document.getElementById("blueprint-form");
const contactForm = document.getElementById("blueprint-contact-form");
const companyInput = document.getElementById("blueprint-company");
const serviceInput = document.getElementById("blueprint-service");
const locationInput = document.getElementById("blueprint-location");
const emailInput = document.getElementById("blueprint-email");
const phoneInput = document.getElementById("blueprint-phone");
const formError = document.getElementById("blueprint-form-error");
const contactError = document.getElementById("blueprint-contact-error");
const processingTitle = document.getElementById("blueprint-processing-title");
const blueprintSubmitBtn = document.getElementById("blueprint-submit");
const contactSubmitBtn = document.getElementById("blueprint-contact-submit");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PROCESSING_MS = 2400;

let previewToken = null;
let blueprintCompany = null;
let isBusy = false;

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

function setBlueprintSubmitting(submitting) {
  isBusy = submitting;
  if (blueprintSubmitBtn) {
    blueprintSubmitBtn.disabled = submitting;
    blueprintSubmitBtn.classList.toggle("is-loading", submitting);
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

function showProcessing(companyName) {
  blueprintCompany = companyName;
  if (processingTitle) {
    processingTitle.innerHTML = `Blueprinting <strong>${companyName}</strong>…`;
  }
  setPanel(processingPanel);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function showContact() {
  setPanel(contactPanel);
  emailInput?.focus();
}

async function startBlueprint({ companyName, serviceType, location }) {
  const startedAt = Date.now();
  showProcessing(companyName);

  const response = await fetch(apiUrl("/api/public-redesign"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      build_mode: "NEW_SITE_BUILD",
      company_name: companyName,
      service_type: serviceType,
      location,
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
    blueprintCompany = data.company_name || companyName;
    return data.token;
  }

  throw new Error("Something went wrong. Please try again.");
}

blueprintForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (isBusy) return;

  setFormError("");
  const companyName = companyInput?.value.trim() || "";
  const serviceType = serviceInput?.value.trim() || "";
  const location = locationInput?.value.trim() || "";

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

  setBlueprintSubmitting(true);

  try {
    await startBlueprint({ companyName, serviceType, location });
    showContact();
  } catch (error) {
    setPanel(introPanel);
    setFormError(normalizeClientError(error.message || ""));
  } finally {
    setBlueprintSubmitting(false);
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
      setContactError(data.error || "Could not save your details. Please try again.");
      return;
    }

    try {
      sessionStorage.setItem("toolcrate_submit_email", email);
      sessionStorage.setItem("toolcrate_blueprint_mode", "1");
      sessionStorage.setItem("toolcrate_blueprint_company", blueprintCompany || "");
    } catch {
      /* private browsing */
    }

    const companyParam = encodeURIComponent(blueprintCompany || "");
    window.location.href = `${previewPathFor(previewToken)}&confirmed=1&blueprint=1&email=${encodeURIComponent(email)}&company=${companyParam}`;
  } catch (error) {
    setContactError(normalizeClientError(error.message || ""));
  } finally {
    setContactSubmitting(false);
  }
});
