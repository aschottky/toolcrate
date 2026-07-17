/** Rachel Challenge FAB + modal (homepage). */

const STORAGE_KEY = "toolcrate_rachel_challenge_seen";
const AUTO_SHOW_MS = 15000;

export function initRachelChallenge() {
  const fab = document.getElementById("rachelFab");
  const modal = document.getElementById("rachelModal");
  const closeBtn = document.getElementById("rachelModalClose");
  if (!fab || !modal) return;

  let lastFocus = null;

  function hasSeen() {
    try {
      return localStorage.getItem(STORAGE_KEY) === "1";
    } catch {
      return false;
    }
  }

  function markSeen() {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
  }

  function openModal() {
    if (modal.classList.contains("is-open")) return;
    lastFocus = document.activeElement;
    modal.hidden = false;
    // next frame so CSS transition/animation can run
    requestAnimationFrame(() => {
      modal.classList.add("is-open");
    });
    document.body.style.overflow = "hidden";
    markSeen();
    closeBtn?.focus();
  }

  function closeModal() {
    if (!modal.classList.contains("is-open")) return;
    modal.classList.remove("is-open");
    document.body.style.overflow = "";
    window.setTimeout(() => {
      modal.hidden = true;
      if (lastFocus && typeof lastFocus.focus === "function") lastFocus.focus();
    }, 250);
  }

  fab.addEventListener("click", openModal);
  closeBtn?.addEventListener("click", closeModal);

  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal.classList.contains("is-open")) {
      closeModal();
    }
  });

  if (!hasSeen()) {
    window.setTimeout(() => {
      if (!hasSeen()) openModal();
    }, AUTO_SHOW_MS);
  }
}
