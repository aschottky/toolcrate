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
  if (/failed to fetch|fetch failed|networkerror|network error|load failed|ENOTFOUND|Cannot reach Supabase/i.test(message)) {
    return "Could not reach the audit server or Supabase. If the API just woke up, wait 30s and retry. Otherwise check SUPABASE_URL in Render matches your Supabase project.";
  }
  return message;
}
