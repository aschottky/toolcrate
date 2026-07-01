/** Marketing homepage: scroll effects, strategy-line copy, FAQ, pricing, bottom CTA → hero. */

import { renderPricingCards } from "./pricing.js";

renderPricingCards(document.getElementById("pricing-cards"));

const STRATEGY_PHONE_DISPLAY = "(818) 869-9928";

const copyToast = document.getElementById("copy-toast");
let copyToastTimer;

function showCopyToast(message) {
  if (!copyToast) return;
  copyToast.textContent = message;
  copyToast.classList.add("is-visible");
  clearTimeout(copyToastTimer);
  copyToastTimer = setTimeout(() => copyToast.classList.remove("is-visible"), 2200);
}

function wireCopyButton(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(STRATEGY_PHONE_DISPLAY);
      showCopyToast("Strategy line copied");
    } catch {
      showCopyToast(STRATEGY_PHONE_DISPLAY);
    }
  });
}

["nav-strategy-copy", "cta-strategy-copy", "footer-strategy-copy"].forEach(
  wireCopyButton
);

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

// FAQ accordion (single handler — no inline onclick to avoid double-toggle)
document.querySelectorAll(".faq-item").forEach((item) => {
  const btn = item.querySelector(".faq-toggle");
  if (!btn) return;
  btn.addEventListener("click", () => {
    const isOpen = item.classList.toggle("open");
    btn.setAttribute("aria-expanded", String(isOpen));
  });
});

// Bottom CTA → hero funnel
const ctaUrl = document.getElementById("cta-url");
const ctaBtn = document.getElementById("cta-btn");
const heroUrlInput = document.getElementById("hero-url-input");

function goToHeroFunnel(fromInput) {
  const value = fromInput?.value.trim() || "";
  if (value && heroUrlInput) {
    heroUrlInput.value = value.replace(/^https?:\/\//i, "").replace(/^www\./i, "");
  }
  document.getElementById("hero")?.scrollIntoView({ behavior: "smooth", block: "start" });
  if (value) {
    document.getElementById("hero-url-form")?.requestSubmit();
    return;
  }
  heroUrlInput?.focus();
}

ctaBtn?.addEventListener("click", (event) => {
  event.preventDefault();
  goToHeroFunnel(ctaUrl);
});

ctaUrl?.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    goToHeroFunnel(ctaUrl);
  }
});

// Pricing / nav roast links
document.querySelectorAll("[data-scroll-hero]").forEach((el) => {
  el.addEventListener("click", (event) => {
    event.preventDefault();
    document.getElementById("hero")?.scrollIntoView({ behavior: "smooth", block: "start" });
    heroUrlInput?.focus();
  });
});

if (window.innerWidth >= 768) {
  document.querySelectorAll(".conn-line").forEach((el) => {
    el.style.display = "block";
  });
}
