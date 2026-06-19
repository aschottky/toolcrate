import { apiUrl } from "../scripts/api-config.js";

const form = document.getElementById("apply-form");
const successMsg = document.getElementById("success-msg");
const errorMsg = document.getElementById("error-msg");
const submitBtn = form?.querySelector('button[type="submit"]');

form?.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!submitBtn) return;

  errorMsg.hidden = true;

  const originalText = submitBtn.textContent;
  submitBtn.disabled = true;
  submitBtn.textContent = "Submitting...";

  const payload = {
    name: form.name.value.trim(),
    website: form.website.value.trim(),
    businessType: form.businessType.value.trim(),
    frustration: form.frustration.value.trim(),
    timeline: form.timeline.value,
  };

  try {
    const response = await fetch(apiUrl("/api/apply"), {
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
