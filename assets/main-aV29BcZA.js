import"./modulepreload-polyfill-B5Qt9EMX.js";function n(e){return`<li class="pricing-feature">${e}</li>`}function c(e,r=""){return`<div class="pricing-card ${r}">${e}</div>`}function d(){return c(`
    <h3 class="pricing-tier-title display">The One-Pager</h3>
    <p class="pricing-tier-desc">One page that does one job: get the phone ringing.</p>
    <div class="pricing-price-row">
      <span class="pricing-price display">$299</span>
      <span class="pricing-price-sub">one time + $29/mo hosting</span>
    </div>
    <ul class="pricing-features">
      ${n("Single page, built around your phone number")}
      ${n("Tap-to-call on every screen")}
      ${n("Your services, hours and service area")}
      ${n("Loads fast on a phone in a truck")}
    </ul>
    <a href="/try/" class="btn-primary pricing-cta pricing-cta-outline">Get My Free Website Preview</a>
  `)}function g(){return c(`
    <span class="pricing-popular-badge">Most Popular</span>
    <h3 class="pricing-tier-title display">The Build</h3>
    <p class="pricing-tier-desc">When one page isn't enough room for the work you do.</p>
    <div class="pricing-price-row">
      <span class="pricing-price display">$497</span>
      <span class="pricing-price-sub">one time + $79/mo hosting</span>
    </div>
    <ul class="pricing-features">
      ${n("Everything in the One-Pager")}
      ${n("Up to 10 pages — a page per service")}
      ${n("Photo gallery of your own jobs")}
      ${n("Quote request form straight to your inbox")}
    </ul>
    <a href="/try/" class="btn-primary pricing-cta btn-roast">Get My Free Website Preview</a>
  `,"pricing-card-featured")}function f(){return c(`
    <h3 class="pricing-tier-title display">The Partnership</h3>
    <p class="pricing-tier-desc">Bigger jobs — booking, multiple locations, ongoing changes.</p>
    <div class="pricing-price-row">
      <span class="pricing-price display"><span class="pricing-price-from">from</span>$2,497</span>
      <span class="pricing-price-sub">quoted per job + $199/mo</span>
    </div>
    <ul class="pricing-features">
      ${n("Online booking or job scheduling")}
      ${n("Multiple locations or crews")}
      ${n("Changes whenever you need them")}
      ${n("You call me directly, not an account manager")}
    </ul>
    <a href="/apply/" class="btn-primary pricing-cta pricing-cta-outline">Talk to Alexander First</a>
  `,"pricing-card-partnership")}function h(e){e&&(e.innerHTML=`
    <div class="pricing-grid">
      ${d()}
      ${g()}
      ${f()}
    </div>
  `)}h(document.getElementById("pricing-cards"));(function(){const r=document.getElementById("navCta");if(!r)return;const t=200;let i=!1;function s(){const a=window.scrollY>=t;r.classList.toggle("is-visible",a),i=!1}window.addEventListener("scroll",()=>{i||(i=!0,requestAnimationFrame(s))},{passive:!0}),s()})();const p=new IntersectionObserver(e=>{for(const r of e)r.isIntersecting&&(r.target.classList.add("visible"),p.unobserve(r.target))},{threshold:.1});document.querySelectorAll(".fade-in").forEach(e=>p.observe(e));document.querySelectorAll("[data-counter]").forEach(e=>{const r=parseInt(e.dataset.counter,10),t=e.dataset.suffix||"",i=new IntersectionObserver(([s])=>{if(!s.isIntersecting)return;const a=performance.now(),o=u=>{const l=Math.min((u-a)/2e3,1);e.textContent=`${Math.floor(l*r)}${t}`,l<1&&requestAnimationFrame(o)};requestAnimationFrame(o),i.disconnect()},{threshold:.5});i.observe(e)});document.querySelectorAll(".faq-item").forEach(e=>{const r=e.querySelector(".faq-toggle");r&&r.addEventListener("click",()=>{const t=e.classList.toggle("open");r.setAttribute("aria-expanded",String(t))})});window.innerWidth>=768&&document.querySelectorAll(".conn-line").forEach(e=>{e.style.display="block"});
