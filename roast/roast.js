import { apiUrl } from "../scripts/api-config.js";
import { sanitizeRoastBulletList } from "../scripts/roast-bullet-sanitize.js";

const token = new URLSearchParams(window.location.search).get("t")?.trim();
const ROAST_FALLBACK =
  "Our AI had trouble reading that site. Double-check the URL and try again.";

function showError(title, detail) {
  document.body.innerHTML = `
    <div class="roast-page">
      <div class="roast-shell">
        <a href="../" class="roast-logo">ToolCrate</a>
        <div class="roast-card roast-card--error">
          <h1>${title}</h1>
          <p>${detail}</p>
        </div>
      </div>
    </div>
  `;
}

function renderBullets(bullets) {
  const list = document.getElementById("roast-list");
  list.innerHTML = "";

  const texts = sanitizeRoastBulletList(bullets, 6);
  texts.forEach((text) => {
    const li = document.createElement("li");
    li.textContent = text;
    list.appendChild(li);
  });
}

function showResults(bullets) {
  document.getElementById("loader").hidden = true;
  document.getElementById("roast-results").hidden = false;

  if (bullets?.length) {
    renderBullets(bullets);
  } else {
    document.getElementById("roast-list").innerHTML =
      `<li class="roast-fallback">${ROAST_FALLBACK}</li>`;
  }

  document.getElementById("preview-cta").href = `../preview-view/?t=${encodeURIComponent(token)}`;
}

async function loadRoast() {
  if (!token) {
    showError(
      "Missing link",
      "This link looks incomplete. Please use the exact link you were sent."
    );
    return;
  }

  try {
    const response = await fetch(
      apiUrl(`/api/preview-status?t=${encodeURIComponent(token)}`)
    );

    if (!response.ok) {
      showError("Preview not found", "This link does not exist or has expired.");
      return;
    }

    const status = await response.json();

    if (status.status !== "ready") {
      window.location.replace(`../preview/?t=${encodeURIComponent(token)}`);
      return;
    }

    showResults(status.roast_bullets);
  } catch {
    showError(
      "Could not load results",
      "The server may be waking up. Please refresh in 30 seconds."
    );
  }
}

loadRoast();
