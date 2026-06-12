import { apiUrl } from "../scripts/api-config.js";

const token = new URLSearchParams(window.location.search).get("t")?.trim();

const POLL_INTERVAL_MS = 4000;
const FACT_ROTATE_MS = 8000;
const QUESTION_AT_MS = 60000;
const READY_BANNER_MS = 1500;
const SUB_STEP_STAGGER_MS = 1800;

const STAGES = [
  {
    at: 0,
    title: (name) => `🔍 Analyzing ${name}…`,
    steps: [
      "Reading your current site structure",
      "Identifying conversion gaps",
      "Pulling your brand assets",
    ],
  },
  {
    at: 45000,
    title: () => "✏️ Building your design concept…",
    steps: [
      "Selecting typography that converts",
      "Composing your hero section",
      "Writing conversion-focused copy",
    ],
  },
  {
    at: 150000,
    title: () => "✨ Almost ready…",
    steps: ["Polishing final details", "Preparing your preview"],
  },
];

const FACTS = [
  "75% of people judge a business's credibility by their website - within 3 seconds.",
  "Local businesses with modern websites convert 2-3x more visitors into paying customers.",
  "Adding a click-to-call button increases mobile conversions by 45%.",
  "Sites that load under 3 seconds get 2x more form submissions.",
  "A one-second delay in page load time can reduce conversions by 7%.",
  "Most small business websites were last updated over 4 years ago.",
  "88% of online consumers are less likely to return after a bad website experience.",
];

const timers = [];
let finished = false;

function later(fn, ms) {
  timers.push(setTimeout(fn, ms));
}

function every(fn, ms) {
  timers.push(setInterval(fn, ms));
}

function clearAllTimers() {
  timers.forEach((id) => {
    clearTimeout(id);
    clearInterval(id);
  });
  timers.length = 0;
}

function showError(title, detail) {
  const loader = document.getElementById("loader");
  document.getElementById("wait").hidden = true;
  loader.hidden = false;
  loader.classList.add("error");
  loader.innerHTML = `<h1>${title}</h1><p>${detail}</p>`;
}

/**
 * Render the generated landing page in a Blob-URL iframe.
 *
 * Previously this used document.open()/document.write(), which intermittently
 * painted before <style> @imports (Google Fonts) resolved — leaving the page
 * unstyled until a refresh. An iframe gets a clean document lifecycle: its
 * load event fires only after stylesheets resolve, and a dark loading gate
 * stays up until one extra paint cycle after that, so a half-rendered state
 * is never visible.
 */
function renderHtml(html) {
  document.getElementById("loader").hidden = true;
  document.getElementById("wait").hidden = true;

  // Loading gate: dark overlay + spinner until the frame is fully painted.
  const gate = document.createElement("div");
  gate.className = "preview-gate";
  gate.innerHTML = '<div class="spinner" aria-hidden="true"></div>';
  document.body.appendChild(gate);

  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);

  const iframe = document.createElement("iframe");
  iframe.className = "preview-frame";
  iframe.title = "Your website preview";
  iframe.src = url;

  iframe.addEventListener("load", () => {
    URL.revokeObjectURL(url); // clean up memory

    // Double rAF = one extra paint cycle after load, so styles/fonts are
    // committed to screen before the gate lifts.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        gate.classList.add("is-hidden");
        setTimeout(() => gate.remove(), 350);
      });
    });
  });

  document.body.appendChild(iframe);
}

async function fetchPreviewHtml() {
  const response = await fetch(apiUrl(`/api/preview/${encodeURIComponent(token)}`));

  if (response.status === 202) {
    return { pending: true, info: await response.json().catch(() => ({})) };
  }

  if (!response.ok) {
    const message = await response.text().catch(() => "");
    return { error: message || "This preview link does not exist or has expired." };
  }

  return { html: await response.text() };
}

/* ---------- Wait screen ---------- */

function setStage(stage, companyName) {
  const container = document.getElementById("stage");
  const title = document.getElementById("stage-title");
  const steps = document.getElementById("stage-steps");

  container.classList.add("is-fading");

  later(() => {
    title.textContent = stage.title(companyName);
    steps.innerHTML = "";
    stage.steps.forEach((text, i) => {
      const li = document.createElement("li");
      li.textContent = text;
      // Drives both the step fade-in and its ✓ (which follows 2s later in CSS).
      li.style.setProperty("--step-delay", `${0.4 + (i * SUB_STEP_STAGGER_MS) / 1000}s`);
      steps.appendChild(li);
    });
    container.classList.remove("is-fading");
  }, 450);
}

function startFacts() {
  const card = document.getElementById("fact-card");
  const quote = document.getElementById("fact-quote");
  let index = 0;

  quote.textContent = FACTS[index];

  every(() => {
    card.classList.add("is-fading");
    later(() => {
      index = (index + 1) % FACTS.length;
      quote.textContent = FACTS[index];
      card.classList.remove("is-fading");
    }, 400);
  }, FACT_ROTATE_MS);
}

function setupQuestion() {
  const question = document.getElementById("question");
  const pills = document.getElementById("pills");
  const banner = document.getElementById("question-banner");
  let answered = false;

  later(() => question.classList.add("is-visible"), QUESTION_AT_MS);

  pills.addEventListener("click", (event) => {
    const pill = event.target.closest(".pill");
    if (!pill || answered) return;

    answered = true;

    // Replace the question card with the permanent confirmation banner.
    question.hidden = true;
    banner.hidden = false;

    // Fire-and-forget — the wait screen shouldn't break if this fails.
    fetch(apiUrl("/api/preview-intent"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, intent: pill.dataset.intent }),
    }).catch(() => {});
  });
}

async function finish() {
  if (finished) return;
  finished = true;
  clearAllTimers();

  // 1. Snap the progress bar to 100%.
  const fill = document.getElementById("progress-fill");
  fill.classList.add("is-done");

  // 2. Celebrate briefly.
  const stage = document.getElementById("stage");
  stage.classList.remove("is-fading");
  stage.innerHTML = '<h1 class="ready-banner">🎉 Your preview is ready!</h1>';
  await new Promise((resolve) => setTimeout(resolve, READY_BANNER_MS));

  // 3. Fade out the wait screen.
  document.getElementById("wait").classList.add("is-leaving");
  await new Promise((resolve) => setTimeout(resolve, 600));

  // 4. Reveal the preview.
  const result = await fetchPreviewHtml();
  if (result.html) {
    renderHtml(result.html);
  } else {
    showError(
      "Could not load preview",
      "Your preview is ready but didn't load — please refresh this page."
    );
  }
}

function showGenerationFailed() {
  clearAllTimers();
  const stage = document.getElementById("stage");
  document.getElementById("stage-title").textContent =
    "😕 This is taking longer than expected";
  document.getElementById("stage-steps").innerHTML = "";
  stage.classList.remove("is-fading");
  const note = document.createElement("li");
  note.textContent = "Please try this link again in a few minutes.";
  document.getElementById("stage-steps").appendChild(note);
}

function startPolling() {
  every(async () => {
    try {
      const response = await fetch(
        apiUrl(`/api/preview-status?t=${encodeURIComponent(token)}`)
      );
      if (!response.ok) return;

      const status = await response.json();
      if (status.ready) {
        finish();
      } else if (status.failed) {
        showGenerationFailed();
      }
    } catch {
      // Transient network hiccup — keep polling.
    }
  }, POLL_INTERVAL_MS);
}

function startWaitScreen(info) {
  const companyName = info?.companyName?.trim() || "your website";

  document.getElementById("loader").hidden = true;
  document.getElementById("wait").hidden = false;

  // Kick off the 0% → 90% crawl on the next frame so the animation runs.
  requestAnimationFrame(() => {
    document.getElementById("progress-fill").classList.add("is-running");
  });

  setStage(STAGES[0], companyName);
  STAGES.slice(1).forEach((stage) => {
    later(() => setStage(stage, companyName), stage.at);
  });

  startFacts();
  setupQuestion();
  startPolling();
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
    const result = await fetchPreviewHtml();

    if (result.html) {
      renderHtml(result.html);
      return;
    }

    if (result.pending) {
      if (result.info?.failed) {
        showError(
          "Preview not ready",
          "We hit a snag preparing your preview. Please try this link again in a few minutes."
        );
        return;
      }
      startWaitScreen(result.info);
      return;
    }

    showError("Preview not found", result.error);
  } catch {
    showError(
      "Could not load preview",
      "The preview server may be waking up — please refresh in 30 seconds."
    );
  }
}

loadPreview();
