/**
 * Anthropic model slugs for quality-critical preview generation.
 * Single source of truth — roast + redesign always use Opus (@anthropic-ai/sdk ^0.104).
 */
export const CLAUDE_OPUS_MODEL = "claude-opus-4-5";

/** Default engine id for public /try preview orders. */
export const DEFAULT_PUBLIC_REDESIGN_ENGINE = "claude-opus";
