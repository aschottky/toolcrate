import { generateRedesignHtml } from "./redesign-claude.js";
import {
  CLAUDE_SONNET_REDESIGN_MODEL,
  DEFAULT_PUBLIC_REDESIGN_ENGINE,
} from "./anthropic-models.js";

export const DEFAULT_REDESIGN_MAX_TOKENS = 32000;

/** Legacy engine ids stored in Supabase map to the single Claude Sonnet engine. */
const LEGACY_ENGINE_ALIASES = {
  "claude-opus": DEFAULT_PUBLIC_REDESIGN_ENGINE,
  "gpt-4o": DEFAULT_PUBLIC_REDESIGN_ENGINE,
};

/**
 * Single redesign engine — Claude Sonnet with shared validation pipeline.
 * Key = stable id stored in Supabase; model = exact slug sent to the Anthropic API.
 */
export const REDESIGN_ENGINES = {
  "claude-sonnet": {
    label: "Claude Sonnet 4.6",
    model: CLAUDE_SONNET_REDESIGN_MODEL,
    generate: generateRedesignHtml,
  },
};

export function resolveRedesignEngine(engineId) {
  const raw = String(engineId ?? "").trim();
  const id = LEGACY_ENGINE_ALIASES[raw] ?? (raw || DEFAULT_PUBLIC_REDESIGN_ENGINE);
  const engine = REDESIGN_ENGINES[id];
  if (!engine) {
    const err = new Error(
      `Unknown engine "${raw || id}". Use: ${Object.keys(REDESIGN_ENGINES).join(", ")}.`
    );
    err.statusCode = 400;
    throw err;
  }
  return { id, ...engine };
}

export function listRedesignEngines() {
  return Object.entries(REDESIGN_ENGINES).map(([id, { label, model }]) => ({
    id,
    label,
    model,
  }));
}
