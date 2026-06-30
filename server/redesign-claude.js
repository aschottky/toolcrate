import Anthropic from "@anthropic-ai/sdk";
import { CLAUDE_SONNET_REDESIGN_MODEL } from "./anthropic-models.js";
import { enrichRedesignError, logRedesignFailure } from "./errors.js";
import {
  buildUserMessage,
  buildRedesignGenerationResult,
  CLAUDE_REDESIGN_APPENDIX,
  extractWebsiteUrlFromScraped,
  filterLoadableImageUrls,
  prepareRedesignHtml,
  REDESIGN_SYSTEM_PROMPT,
  validateRedesignHtml,
} from "./redesign.js";

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

const CLAUDE_REDESIGN_SYSTEM_PROMPT = `${REDESIGN_SYSTEM_PROMPT}

${CLAUDE_REDESIGN_APPENDIX}`;

const MAX_ATTEMPTS = 3;

function buildRetryNote(attempt, lastError, stopReason) {
  if (attempt === 1) return "";

  const parts = [
    "",
    `RETRY ${attempt}/${MAX_ATTEMPTS} — your previous output was rejected.`,
  ];

  if (stopReason === "max_tokens") {
    parts.push(
      "The HTML was TRUNCATED (hit max_tokens). Generate a complete page that fits: keep CSS compact, fewer sections if needed, but MUST include Google Fonts @import, @media (768px and 480px), and a closing </html> tag."
    );
  } else if (lastError?.message) {
    parts.push(`Validation error: ${lastError.message}`);
    parts.push(
      "Fix this and output the FULL corrected HTML file only. Required: Google Fonts @import in <style>, @media queries, no emoji icons, closing </html>."
    );
  }

  return parts.join("\n");
}

/**
 * Generate a single-file landing page redesign via Claude (primary redesign engine).
 * Runs sanitize → prepareRedesignHtml → validateRedesignHtml before returning.
 *
 * @param {{ textForAudit: string, imageUrls?: string[] }} scraped — output of scrapeWebsiteText()
 * @returns {Promise<{ html: string, styleDirection: string, heroHeadline: string|null, primaryAccentColor: string|null }>}
 */
export async function generateRedesignHtml(scraped, options = {}) {
  const anthropic = getAnthropic();
  const imageUrls = await filterLoadableImageUrls(scraped.imageUrls);
  const exclusions = options.generationExclusions ?? {};
  const { message: baseUserMessage, styleDirection } = buildUserMessage(scraped, imageUrls, {
    styleDirection: options.styleDirection,
    usedStyleDirections: exclusions.styleDirections ?? [],
    previousHeadlines: exclusions.heroHeadlines ?? [],
    previousAccentColors: exclusions.primaryAccentColors ?? [],
  });
  const model = options.model || CLAUDE_SONNET_REDESIGN_MODEL;
  console.log(`[redesign] Using model: ${model}, style: ${styleDirection.slug}`);
  const maxTokens = Number(options.maxTokens) || 32000;
  let lastError;
  let lastStopReason = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const retryNote = buildRetryNote(attempt, lastError, lastStopReason);
    let message;
    let stopReason = null;
    try {
      const stream = anthropic.messages.stream({
        model,
        max_tokens: maxTokens,
        system: CLAUDE_REDESIGN_SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: baseUserMessage + retryNote,
          },
        ],
      });
      message = await stream.finalMessage();
      stopReason = message.stop_reason;
    } catch (error) {
      lastStopReason = null;
      lastError = enrichRedesignError(error);
      logRedesignFailure("[redesign]", lastError, {
        attempt,
        maxAttempts: MAX_ATTEMPTS,
        model,
        phase: "anthropic-api",
      });
      continue;
    }

    if (message.stop_reason === "max_tokens") {
      lastStopReason = "max_tokens";
      lastError = enrichRedesignError(
        new Error("Claude redesign output was truncated (max_tokens).")
      );
      lastError.code = "REDESIGN_TRUNCATED";
      console.warn(
        `[redesign] Attempt ${attempt}/${MAX_ATTEMPTS}: truncated output (code=REDESIGN_TRUNCATED).`
      );
      continue;
    }

    const raw = message.content?.[0]?.text;
    if (!raw) {
      lastError = enrichRedesignError(
        new Error("Claude returned an empty redesign response.")
      );
      lastError.code = "REDESIGN_EMPTY_RESPONSE";
      console.warn(
        `[redesign] Attempt ${attempt}/${MAX_ATTEMPTS}: empty response (code=REDESIGN_EMPTY_RESPONSE).`
      );
      continue;
    }

    try {
      const websiteUrl =
        options.websiteUrl || extractWebsiteUrlFromScraped(scraped);
      const html = prepareRedesignHtml(raw, websiteUrl);
      validateRedesignHtml(html);
      console.log(
        `[redesign] Attempt ${attempt}/${MAX_ATTEMPTS} succeeded (${html.length} chars, style=${styleDirection.slug}).`
      );
      return buildRedesignGenerationResult(html, styleDirection.slug);
    } catch (error) {
      lastStopReason = stopReason;
      lastError = enrichRedesignError(error);
      console.warn(
        `[redesign] Attempt ${attempt}/${MAX_ATTEMPTS} failed validation [code=${lastError.code}]:`,
        lastError.message
      );
    }
  }

  throw enrichRedesignError(
    lastError ?? new Error("Redesign generation failed."),
    "Redesign generation failed."
  );
}

/** @deprecated Use generateRedesignHtml — kept for existing imports. */
export const generateRedesignHtmlClaude = generateRedesignHtml;
