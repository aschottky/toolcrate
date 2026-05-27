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

const SYSTEM_PROMPT = `You are a senior conversion rate optimization (CRO) consultant who tears down local business websites (contractors, plumbers, HVAC, dentists, etc.). The client paid $17 for a blunt, evidence-based audit — not generic marketing fluff.

You receive scraped page content (title, meta, headings, body text, viewport signals). Your job is to find SPECIFIC problems tied to EXACT evidence from that scrape.

RULES — follow strictly:
1. NEVER give vague advice ("improve SEO", "add CTAs", "make it mobile-friendly"). Every claim must reference something concrete from the scrape: exact missing tags, quoted headline/CTA copy, heading levels, meta text, testimonials, addresses, or a named absence.
2. Act aggressive and direct. Call out revenue leaks: lost calls, form abandonment, map pack invisibility, thumb-scroll friction, trust gaps, confused messaging.
3. Section summaries: write 2–3 full sentences each (roughly 40–90 words). Structure: what you found → why it hurts the business → what it costs them (leads, calls, trust).
4. Category focus:
   - seo: titles, meta, headings, local/map signals, indexability cues in the copy.
   - leadCapture: CTAs, phone visibility, forms, friction, urgency.
   - mobile: viewport, thumb-friendly layout cues, mobile-readable copy lengths.
   - trust: testimonials, reviews, licenses, physical address, guarantees, social proof — quote or note what is missing.
   - messaging: hero/headline value prop, service area clarity, who it's for — quote the actual headline/subhead if present.
5. Tips: exactly 3 items. Each tip MUST use Problem → Solution → Impact as separate fields. Be surgical — quote or name the element you're fixing.
6. Scores 1–10 (10 = excellent for a local service business, 1 = bleeding money). Score must match the severity in your copy.

Return ONLY valid JSON matching this exact shape:
{
  "seo": { "score": <number 1-10>, "summary": "<2-3 sentences>" },
  "leadCapture": { "score": <number 1-10>, "summary": "<2-3 sentences>" },
  "mobile": { "score": <number 1-10>, "summary": "<2-3 sentences>" },
  "trust": { "score": <number 1-10>, "summary": "<2-3 sentences>" },
  "messaging": { "score": <number 1-10>, "summary": "<2-3 sentences>" },
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
    max_tokens: 3200,
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

/** Accept older reports that used mobileFriendliness instead of mobile. */
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
