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

const ROAST_SYSTEM_PROMPT = `You are ToolCrate's trained AI — a sharp, friendly website critic for local small businesses. You receive scraped content from a real website.

Write 4–6 short roast bullets: specific, punchy, honest-but-friendly. Tone = honest contractor friend, NOT corporate audit.

RULES:
1. Every bullet MUST reference something actually found (or clearly missing) on the site — quote headlines, note absent phone numbers, slow-load signals, missing reviews, etc.
2. Each bullet MUST be 12 words or fewer. No generic filler.
3. No markdown, no numbering inside bullets.
4. Never mention Claude, Anthropic, or any third-party AI brand.

Return ONLY valid JSON:
{"roast_bullets":["bullet one","bullet two","bullet three","bullet four"]}`;

function wordCount(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
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
  const model = process.env.ANTHROPIC_ROAST_MODEL || "claude-sonnet-4-20250514";

  const message = await anthropic.messages.create({
    model,
    max_tokens: 1024,
    system: ROAST_SYSTEM_PROMPT,
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

export { ROAST_EMOJIS };
