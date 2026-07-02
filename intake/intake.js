import { apiUrl } from "../scripts/api-config.js";

const form = document.getElementById("intake-form");
const successMsg = document.getElementById("success-msg");
const errorMsg = document.getElementById("error-msg");
const submitBtn = form?.querySelector('button[type="submit"]');
const websiteInput = form?.website;

function normalizeWebsiteInput(value) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return "";

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const parsed = new URL(withProtocol);
    if (!["http:", "https:"].includes(parsed.protocol)) return null;
    if (!parsed.hostname.includes(".")) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

websiteInput?.addEventListener("input", () => {
  websiteInput.setCustomValidity("");
});

form?.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!submitBtn) return;

  errorMsg.hidden = true;

  const normalizedWebsite = normalizeWebsiteInput(form.website.value);
  if (!normalizedWebsite) {
    form.website.setCustomValidity(
      "Enter a valid website, e.g. yourbusiness.com or https://yourbusiness.com"
    );
    form.website.reportValidity();
    return;
  }

  const originalText = submitBtn.textContent;
  submitBtn.disabled = true;
  submitBtn.textContent = "Submitting...";

  const payload = {
    name: form.name.value.trim(),
    businessName: form.businessName.value.trim(),
    website: normalizedWebsite,
    description: form.description.value.trim(),
    idealCustomer: form.idealCustomer.value.trim(),
    primaryGoal: form.primaryGoal.value,
    frustration: form.frustration.value.trim(),
    hasLogo: form.hasLogo.value,
    additionalNotes: form.additionalNotes.value.trim(),
  };

  try {
    const response = await fetch(apiUrl("/api/intake"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      form.hidden = true;
      successMsg.hidden = false;
      return;
    }

    errorMsg.hidden = false;
    submitBtn.disabled = false;
    submitBtn.textContent = originalText;
  } catch {
    errorMsg.hidden = false;
    submitBtn.disabled = false;
    submitBtn.textContent = originalText;
  }
});
