/** Render API host (production). Dev uses Vite proxy on /api. */
export const API_BASE = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

export function apiUrl(path) {
  const normalized = path.startsWith("/") ? path : `/${path}`;

  if (import.meta.env.DEV) {
    return normalized;
  }

  if (API_BASE) {
    return `${API_BASE}${normalized}`;
  }

  throw new Error(
    "The audit API is not configured. Set VITE_API_BASE_URL and redeploy."
  );
}

export function normalizeClientError(message) {
  if (/JSON\.parse/i.test(message)) {
    return "The server returned an unexpected response. Please try again.";
  }
  if (/failed to fetch|networkerror|network error|load failed/i.test(message)) {
    return "Could not reach the audit server. Try disabling VPN/ad blockers, wait 30s for the server to wake up, then retry.";
  }
  return message;
}
