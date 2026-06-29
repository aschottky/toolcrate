import { apiUrl } from "../scripts/api-config.js";

const token = new URLSearchParams(window.location.search).get("t")?.trim();

function showError(title, detail) {
  document.body.innerHTML = `
    <div class="view-error">
      <h1>${title}</h1>
      <p>${detail}</p>
    </div>
  `;
}

function renderHtml(html) {
  document.getElementById("loader").hidden = true;

  const gate = document.createElement("div");
  gate.className = "preview-gate";
  gate.innerHTML = '<div class="spinner" aria-hidden="true"></div>';
  document.body.appendChild(gate);

  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);

  const iframe = document.createElement("iframe");
  iframe.className = "preview-frame";
  iframe.title = "Your custom design preview";
  iframe.src = url;

  iframe.addEventListener("load", () => {
    URL.revokeObjectURL(url);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        gate.classList.add("is-hidden");
        setTimeout(() => gate.remove(), 350);
      });
    });
  });

  document.body.appendChild(iframe);
}

async function loadPreview() {
  if (!token) {
    showError(
      "Missing preview link",
      "This link looks incomplete. Please use the exact link you were sent."
    );
    return;
  }

  try {
    const response = await fetch(apiUrl(`/api/preview/${encodeURIComponent(token)}`));

    if (response.status === 202) {
      window.location.replace(`../preview/?t=${encodeURIComponent(token)}`);
      return;
    }

    if (!response.ok) {
      showError(
        "Preview not found",
        (await response.text().catch(() => "")) ||
          "This preview link does not exist or has expired."
      );
      return;
    }

    renderHtml(await response.text());
  } catch {
    showError(
      "Could not load preview",
      "The preview server may be waking up — please refresh in 30 seconds."
    );
  }
}

loadPreview();
