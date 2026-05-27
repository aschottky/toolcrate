/** Production API host (Render). Empty in dev → Vite proxies /api to localhost. */
export const API_BASE = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

export function apiUrl(path) {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  if (API_BASE) return `${API_BASE}${normalized}`;
  if (import.meta.env.DEV) return normalized;
  throw new Error(
    "The audit API is not configured for this site. Set VITE_API_BASE_URL and redeploy the frontend."
  );
}

export function normalizeClientError(message) {
  if (/JSON\.parse/i.test(message)) {
    return "Could not reach the audit server. Make sure the API is deployed and try again.";
  }
  return message;
}
