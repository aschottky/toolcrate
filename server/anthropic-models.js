/**
 * Anthropic model slugs for ToolCrate preview generation.
 * Single source of truth — roast uses Opus; redesign uses Sonnet.
 */
export const CLAUDE_OPUS_MODEL = "claude-opus-4-5";

/**
 * Primary model for all HTML redesign generation.
 * claude-3-5-sonnet-20240620 was retired 2025-10-28 — do not use.
 * Override on Render via CLAUDE_REDESIGN_MODEL if needed.
 */
export const CLAUDE_SONNET_REDESIGN_MODEL =
  process.env.CLAUDE_REDESIGN_MODEL?.trim() || "claude-sonnet-5";

/** Default engine id for public /try preview orders and admin when unspecified. */
export const DEFAULT_PUBLIC_REDESIGN_ENGINE = "claude-sonnet";
