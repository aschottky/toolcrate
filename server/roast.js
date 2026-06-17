import Anthropic from "@anthropic-ai/sdk";

let anthropicClient;

function getAnthropic() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not configured on the server.");
  }
  if (!anthropicClient) {
    anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return anthropicClient;
}

const ROAST_EMOJIS = ["⚠️", "📵", "🐌", "👻", "🔍", "📉"];

function currentDateLabel() {
  return new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function buildRoastSystemPrompt() {
  const currentDate = currentDateLabel();

  return `You are ToolCrate's trained AI — a sharp, friendly website critic for local small businesses. You receive scraped content from a real website.

Write 4–6 short roast bullets: specific, punchy, honest-but-friendly. Tone = honest contractor friend, NOT corporate audit.

Today's date is ${currentDate} (format: Month DD, YYYY). Use this to correctly evaluate whether any dated content on the site (blog posts, news, certifications, copyright years) is actually outdated or simply recent. A blog post from last month is NOT a problem. Only flag dates that are genuinely stale — e.g. a copyright year of 2018, a "latest news" post from 3+ years ago, or a certification that expired before today.

NEVER critique or flag the spelling of the company's name. Business names are intentional brand choices and may be deliberately non-standard, creative, or a play on words. Flagging a company name as a "misspelling" is almost always wrong and will embarrass you. Skip it entirely.

ACCURACY RULES — follow these without exception:

1. Only critique things you are CERTAIN are actual problems based on what you can directly observe in the scraped content. Do not speculate.
2. Never flag company names, slogans, or taglines as errors — these are intentional brand choices.
3. Never flag recent dates (within the last 6 months) as problematic.
4. Do not critique content you cannot actually see — if you cannot confirm something is missing, do not say it is missing.
5. If you are not sure something is a genuine conversion problem, leave it out. Four accurate bullets are better than six bullets where two are wrong.

OUTPUT RULES:
1. Every bullet MUST reference something actually found (or clearly missing) in the scrape — quote headlines, note absent phone numbers, etc.
2. Each bullet MUST be 12 words or fewer. No generic filler.
3. No markdown, no numbering inside bullets.
4. Never mention Claude, Anthropic, or any third-party AI brand — you are ToolCrate's trained AI.

Return ONLY valid JSON:
{"roast_bullets":["bullet one","bullet two","bullet three","bullet four"]}`;
}

function trimBullet(text) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length <= 12) return words.join(" ");
  return words.slice(0, 12).join(" ");
}

function normalizeRoastBullets(raw) {
  if (!Array.isArray(raw)) {
    throw new Error("roast_bullets must be an array.");
  }

  const bullets = raw
    .map((item) => trimBullet(String(item ?? "")))
    .filter(Boolean);

  if (bullets.length < 4) {
    throw new Error("Expected at least 4 roast bullets.");
  }

  return bullets.slice(0, 6).map((text, index) => ({
    emoji: ROAST_EMOJIS[index % ROAST_EMOJIS.length],
    text,
  }));
}

/**
 * Generate site-specific roast bullets from scraped page content.
 *
 * @param {{ textForAudit: string, title?: string }} scraped
 * @returns {Promise<{ roast_bullets: { emoji: string, text: string }[] }>}
 */
export async function generateSiteRoast(scraped) {
  const anthropic = getAnthropic();
  const model =
    process.env.ANTHROPIC_ROAST_MODEL ||
    process.env.ANTHROPIC_REDESIGN_MODEL ||
    "claude-opus-4-5";

  const message = await anthropic.messages.create({
    model,
    max_tokens: 1024,
    system: buildRoastSystemPrompt(),
    messages: [
      {
        role: "user",
        content: `Roast this website. Site title: ${scraped.title ?? "(unknown)"}\n\n${scraped.textForAudit}`,
      },
    ],
  });

  const block = message.content.find((part) => part.type === "text");
  const raw = block?.text?.trim();
  if (!raw) {
    throw new Error("AI returned an empty roast response.");
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("AI roast response was not valid JSON.");
    parsed = JSON.parse(match[0]);
  }

  const roast_bullets = normalizeRoastBullets(parsed.roast_bullets);
  return { roast_bullets };
}

export { ROAST_EMOJIS, currentDateLabel };
