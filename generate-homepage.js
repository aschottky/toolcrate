import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { generateRedesignHtml } from "./server/redesign-claude.js";
import {
  DEFAULT_REDESIGN_MAX_TOKENS,
  resolveRedesignEngine,
} from "./server/redesign-engines.js";
import { DEFAULT_PUBLIC_REDESIGN_ENGINE } from "./server/anthropic-models.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = join(__dirname, "index.html");

const SCRAPED_SITE_DATA = `
BUSINESS NAME: ToolCrate
TAGLINE: AI done right.
OWNER: Alexander Schottky - since 2009 of real website and conversion experience
CORE MESSAGE: Most contractor websites exist. Very few actually work. Submit your URL and Alexander will personally prepare a custom conversion redesign—free, no commitment.
TONE: Real, honest, slightly witty. No hype. No dashboards. No nonsense.
TARGET CUSTOMER: Contractors, roofers, local service businesses who are overwhelmed by tech and just want their phone to ring.
POSITIONING: Expert-led conversion redesign by Alexander Schottky—real experience since 2009, without the $15,000 agency price tag.

PRODUCTS:
- Free Redesign Review (name, email, URL required — expert-curated, delivered to inbox) → CTA: "Request My Custom Redesign" → links to /try
- Full Build: $497 setup + $99/mo → CTA: "Let's build it"
- Conversion OS (founding member): $2,500 + $997/mo, includes monthly iterations, Loom walkthroughs, and every new ToolCrate tool free forever → CTA: "Apply for founding membership"

KEY COPY LINES TO USE:
- "Your website isn't broken. It's just... not doing anything."
- "I didn't automate the soul out of it. Every site gets a personal review."
- "Don't fall for the 'make millions overnight' AI hype."
- "No dashboard. No drag and drop. Just results."
- Never promise instant results, 3-minute previews, or speed — emphasize expert-led personal review by Alexander.
- The primary CTA should appear at least twice: once in the hero, once at the bottom.

DESIGN DIRECTION:
- Dark, premium, modern - think Vercel or Linear but warmer
- Hero section full width with headline + subheadline + CTA button
- Mid-page: "The Problem" section (relatable pain points)
- "Who is Alexander" section with human tone
- Product ladder (3 tiers, clean cards)
- Closing section with final CTA
- Footer: "ToolCrate - AI done right. Built by Alexander Schottky"
`.trim();

const textForAudit = `
This is NOT a contractor website redesign. Generate the SaaS marketing homepage for ToolCrate — an AI-powered website redesign service built by Alexander Schottky, targeting small business owners and contractors who are frustrated with complicated website tools and empty promises.

Use the following as your source content (no URL scraping — this is the complete brief):

${SCRAPED_SITE_DATA}
`.trim();

async function main() {
  const engine = resolveRedesignEngine(
    process.env.PUBLIC_REDESIGN_ENGINE || DEFAULT_PUBLIC_REDESIGN_ENGINE
  );

  const result = await generateRedesignHtml(
    { textForAudit, imageUrls: [] },
    { model: engine.model, maxTokens: DEFAULT_REDESIGN_MAX_TOKENS }
  );

  mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
  writeFileSync(OUTPUT_PATH, result.html, "utf8");
  console.log("Homepage generated successfully");
}

main().catch((error) => {
  console.error("Homepage generation failed:", error.message);
  process.exit(1);
});
