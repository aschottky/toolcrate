# Website audit: usetoolcrate.com (HeyCatch, Aug 3, 2026)

Source: HeyCatch Growth Audit > Website optimization. Score 54/100 ("Needs work").
Describes the site as of Aug 3, 2026. Verify each item against the live site before acting; some may already be fixed.

## Gut reaction
Confident, well-written founder-led copy that nails the trade owner's vocabulary and pain, but floats on zero proof. The claims (200+ sites, 3x leads, 15 years) have nothing behind them: no testimonials, no client URLs, no verifiable founder identity, and the /pricing and /about routes 404.

Spotlight competitors: ServiceBuilt Digital (closest ICP) and Buildrok (most successful). See competitors.md.

Summary: the voice, the pain match, and the transactional offer are genuinely good, but the site is gutted by a total absence of proof (D3.2 0/5, D3.1 1/4, D3.5 0/3), a broken pricing surface (empty pricing cards, /pricing 404), and missing SEO/AI foundations (no sitemap, no robots.txt, no OG, no schema, no /vs pages). The fastest gains are trust artifacts and fixing the pricing render, not more copy.

## Scorecard

| Criterion | Score | Status | Key finding |
|-----------|-------|--------|-------------|
| D1.1 Hook | 4/6 | Partial | Hero nails outcome and voice but names no category or ICP in the first line. |
| D1.2 Pain match | 4/5 | Pass | Problem section hits the top three audience pains in their own words. |
| D1.3 JTBD coverage | 3/4 | Pass | Six pillars map to the trade owner's jobs but a couple stay feature-framed. |
| D1.4 Objection handling | 1/3 | Fail | The top objection (is $497 a template with no proof) goes unanswered above the fold. |
| D1.5 Desired-result visualization | 1/3 | Fail | No before/after or product screenshot; hero shows only a founder portrait. |
| D1.6 Audience language | 4/4 | Pass | Copy uses make-the-phone-ring, brochure, no template fat verbatim from VoC. |
| D2.1 5-second comprehension | 4/7 | Partial | You grasp the outcome fast but not what the product actually is. |
| D2.2 CTA hierarchy | 4/5 | Pass | One consistent primary CTA repeated, but label drifts between preview and roast. |
| D2.3 Visual hierarchy and scroll flow | 4/5 | Pass | Clear alternating sections and intentional scroll rhythm. |
| D2.4 Friction and navigation | 2/4 | Partial | Nav Pricing/About links jump to anchors; standalone /pricing and /about 404. |
| D2.5 Mobile experience | 2/4 | Partial | Viewport and mobile-first copy present but no device test possible; capped. |
| D2.B Scope honesty bonus | +1/2 | Partial | Names who it is for, never explicitly who it is not for. |
| D3.1 Quantity proof | 1/4 | Fail | 200+ and 3x are bare animated counters with no avatars, sources, or dates. |
| D3.2 Story proof | 0/5 | Fail | Zero testimonials, faces, or named clients anywhere on the site. |
| D3.3 Founder-led trust | 2/4 | Partial | Founder photo and story present, but no LinkedIn, company entity, or address. |
| D3.4 Transactional trust | 3/4 | Pass | Free preview, no card, 30-day guarantee; strong, but guarantee is buried in FAQ. |
| D3.5 Third-party and recency signals | 0/3 | Fail | No reviews, press, Product Hunt, or dated third-party signal of any kind. |
| D4.1 Location and accessibility | 1/2 | Partial | Pricing is an anchor only; the /pricing route 404s. |
| D4.2 Tier and offer design | 2/4 | Partial | Single build + care price shown in Results block; the pricing section renders empty. |
| D4.3 Paywall and conversion mechanics | 1/5 | Fail | Pricing cards container is empty; no tiers, badge, or period toggle render. |
| D4.4 Pricing vs competitors | 2/4 | Partial | $497 model is clear and undercuts peers, but reasoning for the low price is thin. |
| D5.1 Title and meta description | 2/3 | Pass | Homepage title and description are value-prop rich; other pages 404. |
| D5.2 Heading structure | 2/2 | Pass | Single H1 with a clean descending H2/H3 outline. |
| D5.3 Indexable content, /vs pages, internal linking | 1/4 | Fail | No sitemap, no robots.txt, no /vs pages; pricing content is JS-injected and empty. |
| D5.4 Page speed | 3/3 | Pass | Homepage is 13 KB at 94 ms. |
| D5.5 AI-driven discovery and structured data | 0/3 | Fail | No Open Graph, no JSON-LD, no llms.txt, empty alt on the results image. |

## Action plan (impact x effort; 1-5 are "top 5 this month")

### Quick wins (low effort)
1. **Fix the empty pricing section; render $497 + $79/mo as real cards.** Homepage #pricing (empty `div id="pricing-cards"`) and the /pricing route. Render two server-side cards, "The Build $497 (one-time)" and "Clear Monthly Care $79/mo", with a highlighted default tier, a "Most popular" badge on the bundle, and the "You save $9,500+ vs agencies" anchor beside them; make /pricing a real mirror page. Metric: pricing-section-to-/try/ click-through +3 pp over 4 weeks.
2. **Add a money-back + no-card + ownership line under the primary CTA.** Hero and final CTA blocks. One line: "Free preview, no card. The Build is backed by a 30-day money-back guarantee. You own all the files, no lock-in." Metric: hero-CTA click-through +2 pp.
3. **Add a verifiable founder identity block.** About section and footer: real LinkedIn/X link, operating company name, city/state. Metric: About-to-/try/ progression +2 pp.
4. **Rename the off-voice "Get My Free Roast" CTA** to "Get YOUR Free Website Preview" so every CTA uses one label ("roast" is an outsider tell for this audience). Metric: anatomy-block CTA within 1 pp of hero CTA.
5. **Publish robots.txt and sitemap.xml** (both 404). Permissive robots.txt (allow GPTBot, ClaudeBot, PerplexityBot, OAI-SearchBot) referencing a sitemap listing the homepage, /blog/ and posts, /privacy, /terms. Metric: +5 indexed pages in GSC within 60 days.
6. **Add Open Graph, Twitter Card, Organization and FAQ schema.** OG/Twitter tags with a branded preview image; Organization JSON-LD (name, url, logo, founder, sameAs LinkedIn); FAQPage JSON-LD over the six FAQ questions. Metric: all validation checks passing (from 0/6).
7. **Descriptive alt text on key images.** Results background image has `alt=""`; every example-build screenshot should ship with alt like "ToolCrate redesign of a roofing site showing a sticky click-to-call bar."

### Do this quarter (medium effort)
8. **Testimonial wall of named client quotes with faces.** New homepage section between Results and How It Works. At least three real-named quotes (first name, trade, city, one-line outcome) with photos; start with permissioned screenshots if needed. The single most damaging gap. Metric: homepage-to-/try/ +3 pp over 8 weeks.
9. **Before/after example-build showcase.** 2-3 real before/after artifacts or live example-build URLs showing a converting trade site (visible click-to-call, service/city pages). Metric: hero + showcase CTA +3 pp.
10. **Name the category and ICP in the hero.** Keep the outcome H1; add a subhead opener like "Conversion websites for contractors and high-stakes service firms." Metric: category-search conversion +2 pp.
11. **Defend the $497 price.** Beneath the $497 vs $10K-$25K comparison, a short "why it's $497, not $3,500" (no agency overhead, direct-to-founder, edge-hosted single-operator model) plus one proof point. Metric: Results-to-/try/ +2 pp.
12. **Remove or reframe the "Rachel" call-in AI game.** The "get our AI to admit she's a robot" contest undercuts the human-operator trust the site sells and feeds the "is Alexander real" doubt. If kept, separate it clearly from the founder-led promise.
13. **Restore /about and /features as real indexable pages** with distinct titles and descriptions (nav links currently point at anchors; routes 404). Metric: +2 indexed pages within 60 days.

### Bigger bets (high effort)
14. **Build /vs comparison pages**: ToolCrate vs Wix, vs a $10K agency build, vs done-for-you rivals. Each with a comparison table, the ownership/no-lock-in objection answers, and FAQ schema. Buildrok already proves the pattern with /compare pages. Metric: +200 organic clicks to /vs pages over 90 days.
