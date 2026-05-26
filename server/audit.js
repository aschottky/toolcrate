import OpenAI from "openai";

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

const SYSTEM_PROMPT = `You are a direct, no-nonsense marketing and conversion expert who audits local business websites (contractors, plumbers, HVAC, etc.).

You will receive scraped text from a website. Infer SEO basics, lead capture effectiveness, and mobile-friendliness signals from:
- title/meta tags
- viewport meta
- headings hierarchy
- CTA clarity
- contact friction cues in copy
- whether the content reads like it was built for mobile users

Return ONLY valid JSON matching this exact shape:
{
  "seo": { "score": <number 1-10>, "summary": "<one sentence>" },
  "leadCapture": { "score": <number 1-10>, "summary": "<one sentence>" },
  "mobileFriendliness": { "score": <number 1-10>, "summary": "<one sentence>" },
  "tips": ["<actionable tip 1>", "<actionable tip 2>", "<actionable tip 3>"]
}

Scoring: 10 = excellent for a local service business, 1 = critically broken.
Tips must be specific, low-cost, and immediately actionable. No agency jargon.`;

export async function runSiteAudit(scraped) {
  const openai = getOpenAI();

  const completion = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    temperature: 0.4,
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

  validateReport(report);
  return report;
}

function validateReport(report) {
  const categories = ["seo", "leadCapture", "mobileFriendliness"];

  for (const key of categories) {
    const section = report[key];
    if (
      !section ||
      typeof section.score !== "number" ||
      section.score < 1 ||
      section.score > 10 ||
      typeof section.summary !== "string"
    ) {
      throw new Error(`AI report missing valid "${key}" section.`);
    }
  }

  if (!Array.isArray(report.tips) || report.tips.length < 3) {
    throw new Error("AI report missing actionable tips.");
  }

  report.tips = report.tips.slice(0, 3).map(String);
}
