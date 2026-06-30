/**
 * Anthropic model slugs for ToolCrate preview generation.
 * Single source of truth — roast uses Opus; redesign uses Sonnet 3.5.
 */
export const CLAUDE_OPUS_MODEL = "claude-opus-4-5";

/** Primary model for all HTML redesign generation. */
export const CLAUDE_SONNET_REDESIGN_MODEL = "claude-3-5-sonnet-20240620";

/** Default engine id for public /try preview orders and admin when unspecified. */
export const DEFAULT_PUBLIC_REDESIGN_ENGINE = "claude-sonnet";
