/** Marketing homepage: scroll effects, FAQ, pricing. */

import { initConversionMirror } from "./conversion-mirror.js";
import { initRachelChallenge } from "./rachel-challenge.js";
import { renderPricingCards } from "./pricing.js";

initConversionMirror();
initRachelChallenge();

renderPricingCards(document.getElementById("pricing-cards"));

// Fade-in on scroll
const fadeObs = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        entry.target.classList.add("visible");
        fadeObs.unobserve(entry.target);
      }
    }
  },
  { threshold: 0.1 }
);
document.querySelectorAll(".fade-in").forEach((el) => fadeObs.observe(el));

// Counter animation
document.querySelectorAll("[data-counter]").forEach((el) => {
  const end = parseInt(el.dataset.counter, 10);
  const suffix = el.dataset.suffix || "";
  const counterObs = new IntersectionObserver(
    ([entry]) => {
      if (!entry.isIntersecting) return;
      const start = performance.now();
      const tick = (now) => {
        const p = Math.min((now - start) / 2000, 1);
        el.textContent = `${Math.floor(p * end)}${suffix}`;
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
      counterObs.disconnect();
    },
    { threshold: 0.5 }
  );
  counterObs.observe(el);
});

// FAQ accordion
document.querySelectorAll(".faq-item").forEach((item) => {
  const btn = item.querySelector(".faq-toggle");
  if (!btn) return;
  btn.addEventListener("click", () => {
    const isOpen = item.classList.toggle("open");
    btn.setAttribute("aria-expanded", String(isOpen));
  });
});

if (window.innerWidth >= 768) {
  document.querySelectorAll(".conn-line").forEach((el) => {
    el.style.display = "block";
  });
}
