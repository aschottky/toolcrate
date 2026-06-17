const DANGLING_WORDS = new Set([
  "the",
  "a",
  "an",
  "and",
  "but",
  "or",
  "to",
  "at",
  "for",
  "with",
  "in",
  "of",
]);

const MAX_BULLET_CHARS = 120;

/**
 * True when the last word is a preposition, article, or conjunction — i.e. a
 * truncated sentence that must never be shown.
 */
export function endsWithDanglingWord(text) {
  const cleaned = String(text ?? "")
    .trim()
    .replace(/[.!?…]+$/, "");
  if (!cleaned) return false;

  const lastWord = cleaned
    .split(/\s+/)
    .pop()
    ?.toLowerCase()
    .replace(/[^a-z']/g, "");

  return Boolean(lastWord && DANGLING_WORDS.has(lastWord));
}

function ensureTerminalPunctuation(text) {
  if (/[.!?]$/.test(text)) return text;
  return `${text}.`;
}

/**
 * Normalize a single roast bullet for display — complete sentences only.
 * Returns null when the text cannot be cleaned safely.
 */
export function sanitizeRoastBulletText(raw) {
  let text = String(raw ?? "").trim().replace(/\s+/g, " ");
  if (!text) return null;

  if (endsWithDanglingWord(text)) return null;

  if (text.length > MAX_BULLET_CHARS) {
    const slice = text.slice(0, MAX_BULLET_CHARS);
    const boundary = Math.max(
      slice.lastIndexOf("."),
      slice.lastIndexOf("!"),
      slice.lastIndexOf("?")
    );
    if (boundary >= 40) {
      text = slice.slice(0, boundary + 1);
    } else {
      return null;
    }
  }

  if (endsWithDanglingWord(text)) return null;

  if (!/[.!?]$/.test(text)) {
    text = ensureTerminalPunctuation(text);
  }

  if (endsWithDanglingWord(text)) return null;

  return text;
}

export function sanitizeRoastBulletList(bullets, max = 6) {
  if (!Array.isArray(bullets)) return [];
  return bullets
    .map((bullet) =>
      typeof bullet === "string" ? bullet : bullet?.text || ""
    )
    .map((text) => sanitizeRoastBulletText(text))
    .filter(Boolean)
    .slice(0, max);
}
