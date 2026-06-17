import { apiUrl } from "../scripts/api-config.js";

const token = new URLSearchParams(window.location.search).get("t")?.trim();

const POLL_INTERVAL_MS = 4000;
const STAT_ROTATE_MS = 5000;
const STAT_START_DELAY_MS = 3500;
const QUESTION_AT_MS = 60000;
const READY_BANNER_MS = 1500;
const CONFIRM_DISMISS_MS = 3000;
const DELAY_NOTICE_MS = 240000;

const STAGES = [
  {
    at: 0,
    title: "Analyzing your current site",
    steps: ["We're reviewing your layout, messaging, and conversion structure."],
  },
  {
    at: 15000,
    title: "Building your custom preview",
    steps: [
      "Our AI is designing a version of your site built to convert.",
      "You'll see the before and after side by side.",
    ],
  },
  {
    at: 60000,
    title: "Almost there",
    steps: ["Putting the finishing touches on your preview."],
  },
];

const STATS = [
  "94% of first impressions are based on website design alone.",
  "You have about 7 seconds to convince a visitor to stay.",
  "Most small business websites have no clear call to action above the fold.",
  "A slow-loading site loses half its visitors before the page finishes loading.",
  "Most business websites were built once and never updated since.",
  "Visitors who can't find your phone number in 5 seconds will call a competitor.",
  "68% of small business sites are not optimized for mobile.",
];

const timers = [];
let finished = false;
let statRotateTimer = null;
let delayNoticeShown = false;

function later(fn, ms) {
  timers.push(setTimeout(fn, ms));
}

function every(fn, ms) {
  const id = setInterval(fn, ms);
  timers.push(id);
  return id;
}

function clearProgressTimers() {
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

function fadeStatQuote(nextText) {
  const card = document.getElementById("fact-card");
  const quote = document.getElementById("fact-quote");

  card.classList.add("is-fading");
  later(() => {
    quote.textContent = nextText;
    card.classList.remove("is-fading");
  }, 400);
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

function setStage(stage) {
  const container = document.getElementById("stage-main");
  const title = document.getElementById("stage-title");
  const steps = document.getElementById("stage-steps");

  container.classList.add("is-fading");

  later(() => {
    title.textContent = stage.title;
    steps.innerHTML = "";
    stage.steps.forEach((text) => {
      const li = document.createElement("li");
      li.textContent = text;
      steps.appendChild(li);
    });
    container.classList.remove("is-fading");
  }, 450);
}

function startStats() {
  const quote = document.getElementById("fact-quote");
  let index = 0;

  quote.textContent = STATS[index];

  statRotateTimer = setInterval(() => {
    index = (index + 1) % STATS.length;
    fadeStatQuote(STATS[index]);
  }, STAT_ROTATE_MS);
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

function showDelayNotice() {
  if (delayNoticeShown || finished) return;
  delayNoticeShown = true;
  document.getElementById("delay-notice").hidden = false;
}

async function finish() {
  if (finished) return;
  finished = true;
  clearProgressTimers();
  if (statRotateTimer) {
    clearInterval(statRotateTimer);
    statRotateTimer = null;
  }

  const fill = document.getElementById("progress-fill");
  fill.classList.add("is-done");

  const stageMain = document.getElementById("stage-main");
  stageMain.classList.remove("is-fading");
  stageMain.innerHTML = '<h1 class="ready-banner">Your preview is ready</h1>';
  document.getElementById("delay-notice").hidden = true;

  await new Promise((resolve) => setTimeout(resolve, READY_BANNER_MS));

  document.getElementById("wait").classList.add("is-leaving");
  await new Promise((resolve) => setTimeout(resolve, 600));

  window.location.href = `../roast/?t=${encodeURIComponent(token)}`;
}

function showGenerationFailed() {
  if (finished) return;
  finished = true;
  clearProgressTimers();
  if (statRotateTimer) {
    clearInterval(statRotateTimer);
    statRotateTimer = null;
  }

  const stageMain = document.getElementById("stage-main");
  document.getElementById("stage-title").textContent = "Preview unavailable";
  document.getElementById("stage-steps").innerHTML = "";
  const note = document.createElement("li");
  note.textContent = "Please try this link again in a few minutes.";
  document.getElementById("stage-steps").appendChild(note);
  stageMain.classList.remove("is-fading");
  document.getElementById("delay-notice").hidden = true;
}

async function pollPreviewStatus() {
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
}

function startPolling() {
  pollPreviewStatus();
  every(pollPreviewStatus, POLL_INTERVAL_MS);
}

function startWaitScreen() {
  document.getElementById("loader").hidden = true;
  document.getElementById("wait").hidden = false;

  requestAnimationFrame(() => {
    document.getElementById("progress-fill").classList.add("is-running");
  });

  setStage(STAGES[0]);
  STAGES.slice(1).forEach((stage) => {
    later(() => setStage(stage), stage.at);
  });

  later(() => startStats(), STAT_START_DELAY_MS);
  later(() => showDelayNotice(), DELAY_NOTICE_MS);

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
      startWaitScreen();
      return;
    }

    showError("Preview not found", result.error);
  } catch {
    showError(
      "Could not load preview",
      "The preview server may be waking up. Please refresh in 30 seconds."
    );
  }
}

loadPreview();
