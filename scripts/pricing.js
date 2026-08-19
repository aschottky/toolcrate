/** Three-tier Blueprint pricing — #pricing-cards on the marketing homepage. */

function featureItem(text) {
  return `<li class="pricing-feature">${text}</li>`;
}

function cardShell(content, className = "") {
  return `<div class="pricing-card ${className}">${content}</div>`;
}

function renderStarter() {
  return cardShell(`
    <h3 class="pricing-tier-title display">The One-Pager</h3>
    <p class="pricing-tier-desc">One page that does one job: get the phone ringing.</p>
    <div class="pricing-price-row">
      <span class="pricing-price display">$299</span>
      <span class="pricing-price-sub">one time + $29/mo hosting</span>
    </div>
    <ul class="pricing-features">
      ${featureItem("Single page, built around your phone number")}
      ${featureItem("Tap-to-call on every screen")}
      ${featureItem("Your services, hours and service area")}
      ${featureItem("Loads fast on a phone in a truck")}
    </ul>
    <a href="/try/" class="btn-primary pricing-cta pricing-cta-outline">Get My Free Website Preview</a>
  `);
}

function renderBuild() {
  return cardShell(`
    <span class="pricing-popular-badge">Most Popular</span>
    <h3 class="pricing-tier-title display">The Build</h3>
    <p class="pricing-tier-desc">When one page isn't enough room for the work you do.</p>
    <div class="pricing-price-row">
      <span class="pricing-price display">$497</span>
      <span class="pricing-price-sub">one time + $79/mo hosting</span>
    </div>
    <ul class="pricing-features">
      ${featureItem("Everything in the One-Pager")}
      ${featureItem("Up to 10 pages — a page per service")}
      ${featureItem("Photo gallery of your own jobs")}
      ${featureItem("Quote request form straight to your inbox")}
    </ul>
    <a href="/try/" class="btn-primary pricing-cta btn-roast">Get My Free Website Preview</a>
  `, "pricing-card-featured");
}

function renderPartnership() {
  return cardShell(`
    <h3 class="pricing-tier-title display">The Partnership</h3>
    <p class="pricing-tier-desc">Bigger jobs — booking, multiple locations, ongoing changes.</p>
    <div class="pricing-price-row">
      <span class="pricing-price display"><span class="pricing-price-from">from</span>$2,497</span>
      <span class="pricing-price-sub">quoted per job + $199/mo</span>
    </div>
    <ul class="pricing-features">
      ${featureItem("Online booking or job scheduling")}
      ${featureItem("Multiple locations or crews")}
      ${featureItem("Changes whenever you need them")}
      ${featureItem("You call me directly, not an account manager")}
    </ul>
    <a href="/apply/" class="btn-primary pricing-cta pricing-cta-outline">Talk to Alexander First</a>
  `, "pricing-card-partnership");
}

export function renderPricingCards(container) {
  if (!container) return;
  container.innerHTML = `
    <div class="pricing-grid">
      ${renderStarter()}
      ${renderBuild()}
      ${renderPartnership()}
    </div>
  `;
}
