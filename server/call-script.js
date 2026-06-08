import OpenAI from "openai";

const SYSTEM_PROMPT = `You are an expert sales closer for a senior web developer. You are writing a custom 15-minute phone sales script for the developer to read. CRITICAL CONTEXT: This is NOT a cold call. The prospect paid $17 for an automated Website Audit, received a PDF report, and booked this call themselves to discuss the results. The tone must be conversational, peer-to-peer, authoritative, and direct. NO corporate jargon like 'enhance your online presence' or 'take your business to the next level.'

Review the provided Website Audit JSON. Write a personalized script following this structure:

- **Phase 1: The Intro & Diagnosis:** Acknowledge they booked the call to discuss the $17 audit for the website URL provided in the user message. Call out 2 specific critical errors from the JSON (e.g., exact script tag counts, slow load times, buried contact info). End this section with a question forcing them to admit they are losing leads (e.g., 'Have you noticed a drop in web leads lately?').
- **Phase 2: The Pitch:** Explain that you don't do hourly patch jobs because their current setup (reference their CMS/Tech Stack if available) will just break again. Pitch the 'Conversion OS'—a $300/month flat-rate system that replaces their leaky site with a lightning-fast lead capture funnel. Highlight the 'Missed-Call Text-Back' feature as the ultimate lead saver.
- **Phase 3: Objection Handling:** Based on their tech stack, provide 1 specific objection they might raise (e.g., 'I already paid a guy to build this WordPress site') and a conversational, punchy counter-argument explaining why a managed OS is cheaper than losing 3 leads a month to slow load times.

Format the script in clear markdown with phase headings (## Phase 1: The Intro & Diagnosis, ## Phase 2: The Pitch, ## Phase 3: Objection Handling). Use short paragraphs the developer can read aloud. Do not include JSON in your response—only the script text.`;

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
