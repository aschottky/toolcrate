/** Three-tier Blueprint pricing — #pricing-cards on the marketing homepage. */

function featureItem(text) {
  return `<li class="pricing-feature">${text}</li>`;
}

function cardShell(content, className = "") {
  return `<div class="pricing-card ${className}">${content}</div>`;
}

function renderStarter() {
  return cardShell(`
    <h3 class="pricing-tier-title display">The Starter</h3>
    <p class="pricing-tier-desc">Perfect for Solo-Pros &amp; Artisans.</p>
    <div class="pricing-price-row">
      <span class="pricing-price display">$299</span>
      <span class="pricing-price-sub">setup + $29/mo hosting</span>
    </div>
    <ul class="pricing-features">
      ${featureItem("Everything in the Blueprint")}
      ${featureItem("3 Core Pages")}
      ${featureItem("Mobile-Responsive")}
      ${featureItem("SEO &amp; Speed optimization")}
    </ul>
    <a href="/blueprint/" class="btn-primary pricing-cta pricing-cta-outline">Start with a Free Blueprint</a>
  `);
}

function renderBuild() {
  return cardShell(`
    <span class="pricing-popular-badge">Most Popular</span>
    <h3 class="pricing-tier-title display">The Build</h3>
    <p class="pricing-tier-desc">For Growing Businesses scaling to $10k+/mo.</p>
    <div class="pricing-price-row">
      <span class="pricing-price display">$497</span>
      <span class="pricing-price-sub">setup + $79/mo hosting</span>
    </div>
    <ul class="pricing-features">
      ${featureItem("Everything in Starter")}
      ${featureItem("Up to 10 Pages")}
      ${featureItem("Custom Lead Magnets")}
      ${featureItem("Conversion Audit")}
    </ul>
    <a href="/blueprint/" class="btn-primary pricing-cta btn-roast">Start with a Free Blueprint</a>
  `, "pricing-card-featured");
}

function renderPartnership() {
  return cardShell(`
    <h3 class="pricing-tier-title display">The Partnership</h3>
    <p class="pricing-tier-desc">Full-service concierge for high-stakes operators.</p>
    <div class="pricing-price-row">
      <span class="pricing-price display">$2,497</span>
      <span class="pricing-price-sub">setup + $199/mo maintenance</span>
    </div>
    <ul class="pricing-features">
      ${featureItem("Direct Alexander access")}
      ${featureItem("Strategic Growth Support")}
      ${featureItem("A/B Testing")}
      ${featureItem("Quarterly Strategy Calls")}
    </ul>
    <a href="/apply/" class="btn-primary pricing-cta pricing-cta-outline">Apply to Work with Alexander</a>
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
