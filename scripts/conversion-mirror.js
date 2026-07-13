/** Conversion lens + Before/After full-image switcher. */

const LENS_RADIUS = 150;

export function initConversionMirror() {
  const container = document.getElementById("mirrorContainer");
  const afterLayer = document.getElementById("afterLayer");
  const lensRing = document.getElementById("lensRing");
  const beforeBtn = document.getElementById("mirrorBeforeBtn");
  const afterBtn = document.getElementById("mirrorAfterBtn");
  const hint = document.getElementById("mirrorHint");
  if (!container || !afterLayer || !lensRing) return;

  let mode = "before"; // "before" | "after"

  function setMode(next) {
    mode = next;
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
      hint.textContent = isAfter
        ? "Full After — the high-authority ToolCrate transformation."
        : "Hover your “Conversion Lens” over the site to see the Toolcrate difference.";
    }
  }

  function updateLens(clientX, clientY) {
    if (mode !== "before") return;
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
      if (e.touches.length) {
        updateLens(e.touches[0].clientX, e.touches[0].clientY);
      }
    },
    { passive: true }
  );

  container.addEventListener(
    "touchmove",
    (e) => {
      if (e.touches.length) {
        updateLens(e.touches[0].clientX, e.touches[0].clientY);
      }
    },
    { passive: true }
  );

  container.addEventListener("touchend", hideLens);
  container.addEventListener("touchcancel", hideLens);

  beforeBtn?.addEventListener("click", () => setMode("before"));
  afterBtn?.addEventListener("click", () => setMode("after"));

  setMode("before");
}
