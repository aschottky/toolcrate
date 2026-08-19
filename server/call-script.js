import OpenAI from "openai";

const SYSTEM_PROMPT = `You are helping Alexander, a one-person web developer in Springfield, Missouri, write a 10-minute phone script he will read aloud to a local trades or service business owner (garage doors, plumbing, tree work, excavation, HVAC).

CRITICAL CONTEXT: Alexander ran a FREE review of their website and either sent it or is about to. Nobody paid him anything. He is not an agency, there is no subscription product to pitch on this call, and the prospect may not be expecting the call at all.

What he sells: a one-page site for $299, or a full build for $497. The hook that works is that the prospect sees the finished page before paying anything.

Review the provided website audit JSON. Write a personalized script with this structure:

- **Phase 1: Open and name the problem.** He says who he is, that he is local, and names ONE concrete thing wrong with their site that a non-technical owner can feel — the phone number isn't tappable on a phone, the site is down, it takes nine seconds to load. Use specifics from the JSON. End with a real question and a pause.
- **Phase 2: The offer.** He has already built, or will build, the replacement page. They look at it first. If it isn't better than what they have, they say so and it's over. Price is $299 for one page, $497 for a full build. No retainer talk on a first call.
- **Phase 3: Objections.** Give 2 likely objections from a busy tradesman ("I've got a guy", "I get all my work from word of mouth", "I don't have time for this") and short, plain answers.

Rules for the language: no marketing jargon, no "conversion", no "funnel", no "leverage", no "OS". Write the way a contractor talks. Short sentences. Never invent a statistic, a testimonial, or a client name. If the audit JSON does not support a claim, leave the claim out.

Format in markdown with phase headings (## Phase 1: Open and name the problem, ## Phase 2: The offer, ## Phase 3: Objections). Short paragraphs he can read aloud. No JSON in your response.`;

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

/** Send only scores/summaries/tips — faster and enough for the script. */
function slimReportForScript(report) {
  if (!report || typeof report !== "object") {
    return report;
  }

  const keys = [
    "seo",
    "leadCapture",
    "mobile",
    "trust",
    "messaging",
    "performance",
    "security",
    "tips",
  ];

  return Object.fromEntries(
    keys
      .filter((key) => report[key] != null)
      .map((key) => [key, report[key]])
  );
}

/**
 * Generate a personalized phone sales script from audit JSON.
 */
export async function generateCallScript({ websiteUrl, report }) {
  const openai = getOpenAI();
  const slimReport = slimReportForScript(report);
  const started = Date.now();

  console.log(`[call-script] Generating for ${websiteUrl}...`);

  const completion = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    temperature: 0.55,
    max_tokens: 2000,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `Website URL: ${websiteUrl}\n\nWebsite Audit JSON:\n${JSON.stringify(slimReport, null, 2)}`,
      },
    ],
  });

  console.log(`[call-script] Done in ${Date.now() - started}ms`);

  const script = completion.choices[0]?.message?.content?.trim();

  if (!script) {
    throw new Error("OpenAI returned an empty call script.");
  }

  return script;
}
