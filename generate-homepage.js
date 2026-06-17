import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { generateRedesignHtmlClaude } from "./server/redesign-claude.js";
import {
  DEFAULT_REDESIGN_MAX_TOKENS,
  resolveRedesignEngine,
} from "./server/redesign-engines.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = join(__dirname, "index.html");

const SCRAPED_SITE_DATA = `
BUSINESS NAME: ToolCrate
TAGLINE: AI done right.
OWNER: Alexander Schottky - 20+ years of real website and conversion experience
CORE MESSAGE: Most contractor websites exist. Very few actually work. We show you what yours could look like - free, in 60 seconds.
TONE: Real, honest, slightly witty. No hype. No dashboards. No nonsense.
TARGET CUSTOMER: Contractors, roofers, local service businesses who are overwhelmed by tech and just want their phone to ring.
POSITIONING: Alexander replicated his decades of experience into AI so more businesses can access what used to cost thousands.

PRODUCTS:
- Free Design Preview (no email, no credit card - just see it) → CTA: "Get my free Design Preview" → links to /try
- Full Build: $497 setup + $99/mo → CTA: "Let's build it"
- Conversion OS (founding member): $2,500 + $997/mo, includes monthly iterations, Loom walkthroughs, and every new ToolCrate tool free forever → CTA: "Apply for founding membership"

KEY COPY LINES TO USE:
- "Your website isn't broken. It's just... not doing anything."
- "I didn't automate the soul out of it. I just made it faster."
- "Don't fall for the 'make millions overnight' AI hype."
- "I basically replicated myself in AI."
- "No dashboard. No drag and drop. Just results."
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
    process.env.PUBLIC_REDESIGN_ENGINE || "claude-opus"
  );

  const html = await generateRedesignHtmlClaude(
    { textForAudit, imageUrls: [] },
    { model: engine.model, maxTokens: DEFAULT_REDESIGN_MAX_TOKENS }
  );

  mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
  writeFileSync(OUTPUT_PATH, html, "utf8");
  console.log("Homepage generated successfully");
}

main().catch((error) => {
  console.error("Homepage generation failed:", error.message);
  process.exit(1);
});
