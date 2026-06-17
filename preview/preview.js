import { apiUrl } from "../scripts/api-config.js";

const token = new URLSearchParams(window.location.search).get("t")?.trim();

const POLL_INTERVAL_MS = 4000;
const FACT_ROTATE_MS = 8000;
const QUESTION_AT_MS = 60000;
const READY_BANNER_MS = 1500;
const CONFIRM_DISMISS_MS = 3000;
const SUB_STEP_STAGGER_MS = 1800;

const ROAST_LABEL = "Here's what our AI found on YOUR site:";
const ROAST_FALLBACK =
  "Our AI had trouble reading that site — double-check the URL and try again.";

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
let factRotateTimer = null;
let roastMode = false;
let roastBullets = [];
let roastIndex = 0;

function later(fn, ms) {
  timers.push(setTimeout(fn, ms));
}

function every(fn, ms) {
  const id = setInterval(fn, ms);
  timers.push(id);
  return id;
}

function clearAllTimers() {
  timers.forEach((id) => {
    clearTimeout(id);
    clearInterval(id);
  });
  timers.length = 0;
  if (factRotateTimer) {
    clearInterval(factRotateTimer);
    factRotateTimer = null;
  }
}

function showError(title, detail) {
  const loader = document.getElementById("loader");
  document.getElementById("wait").hidden = true;
  loader.hidden = false;
  loader.classList.add("error");
  loader.innerHTML = `<h1>${title}</h1><p>${detail}</p>`;
}

function fadeFactQuote(nextText) {
  const card = document.getElementById("fact-card");
  const quote = document.getElementById("fact-quote");

  card.classList.add("is-fading");
  later(() => {
    quote.textContent = nextText;
    card.classList.remove("is-fading");
  }, 400);
}

function formatRoastBullet(bullet) {
  const emoji = bullet.emoji || "⚠️";
  const text = bullet.text || bullet;
  return `${emoji} ${text}`;
}

function transitionToRoastMode(bullets) {
  if (roastMode || !bullets?.length) return;
  roastMode = true;
  roastBullets = bullets;
  roastIndex = 0;

  if (factRotateTimer) {
    clearInterval(factRotateTimer);
    factRotateTimer = null;
  }

  const label = document.getElementById("fact-label");
  if (label) {
    label.textContent = ROAST_LABEL;
  }

  fadeFactQuote(formatRoastBullet(roastBullets[0]));

  factRotateTimer = every(() => {
    roastIndex = (roastIndex + 1) % roastBullets.length;
    fadeFactQuote(formatRoastBullet(roastBullets[roastIndex]));
  }, FACT_ROTATE_MS);
}

function showRoastFallback() {
  if (roastMode) return;
  roastMode = true;

  if (factRotateTimer) {
    clearInterval(factRotateTimer);
    factRotateTimer = null;
  }

  const fallbackLabel = document.getElementById("fact-label");
  if (fallbackLabel) {
    fallbackLabel.textContent = ROAST_LABEL;
  }
  fadeFactQuote(ROAST_FALLBACK);
}

function applyRoastStatus(status) {
  const bullets = status?.roastBullets;
  const hasBullets = Array.isArray(bullets) && bullets.length > 0;

  if (status?.roastReady || hasBullets) {
    transitionToRoastMode(bullets);
  } else if (status?.roastFailed && !roastMode) {
    showRoastFallback();
  }
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

  return { html: await response.text(), ready: true };
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
      li.style.setProperty("--step-delay", `${0.4 + (i * SUB_STEP_STAGGER_MS) / 1000}s`);
      steps.appendChild(li);
    });
    container.classList.remove("is-fading");
  }, 450);
}

function startFacts() {
  if (roastMode) return;

  const quote = document.getElementById("fact-quote");
  let index = 0;

  quote.textContent = FACTS[index];

  factRotateTimer = every(() => {
    if (roastMode) return;
    index = (index + 1) % FACTS.length;
    fadeFactQuote(FACTS[index]);
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
    question.hidden = true;
    banner.hidden = false;
    banner.classList.remove("is-leaving");

    later(() => {
      banner.classList.add("is-leaving");
      later(() => {
        banner.hidden = true;
        banner.classList.remove("is-leaving");
      }, 500);
    }, CONFIRM_DISMISS_MS);

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

  const fill = document.getElementById("progress-fill");
  fill.classList.add("is-done");

  const stage = document.getElementById("stage");
  stage.classList.remove("is-fading");
  stage.innerHTML = '<h1 class="ready-banner">🎉 Your preview is ready!</h1>';
  await new Promise((resolve) => setTimeout(resolve, READY_BANNER_MS));

  document.getElementById("wait").classList.add("is-leaving");
  await new Promise((resolve) => setTimeout(resolve, 600));

  window.location.href = `../roast/?t=${encodeURIComponent(token)}`;
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

async function pollPreviewStatus() {
  try {
    const response = await fetch(
      apiUrl(`/api/preview-status?t=${encodeURIComponent(token)}`)
    );
    if (!response.ok) return;

    const status = await response.json();
    applyRoastStatus(status);

    if (status.ready) {
      finish();
    } else if (status.failed) {
      showGenerationFailed();
    }
  } catch {
    // Transient network hiccup — keep polling.
  }
}

function startPolling() {
  pollPreviewStatus();
  every(pollPreviewStatus, POLL_INTERVAL_MS);
}

function startWaitScreen(info) {
  const companyName = info?.companyName?.trim() || "your website";

  document.getElementById("loader").hidden = true;
  document.getElementById("wait").hidden = false;

  applyRoastStatus(info);

  requestAnimationFrame(() => {
    document.getElementById("progress-fill").classList.add("is-running");
  });

  setStage(STAGES[0], companyName);
  STAGES.slice(1).forEach((stage) => {
    later(() => setStage(stage, companyName), stage.at);
  });

  if (!roastMode) {
    startFacts();
  }

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

    if (result.ready) {
      window.location.href = `../roast/?t=${encodeURIComponent(token)}`;
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
