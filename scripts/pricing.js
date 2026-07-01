/** High-Stakes Concierge pricing — Quiet Authority layout for #pricing-cards. */

function featureItem(text) {
  return `<li class="pricing-feature">${text}</li>`;
}

function cardShell(content, className = "") {
  return `<div class="pricing-card ${className}">${content}</div>`;
}

function renderFreeRoast() {
  return cardShell(`
    <div class="pricing-tier-label">The Free Roast</div>
    <h3 class="pricing-tier-title">See the fix first</h3>
    <p class="pricing-tier-desc">Alexander personally redesigns your homepage and walks you through the conversion gaps. Expert-led review — every concept Alexander-verified.</p>
    <div class="pricing-price-row"><span class="pricing-price">$0</span></div>
    <ul class="pricing-features">
      ${featureItem("Expert-led conversion audit")}
      ${featureItem("Alexander-verified redesign concept")}
      ${featureItem("Competitor analysis")}
      ${featureItem("Actionable recommendations")}
      ${featureItem("No obligation whatsoever")}
    </ul>
    <a href="#hero" data-scroll-hero class="btn-primary pricing-cta pricing-cta-outline">Get My Free Roast</a>
  `);
}

function renderBuild() {
  return cardShell(`
    <h3 class="pricing-tier-title display">The Build</h3>
    <p class="pricing-tier-desc">A complete, conversion-optimized redesign built to make the phone ring — fast, high-authority, and scoped for focus.</p>
    <div class="pricing-price-row">
      <span class="pricing-price display">$497</span>
      <span class="pricing-price-sub">+ $79/mo hosting</span>
    </div>
    <ul class="pricing-features">
      ${featureItem("Everything in Free Roast")}
      ${featureItem("Up to 10 Pages")}
      ${featureItem("Conversion-optimized layout &amp; copy")}
      ${featureItem("Mobile-first responsive")}
      ${featureItem("SEO optimization")}
      ${featureItem("Contact forms &amp; click-to-call")}
      ${featureItem("Google Analytics setup")}
      ${featureItem("Monthly updates &amp; backups")}
      ${featureItem("30-day money-back guarantee")}
    </ul>
    <a href="mailto:support@usetoolcrate.com?subject=ToolCrate%20Build%20Inquiry" class="btn-primary pricing-cta pricing-cta-outline">Start My Build</a>
  `);
}

function renderPartnership() {
  return cardShell(`
    <h3 class="pricing-tier-title display">The Partnership</h3>
    <p class="pricing-tier-desc">Full-service concierge for high-stakes operators — expert-led strategy with direct access to Alexander.</p>
    <div class="pricing-price-row">
      <span class="pricing-price display">$2,497</span>
      <span class="pricing-price-sub">+ $199/mo maintenance &amp; strategy</span>
    </div>
    <ul class="pricing-features">
      ${featureItem("Everything in The Build")}
      ${featureItem("Strategic Growth Support")}
      ${featureItem("Strategic Page Growth")}
      ${featureItem("Direct Slack/text access to Alexander")}
      ${featureItem("Monthly A/B testing &amp; conversion optimization")}
      ${featureItem("Priority performance audits")}
      ${featureItem("Quarterly strategy calls")}
      ${featureItem("Cancel anytime")}
    </ul>
    <a href="mailto:support@usetoolcrate.com?subject=ToolCrate%20Partnership%20Inquiry" class="btn-primary pricing-cta">Apply for a Spot</a>
  `, "pricing-card-partnership");
}

export function renderPricingCards(container) {
  if (!container) return;
  container.innerHTML = `
    <div class="pricing-grid">
      ${renderFreeRoast()}
      ${renderBuild()}
      ${renderPartnership()}
    </div>
  `;
}
