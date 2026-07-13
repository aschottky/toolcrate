/** Conversion lens + Before/After switcher + multi-project showcase. */

import { projects } from "../src/data/projects.js";

const LENS_RADIUS = 150;

function preload(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => resolve();
    img.src = src;
  });
}

export function initConversionMirror() {
  const container = document.getElementById("mirrorContainer");
  const afterLayer = document.getElementById("afterLayer");
  const lensRing = document.getElementById("lensRing");
  const beforeImg = document.getElementById("mirrorBeforeImg");
  const afterImg = document.getElementById("mirrorAfterImg");
  const beforeBtn = document.getElementById("mirrorBeforeBtn");
  const afterBtn = document.getElementById("mirrorAfterBtn");
  const hint = document.getElementById("mirrorHint");
  const nicheLabel = document.getElementById("mirrorNicheLabel");
  const dotsEl = document.getElementById("mirrorDots");
  const prevBtn = document.getElementById("mirrorPrevBtn");
  const nextBtn = document.getElementById("mirrorNextBtn");

  if (!container || !afterLayer || !lensRing || !beforeImg || !afterImg) return;
  if (!projects.length) return;

  let mode = "before"; // "before" | "after"
  let index = 0;
  let transitioning = false;

  function renderDots() {
    if (!dotsEl) return;
    dotsEl.innerHTML = projects
      .map(
        (project, i) => `
        <button
          type="button"
          class="mirror-nav__dot${i === index ? " is-active" : ""}"
          data-index="${i}"
          aria-label="${project.niche}"
          aria-pressed="${i === index ? "true" : "false"}"
        ></button>
      `
      )
      .join("");

    dotsEl.querySelectorAll(".mirror-nav__dot").forEach((dot) => {
      dot.addEventListener("click", () => {
        const nextIndex = Number(dot.getAttribute("data-index"));
        if (!Number.isNaN(nextIndex)) showProject(nextIndex);
      });
    });
  }

  function applyModeStyles() {
    const isAfter = mode === "after";
    container.classList.toggle("is-full-after", isAfter);
    afterLayer.setAttribute("aria-hidden", isAfter ? "false" : "true");

    if (isAfter) {
      afterLayer.style.clipPath = "none";
      lensRing.style.opacity = "0";
    } else {
      afterLayer.style.clipPath = "circle(0px at center)";
      lensRing.style.opacity = "0";
    }

    if (beforeBtn && afterBtn) {
      beforeBtn.classList.toggle("is-active", !isAfter);
      afterBtn.classList.toggle("is-active", isAfter);
      beforeBtn.setAttribute("aria-pressed", String(!isAfter));
      afterBtn.setAttribute("aria-pressed", String(isAfter));
    }

    if (hint) {
      const niche = projects[index]?.niche ?? "site";
      hint.textContent = isAfter
        ? `Full After — ${niche} transformation.`
        : `Hover your “Conversion Lens” over the site to see the Toolcrate difference.`;
    }
  }

  function setMode(next) {
    mode = next;
    applyModeStyles();
  }

  async function showProject(nextIndex, { animate = true } = {}) {
    if (!projects.length || transitioning) return;
    const wrapped = ((nextIndex % projects.length) + projects.length) % projects.length;
    if (wrapped === index && beforeImg.src.includes(projects[wrapped].beforeImg)) {
      renderDots();
      return;
    }

    const project = projects[wrapped];
    transitioning = true;

    if (animate) {
      container.classList.remove("is-ready");
      container.classList.add("is-fading");
      await new Promise((r) => setTimeout(r, 280));
    }

    await Promise.all([preload(project.beforeImg), preload(project.afterImg)]);

    beforeImg.src = project.beforeImg;
    beforeImg.alt = project.beforeAlt || `${project.niche} website before redesign`;
    afterImg.src = project.afterImg;
    afterImg.alt = project.afterAlt || `${project.niche} website after redesign`;

    index = wrapped;
    if (nicheLabel) nicheLabel.textContent = project.niche;
    renderDots();
    applyModeStyles();

    // Stay faded until images paint, then fade back in
    requestAnimationFrame(() => {
      container.classList.add("is-ready");
      container.classList.remove("is-fading");
      transitioning = false;
    });
  }

  function updateLens(clientX, clientY) {
    if (mode !== "before" || transitioning) return;
    const rect = container.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    afterLayer.style.clipPath = `circle(${LENS_RADIUS}px at ${x}px ${y}px)`;
    lensRing.style.left = `${x}px`;
    lensRing.style.top = `${y}px`;
    lensRing.style.opacity = "1";
  }

  function hideLens() {
    if (mode !== "before") return;
    afterLayer.style.clipPath = "circle(0px at center)";
    lensRing.style.opacity = "0";
  }

  container.addEventListener("mousemove", (e) => {
    updateLens(e.clientX, e.clientY);
  });
  container.addEventListener("mouseleave", hideLens);
  container.addEventListener(
    "touchstart",
    (e) => {
      if (e.touches.length) updateLens(e.touches[0].clientX, e.touches[0].clientY);
    },
    { passive: true }
  );
  container.addEventListener(
    "touchmove",
    (e) => {
      if (e.touches.length) updateLens(e.touches[0].clientX, e.touches[0].clientY);
    },
    { passive: true }
  );
  container.addEventListener("touchend", hideLens);
  container.addEventListener("touchcancel", hideLens);

  beforeBtn?.addEventListener("click", () => setMode("before"));
  afterBtn?.addEventListener("click", () => setMode("after"));
  prevBtn?.addEventListener("click", () => showProject(index - 1));
  nextBtn?.addEventListener("click", () => showProject(index + 1));

  // Prefetch remaining project images in the background
  projects.slice(1).forEach((project) => {
    preload(project.beforeImg);
    preload(project.afterImg);
  });

  renderDots();
  if (nicheLabel) nicheLabel.textContent = projects[0].niche;
  setMode("before");
}
