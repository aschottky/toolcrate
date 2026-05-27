import OpenAI from "openai";
import { AUDIT_CATEGORY_KEYS } from "./categories.js";

let openaiClient;

function getOpenAI() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured on the server.");
  }
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openaiClient;
}

const SYSTEM_PROMPT = `You are a senior conversion rate optimization (CRO) and technical web consultant who tears down local business websites (contractors, plumbers, HVAC, dentists, etc.). The client paid for a blunt, evidence-based audit — not generic marketing fluff.

You receive scraped page content including visible copy PLUS technical signals: <head> HTML, meta generator (CMS), script tag count, image counts, missing alt attributes, and lazy-loading usage. Use ALL of this evidence.

RULES — follow strictly:
1. NEVER give vague advice. Every claim must reference something concrete from the scrape: quoted copy, exact counts ("24 script tags"), meta generator value, missing alts, or a named absence.
2. Act aggressive and direct. Call out revenue leaks and technical debt that costs leads, speed, and security.
3. Section summaries: write 2–3 full sentences each (roughly 40–90 words). Structure: what you found → why it hurts the business → what it costs them.
4. Category focus:
   - seo: titles, meta, headings, local/map signals.
   - leadCapture: CTAs, phone visibility, forms, friction.
   - mobile: viewport, mobile-readable copy, thumb UX cues.
   - trust: testimonials, reviews, licenses, address, guarantees — quote or note absences.
   - messaging: hero/headline value prop, service area clarity — quote actual headlines.
   - performance: script bloat, image optimization, lazy-loading gaps, mobile load risk — cite the numeric signals.
   - security: CMS/platform from meta generator or head HTML (WordPress, Wix, Squarespace, etc.), outdated/vulnerable stack risk, maintenance burden — be specific or say "could not detect CMS" with what you did see.
5. Tips: exactly 3 items. Each tip MUST use Problem → Solution → Impact as separate fields.
6. Scores 1–10 (10 = excellent for a local service business, 1 = critical). Score must match severity in your copy.

Return ONLY valid JSON matching this exact shape:
{
  "seo": { "score": <number 1-10>, "summary": "<2-3 sentences>" },
  "leadCapture": { "score": <number 1-10>, "summary": "<2-3 sentences>" },
  "mobile": { "score": <number 1-10>, "summary": "<2-3 sentences>" },
  "trust": { "score": <number 1-10>, "summary": "<2-3 sentences>" },
  "messaging": { "score": <number 1-10>, "summary": "<2-3 sentences>" },
  "performance": { "score": <number 1-10>, "summary": "<2-3 sentences>" },
  "security": { "score": <number 1-10>, "summary": "<2-3 sentences>" },
  "tips": [
    {
      "problem": "<Specific issue with evidence — 1-2 sentences>",
      "solution": "<Concrete fix this week — 1-2 sentences>",
      "impact": "<Business outcome if fixed — 1 sentence>"
    }
  ]
}

No markdown. No extra keys. No preamble.`;

export async function runSiteAudit(scraped) {
  const openai = getOpenAI();

  const completion = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    temperature: 0.45,
    max_tokens: 4000,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `Audit this website content and return the JSON report:\n\n${scraped.textForAudit}`,
      },
    ],
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) {
    throw new Error("OpenAI returned an empty response.");
  }

  let report;

  try {
    report = JSON.parse(raw);
  } catch {
    throw new Error("OpenAI returned invalid JSON.");
  }

  normalizeLegacyKeys(report);
  validateReport(report);
  return report;
}

function normalizeLegacyKeys(report) {
  if (!report.mobile && report.mobileFriendliness) {
    report.mobile = report.mobileFriendliness;
    delete report.mobileFriendliness;
  }
}

function validateReport(report) {
  for (const key of AUDIT_CATEGORY_KEYS) {
    const section = report[key];
    if (
      !section ||
      typeof section.score !== "number" ||
      section.score < 1 ||
      section.score > 10 ||
      typeof section.summary !== "string" ||
      section.summary.trim().length < 40
    ) {
      throw new Error(`AI report missing valid "${key}" section.`);
    }
  }

  if (!Array.isArray(report.tips) || report.tips.length < 3) {
    throw new Error("AI report missing actionable tips.");
  }

  report.tips = report.tips.slice(0, 3).map(normalizeTip);
}

function normalizeTip(tip) {
  if (typeof tip === "string") {
    return {
      problem: tip,
      solution: "See full audit for implementation steps.",
      impact: "Addressing this should improve conversions.",
    };
  }

  const problem = String(tip?.problem ?? "").trim();
  const solution = String(tip?.solution ?? "").trim();
  const impact = String(tip?.impact ?? "").trim();

  if (!problem || !solution || !impact) {
    throw new Error("Each tip must include problem, solution, and impact.");
  }

  return { problem, solution, impact };
}
