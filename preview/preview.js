import { apiUrl } from "../scripts/api-config.js";
import {
  endsWithDanglingWord,
  sanitizeRoastBulletList,
} from "../scripts/roast-bullet-sanitize.js";

const token = new URLSearchParams(window.location.search).get("t")?.trim();

const POLL_INTERVAL_MS = 4000;
const STAT_ROTATE_MS = 5000;
const STAT_START_DELAY_MS = 3500;
const MIN_REVEAL_HOLD_MS = 20000;
const STAT_FADE_OUT_MS = 600;
const HEADER_FADE_IN_MS = 400;
const BULLET_FADE_MS = 400;
const BULLET_GAP_MS = 2000;
const FOOTER_HOLD_MS = 1500;
const QUESTION_AT_MS = 60000;
const READY_BANNER_MS = 1500;
const CONFIRM_DISMISS_MS = 3000;
const DELAY_NOTICE_MS = 240000; // 4 minutes — never reset after mount

const STAGES = [
  {
    at: 0,
    title: "Analyzing your current site",
    subtitle: "We are reviewing your layout, messaging, and conversion structure.",
  },
  {
    at: 15000,
    title: "Building your custom preview",
    subtitle: "Our AI is designing a version of your site built to convert.",
  },
  {
    at: 60000,
    title: "Almost there",
    subtitle: "Putting the finishing touches on your preview.",
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
let mountTime = 0;
let finished = false;
let statRotateTimer = null;
let delayNoticeShown = false;
let revealStarted = false;
let statsActive = false;
let pendingBullets = null;
let revealTimer = null;
let delayNoticeTimer = null;

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
  if (revealTimer) {
    clearTimeout(revealTimer);
    revealTimer = null;
  }
  if (delayNoticeTimer) {
    clearTimeout(delayNoticeTimer);
    delayNoticeTimer = null;
  }
}

function stopStats() {
  if (statRotateTimer) {
    clearInterval(statRotateTimer);
    statRotateTimer = null;
  }
  statsActive = false;
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
  if (delayNoticeShown || finished) return;

  const container = document.getElementById("stage-main");
  const title = document.getElementById("stage-title");
  const subtitle = document.getElementById("stage-subtitle");

  container.classList.add("is-fading");

  later(() => {
    title.textContent = stage.title;
    subtitle.textContent = stage.subtitle;
    container.classList.remove("is-fading");
  }, 450);
}

function startStats() {
  if (revealStarted || statsActive) return;

  statsActive = true;
  document.getElementById("stats-panel").hidden = false;
  document.getElementById("findings-panel").hidden = true;

  const quote = document.getElementById("fact-quote");
  let index = 0;

  quote.textContent = STATS[index];

  statRotateTimer = setInterval(() => {
    if (revealStarted) return;
    index = (index + 1) % STATS.length;
    fadeStatQuote(STATS[index]);
  }, STAT_ROTATE_MS);
}

function appendFindingRow(number, text) {
  if (!text || endsWithDanglingWord(text)) return;

  const list = document.getElementById("findings-list");
  const row = document.createElement("li");
  row.className = "finding-row";

  const num = document.createElement("span");
  num.className = "finding-num";
  num.textContent = String(number).padStart(2, "0");

  const copy = document.createElement("span");
  copy.className = "finding-text";
  copy.textContent = text;

  row.append(num, copy);
  list.appendChild(row);

  requestAnimationFrame(() => {
    row.classList.add("is-visible");
  });
}

function showFindingsFooter() {
  const footer = document.getElementById("findings-footer");
  footer.hidden = false;
  requestAnimationFrame(() => footer.classList.add("is-visible"));
}

function beginFindingsReveal() {
  if (revealStarted || finished) return;

  const texts = sanitizeRoastBulletList(pendingBullets, 6);
  if (!texts.length) return;

  revealStarted = true;
  stopStats();

  const statsPanel = document.getElementById("stats-panel");
  statsPanel.classList.add("is-leaving");

  later(() => {
    statsPanel.hidden = true;
    statsPanel.classList.remove("is-leaving");

    const findingsPanel = document.getElementById("findings-panel");
    const header = document.getElementById("findings-header");
    const list = document.getElementById("findings-list");
    const footer = document.getElementById("findings-footer");

    findingsPanel.hidden = false;
    list.innerHTML = "";
    footer.hidden = true;
    footer.classList.remove("is-visible");
    header.classList.remove("is-visible");

    later(() => {
      header.classList.add("is-visible");

      later(() => {
        texts.forEach((text, index) => {
          later(() => {
            appendFindingRow(index + 1, text);

            if (index === texts.length - 1) {
              later(showFindingsFooter, FOOTER_HOLD_MS);
            }
          }, index * BULLET_GAP_MS);
        });
      }, HEADER_FADE_IN_MS);
    }, 0);
  }, STAT_FADE_OUT_MS);
}

function queueRoastReveal(bullets) {
  if (revealStarted || finished || !bullets?.length) return;

  pendingBullets = bullets;
  if (revealTimer) return;

  const delay = Math.max(0, MIN_REVEAL_HOLD_MS - (Date.now() - mountTime));
  revealTimer = setTimeout(() => {
    revealTimer = null;
    beginFindingsReveal();
  }, delay);
}

function applyPreviewStatus(status) {
  if (!status || finished) return;

  if (
    !revealStarted &&
    (status.status === "roast_ready" || status.status === "ready") &&
    status.roast_bullets?.length
  ) {
    queueRoastReveal(status.roast_bullets);
  }
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

function scheduleDelayNotice() {
  if (delayNoticeTimer || delayNoticeShown || finished || !mountTime) return;

  const remaining = Math.max(0, DELAY_NOTICE_MS - (Date.now() - mountTime));
  delayNoticeTimer = setTimeout(() => {
    delayNoticeTimer = null;
    showDelayNotice();
  }, remaining);
}

function showDelayNotice() {
  if (delayNoticeShown || finished) return;
  if (Date.now() - mountTime < DELAY_NOTICE_MS - 500) return;

  delayNoticeShown = true;

  const container = document.getElementById("stage-main");
  container.classList.add("is-fading");

  later(() => {
    container.innerHTML = `
      <h1 class="stage-title">This is taking longer than expected</h1>
      <p class="stage-subtitle">Your preview is still being generated. You do not need to keep this tab open.</p>
      <p class="stage-subtitle">We will send it to your email as soon as it is ready.</p>
    `;
    container.classList.remove("is-fading");
  }, 450);
}

async function finish() {
  if (finished) return;
  finished = true;
  clearProgressTimers();
  stopStats();

  const fill = document.getElementById("progress-fill");
  fill.classList.add("is-done");

  const stageMain = document.getElementById("stage-main");
  stageMain.classList.remove("is-fading");
  stageMain.innerHTML = '<h1 class="ready-banner">Your preview is ready</h1>';
  await new Promise((resolve) => setTimeout(resolve, READY_BANNER_MS));

  document.getElementById("wait").classList.add("is-leaving");
  await new Promise((resolve) => setTimeout(resolve, 600));

  window.location.href = `../roast/?t=${encodeURIComponent(token)}`;
}

function showGenerationFailed() {
  if (finished) return;
  finished = true;
  clearProgressTimers();
  stopStats();

  document.getElementById("stage-title").textContent = "Preview unavailable";
  document.getElementById("stage-subtitle").textContent =
    "Please try this link again in a few minutes.";
  document.getElementById("stage-main").classList.remove("is-fading");
}

async function pollPreviewStatus() {
  try {
    const response = await fetch(
      apiUrl(`/api/preview-status?t=${encodeURIComponent(token)}`)
    );
    if (!response.ok) return;

    const status = await response.json();
    applyPreviewStatus(status);

    if (status.status === "ready") {
      finish();
    } else if (status.status === "failed") {
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

function startWaitScreen(initialStatus) {
  mountTime = Date.now();

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
  applyPreviewStatus(initialStatus);
  scheduleDelayNotice();

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
      if (result.info?.status === "failed") {
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
      "The preview server may be waking up. Please refresh in 30 seconds."
    );
  }
}

loadPreview();
