import { apiUrl } from "../scripts/api-config.js";

function showError(title, detail) {
  const loader = document.getElementById("loader");
  loader.classList.add("error");
  loader.innerHTML = `<h1>${title}</h1><p>${detail}</p>`;
}

async function loadPreview() {
  const token = new URLSearchParams(window.location.search).get("t")?.trim();

  if (!token) {
    showError(
      "Missing preview link",
      "This link looks incomplete. Please use the exact link you were sent."
    );
    return;
  }

  try {
    const response = await fetch(apiUrl(`/api/preview/${encodeURIComponent(token)}`));

    if (!response.ok) {
      const message = await response.text().catch(() => "");
      showError(
        "Preview not found",
        message || "This preview link does not exist or has expired."
      );
      return;
    }

    const html = await response.text();

    // Replace this loader document with the generated landing page.
    document.open();
    document.write(html);
    document.close();
  } catch {
    showError(
      "Could not load preview",
      "The preview server may be waking up — please refresh in 30 seconds."
    );
  }
}

loadPreview();
