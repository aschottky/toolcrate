const CATEGORY_LABELS = {
  seo: "SEO",
  leadCapture: "Lead Capture",
  mobileFriendliness: "Mobile-Friendliness",
};

export function initAuditApp({ isDevPage = false } = {}) {
  const form = document.getElementById("audit-form");
  const urlInput = document.getElementById("website-url");
  const runBtn = document.getElementById("run-audit-btn");
  const statusEl = document.getElementById("audit-status");
  const errorEl = document.getElementById("audit-error");
  const resultsEl = document.getElementById("audit-results");
  const paymentBanner = document.getElementById("payment-success");

  if (isDevPage) {
    document.querySelector(".audit-badge")?.classList.add("is-dev");
  }

  if (paymentBanner && isPaymentReturn()) {
    paymentBanner.hidden = false;
    urlInput?.focus();
  }

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearUi();
    setLoading(true);

    const websiteUrl = urlInput.value.trim();

    try {
      const response = await fetch("/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ websiteUrl }),
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Audit request failed.");
      }

      renderResults(data);
    } catch (error) {
      showError(error.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  });

  function setLoading(isLoading) {
    runBtn.disabled = isLoading;
    urlInput.disabled = isLoading;
    runBtn.textContent = isLoading ? "Running audit…" : "Run Audit";

    statusEl.hidden = !isLoading;
    statusEl.className = "audit-status is-loading";

    if (isLoading) {
      statusEl.innerHTML = `
        <div class="spinner" aria-hidden="true"></div>
        <p>Scraping the site and asking the AI for a tear-down…</p>
        <p class="audit-status-note">This usually takes 10–30 seconds.</p>
      `;
    }
  }

  function clearUi() {
    errorEl.hidden = true;
    errorEl.textContent = "";
    resultsEl.hidden = true;
    resultsEl.innerHTML = "";
    statusEl.hidden = true;
  }

  function showError(message) {
    errorEl.hidden = false;
    errorEl.textContent = message;
  }

  function renderResults(data) {
    const { report, websiteUrl, scrapedMeta } = data;

    const scoreCards = Object.entries(CATEGORY_LABELS)
      .map(([key, label]) => {
        const section = report[key];
        return `
          <article class="score-card">
            <header>
              <h3>${label}</h3>
              <span class="score-pill">${section.score}/10</span>
            </header>
            <p>${escapeHtml(section.summary)}</p>
          </article>
        `;
      })
      .join("");

    const tipsList = report.tips
      .map((tip) => `<li>${escapeHtml(tip)}</li>`)
      .join("");

    resultsEl.innerHTML = `
      <section class="results-header">
        <h2>Your tear-down report</h2>
        <p class="results-url"><a href="${escapeAttr(websiteUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(websiteUrl)}</a></p>
        <p class="results-meta">Scraped page title: <strong>${escapeHtml(scrapedMeta.title || "(none)")}</strong></p>
      </section>
      <section class="score-grid">${scoreCards}</section>
      <section class="tips-panel">
        <h3>3 actionable fixes</h3>
        <ol>${tipsList}</ol>
      </section>
    `;

    resultsEl.hidden = false;
    resultsEl.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function isPaymentReturn() {
  const params = new URLSearchParams(window.location.search);
  return (
    params.get("paid") === "1" ||
    params.get("redirect_status") === "succeeded" ||
    params.has("payment_intent") ||
    params.has("session_id")
  );
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll("'", "&#39;");
}
