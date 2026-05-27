/**
 * Safely read an error message from an API response (JSON or HTML/plain text).
 */
export async function readApiError(response) {
  if (response.status === 405) {
    return "The hosting server blocked this request (405). Refresh the page — if it persists, the API URL may be misconfigured.";
  }

  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    try {
      const data = await response.json();
      return (
        data.error ||
        data.message ||
        `Something went wrong while processing your audit (${response.status}).`
      );
    } catch {
      return `Something went wrong while processing your audit (${response.status}).`;
    }
  }

  try {
    const text = (await response.text()).trim();
    if (text && !text.startsWith("<")) return text.slice(0, 280);
  } catch {
    // ignore
  }

  return `Something went wrong while processing your audit (${response.status}).`;
}

/**
 * Parse JSON error payload when available; never throws on HTML responses.
 */
export async function readApiErrorPayload(response) {
  const contentType = response.headers.get("content-type") || "";

  if (!contentType.includes("application/json")) {
    return {
      error: await readApiError(response),
      code: undefined,
    };
  }

  try {
    const data = await response.json();
    return {
      error:
        data.error ||
        data.message ||
        `Something went wrong while processing your audit (${response.status}).`,
      code: data.code,
    };
  } catch {
    return {
      error: `Something went wrong while processing your audit (${response.status}).`,
      code: undefined,
    };
  }
}
