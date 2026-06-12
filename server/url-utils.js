/**
 * Normalize any user-supplied website input to its bare root domain:
 * strips protocol, www., paths, query strings, ports, and lowercases.
 *
 *   "HTTPS://www.Liberty-Roofing.com/about?x=1" → "liberty-roofing.com"
 *
 * Used by /api/public-redesign AND /api/admin/redesigns so duplicate
 * detection never misses on www/protocol/path differences.
 *
 * @param {string} input — full URL or bare domain
 * @returns {string|null} root domain, or null when unparseable
 */
export function normalizeRootDomain(input) {
  const trimmed = String(input || "").trim().toLowerCase();
  if (!trimmed) return null;

  const withProtocol = /^[a-z][a-z0-9+.-]*:\/\//.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  let hostname;
  try {
    ({ hostname } = new URL(withProtocol));
  } catch {
    return null;
  }

  const domain = hostname.replace(/^www\./, "").replace(/\.+$/, "");
  return domain || null;
}
