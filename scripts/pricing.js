/** High-Stakes Concierge pricing — rendered into #pricing-cards on the homepage. */

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function scarcityLabel() {
  const now = new Date();
  const month = MONTH_NAMES[now.getMonth()];
  return `4/6 Slots Remaining for ${month}`;
}

function featureItem(text, accent = "#34d399", textColor = "#a1a1aa") {
  return `<li style="display:flex;align-items:flex-start;gap:0.75rem;color:${textColor};margin-bottom:1rem;"><span style="color:${accent};font-size:1.125rem;">✓</span> ${text}</li>`;
}

function cardShell(content, className = "") {
  return `<div class="pricing-card ${className}">${content}</div>`;
}

function renderFreeRoast() {
  return cardShell(`
    <div class="pricing-tier-label pricing-tier-muted">The Free Roast</div>
    <h3 class="pricing-tier-title">See the fix first</h3>
    <p class="pricing-tier-desc">Alexander personally redesigns your homepage and walks you through the conversion gaps. Expert-led review — every concept Alexander-verified.</p>
    <div class="pricing-price-row"><span class="pricing-price">$0</span></div>
    <ul class="pricing-features">
      ${featureItem("Expert-led conversion audit")}
      ${featureItem("Alexander-verified redesign concept")}
      ${featureItem("Competitor analysis")}
      ${featureItem("Actionable recommendations")}
      ${featureItem("No obligation whatsoever", "#34d399", "#a1a1aa").replace("margin-bottom:1rem", "")}
    </ul>
    <a href="#hero" data-scroll-hero class="btn-primary pricing-cta pricing-cta-outline">Get My Free Roast</a>
  `);
}

function renderFoundation() {
  return cardShell(`
    <div class="pricing-tier-label pricing-tier-build">The Build</div>
    <h3 class="pricing-tier-title">The Foundation</h3>
    <p class="pricing-tier-desc">A complete, conversion-optimized redesign built to make the phone ring — fast, high-authority, scoped with a hard page cap. No ongoing strategy retainer.</p>
    <div class="pricing-price-row">
      <span class="pricing-price display">$497</span>
      <span class="pricing-price-sub">+ $79/mo hosting</span>
    </div>
    <div class="pricing-price-note">Up to 10 pages · hosting &amp; updates included</div>
    <ul class="pricing-features">
      ${featureItem("Everything in Free Roast", "#f97316", "#d4d4d8")}
      ${featureItem('<strong style="color:white;">Up to 10 pages</strong> <span style="color:#71717a;">(hard scope cap)</span>', "#f97316", "#d4d4d8")}
      ${featureItem("Conversion-optimized layout &amp; copy", "#60a5fa", "#d4d4d8")}
      ${featureItem("Mobile-first responsive", "#60a5fa", "#d4d4d8")}
      ${featureItem("SEO optimization", "#60a5fa", "#d4d4d8")}
      ${featureItem("Contact forms &amp; click-to-call", "#60a5fa", "#d4d4d8")}
      ${featureItem("Google Analytics setup", "#60a5fa", "#d4d4d8")}
      ${featureItem("Monthly updates &amp; backups", "#60a5fa", "#d4d4d8")}
      ${featureItem("30-day money-back guarantee", "#60a5fa", "#d4d4d8").replace("margin-bottom:1rem", "")}
    </ul>
    <a href="mailto:support@usetoolcrate.com?subject=ToolCrate%20Foundation%20Build%20Inquiry" class="btn-primary pricing-cta">Start My Build →</a>
  `, "pricing-card-foundation");
}

function renderGrowthEngine() {
  const scarcity = scarcityLabel();
  return cardShell(`
    <div class="pricing-badge pricing-badge-scarcity">${scarcity}</div>
    <div class="pricing-badge pricing-badge-recommended">RECOMMENDED FOR $1M+ OPERATORS</div>
    <div class="pricing-tier-label pricing-tier-partnership">The Partnership</div>
    <h3 class="pricing-tier-title">The Growth Engine</h3>
    <p class="pricing-tier-desc"><strong style="color:#fef3c7;">Full Service Concierge.</strong> Alexander-in-your-pocket for high-stakes operators — expert-led strategy, not an account-manager queue.</p>
    <div class="pricing-price-row">
      <span class="pricing-price display">$2,497</span>
      <span class="pricing-price-sub">+ $199/mo maintenance &amp; strategy</span>
    </div>
    <div class="pricing-price-note">Strategic Page Growth · priority performance cadence</div>
    <ul class="pricing-features">
      ${featureItem("Everything in The Foundation", "#fbbf24", "#e4e4e7")}
      ${featureItem('<strong style="color:#fef3c7;">Strategic Growth Support</strong>', "#fbbf24", "#e4e4e7")}
      ${featureItem('<strong style="color:#fef3c7;">Strategic Page Growth</strong> <span style="color:#a1a1aa;">(not unlimited churn)</span>', "#fbbf24", "#e4e4e7")}
      ${featureItem("Direct Slack/text access to Alexander", "#34d399", "#d4d4d8")}
      ${featureItem("Monthly A/B testing &amp; conversion optimization", "#34d399", "#d4d4d8")}
      ${featureItem("Priority performance audits", "#34d399", "#d4d4d8")}
      ${featureItem("Quarterly strategy calls", "#34d399", "#d4d4d8")}
      ${featureItem("Cancel anytime", "#34d399", "#d4d4d8").replace("margin-bottom:1rem", "")}
    </ul>
    <a href="mailto:support@usetoolcrate.com?subject=ToolCrate%20Growth%20Engine%20Partnership" class="btn-primary pricing-cta pricing-cta-premium">Apply for a Partnership Spot →</a>
  `, "pricing-card-premium");
}

export function renderPricingCards(container) {
  if (!container) return;
  container.innerHTML = `
    <div class="pricing-grid">
      ${renderFreeRoast()}
      ${renderFoundation()}
      ${renderGrowthEngine()}
    </div>
  `;
}
