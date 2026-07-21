/** Rachel Challenge: modal every page load → FAB only after dismiss (this page). */

const DISMISS_MS = 380;
const OPEN_DELAY_MS = 8000;

export function initRachelChallenge() {
  const fab = document.getElementById("rachelFab");
  const modal = document.getElementById("rachelModal");
  const closeBtn = document.getElementById("rachelModalClose");
  if (!modal) return;

  let lastFocus = null;
  let dismissing = false;
  let modalWasShown = false;

  function hideFab() {
    if (!fab) return;
    fab.classList.remove("is-visible");
    fab.hidden = true;
  }

  function showFab() {
    if (!fab || !modalWasShown) return;
    fab.hidden = false;
    void fab.offsetWidth;
    fab.classList.add("is-visible");
  }

  function openModal() {
    if (modal.classList.contains("is-open") || dismissing) return;
    lastFocus = document.activeElement;
    modal.hidden = false;
    modal.classList.remove("is-dismissing");
    modalWasShown = true;
    hideFab();
    requestAnimationFrame(() => {
      modal.classList.add("is-open");
    });
    document.body.style.overflow = "hidden";
    closeBtn?.focus();
  }

  function closeModal() {
    if (!modal.classList.contains("is-open") || dismissing) return;
    dismissing = true;

    modal.classList.add("is-dismissing");
    modal.classList.remove("is-open");
    document.body.style.overflow = "";

    window.setTimeout(() => {
      modal.hidden = true;
      modal.classList.remove("is-dismissing");
      dismissing = false;
      showFab();
      if (lastFocus && typeof lastFocus.focus === "function") lastFocus.focus();
    }, DISMISS_MS);
  }

  hideFab();

  fab?.addEventListener("click", openModal);
  closeBtn?.addEventListener("click", closeModal);

  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal.classList.contains("is-open")) {
      closeModal();
    }
  });

  // Every refresh: wait ~8s, then open. No session/cookie gate.
  window.setTimeout(openModal, OPEN_DELAY_MS);
}
