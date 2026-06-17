import { generateRedesignHtml } from "./redesign.js";
import { generateRedesignHtmlClaude } from "./redesign-claude.js";
import { CLAUDE_OPUS_MODEL } from "./anthropic-models.js";

export const DEFAULT_REDESIGN_MAX_TOKENS = 32000;

/**
 * Engines selectable from the admin dashboard when ordering a redesign.
 * Key = stable id stored in Supabase; model = exact slug sent to the API.
 */
export const REDESIGN_ENGINES = {
  "claude-opus": {
    label: "Claude Opus 4.5 (best quality, ~2 min)",
    model: CLAUDE_OPUS_MODEL,
    generate: generateRedesignHtmlClaude,
  },
  "claude-sonnet": {
    label: "Claude Sonnet 4.5 (fast, strong quality)",
    model: "claude-sonnet-4-5",
    generate: generateRedesignHtmlClaude,
  },
  "gpt-4o": {
    label: "GPT-4o (fastest, cheapest)",
    model: "gpt-4o",
    generate: generateRedesignHtml,
  },
};

export function resolveRedesignEngine(engineId) {
  const engine = REDESIGN_ENGINES[engineId];
  if (!engine) {
    const err = new Error(
      `Unknown engine "${engineId}". Use one of: ${Object.keys(REDESIGN_ENGINES).join(", ")}.`
    );
    err.statusCode = 400;
    throw err;
  }
  return { id: engineId, ...engine };
}

export function listRedesignEngines() {
  return Object.entries(REDESIGN_ENGINES).map(([id, { label, model }]) => ({
    id,
    label,
    model,
  }));
}
