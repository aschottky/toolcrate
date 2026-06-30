const SCRAPE_ERROR_PATTERNS = [
  /too long to respond/i,
  /could not reach/i,
  /http 40[13]/i,
  /http 429/i,
  /did not return an html/i,
  /bot protection/i,
  /cloudflare/i,
  /access denied/i,
  /forbidden/i,
];

export function formatAuditError(error) {
  const message = error?.message || "Audit failed.";

  if (SCRAPE_ERROR_PATTERNS.some((pattern) => pattern.test(message))) {
    if (/refund you|run it manually/i.test(message)) {
      return message;
    }
    return "We couldn't access this website. It might have bot protection enabled — reply to your audit email and we'll help.";
  }

  return message;
}

export function isClientAuditError(message) {
  return (
    message.includes("required") ||
    message.includes("valid") ||
    message.includes("cannot be audited") ||
    message.includes("No such checkout.session") ||
    message.includes("Missing session_id") ||
    message.includes("Payment not completed") ||
    message.includes("couldn't find your website URL")
  );
}

export function sendAuditError(res, error, logPrefix, statusCode) {
  const message = formatAuditError(error);
  const status =
    statusCode ??
    (isClientAuditError(message) || isClientAuditError(error?.message) ? 400 : 500);

  console.error(`${logPrefix} Failed:`, error?.message || message, error);

  return res.status(status).json({
    ok: false,
    success: false,
    error: message,
    code: status < 500 ? "INVALID_REQUEST" : "AUDIT_FAILED",
  });
}

/** Normalize Anthropic SDK / pipeline errors into a stable code for logs and API responses. */
export function formatRedesignError(error) {
  const httpStatus = error?.httpStatus ?? error?.status ?? null;
  const errorType = error?.errorType ?? error?.error?.type ?? error?.type ?? null;
  const requestId =
    error?.requestId ??
    error?.headers?.["request-id"] ??
    error?.headers?.get?.("request-id") ??
    null;
  const message =
    error?.error?.message ?? error?.message ?? "Redesign generation failed.";

  let code = error?.code ?? "REDESIGN_UNAVAILABLE";
  if (code === "REDESIGN_UNAVAILABLE" || code === "Error") {
    if (error?.code === "PREFLIGHT_REJECTED") {
      code = "REDESIGN_PREFLIGHT_REJECTED";
    } else if (httpStatus === 429 || errorType === "rate_limit_error") {
      code = "REDESIGN_RATE_LIMIT";
    } else if (httpStatus === 529 || errorType === "overloaded_error") {
      code = "REDESIGN_OVERLOADED";
    } else if (httpStatus === 401 || errorType === "authentication_error") {
      code = "REDESIGN_AUTH_ERROR";
    } else if (httpStatus === 403 || errorType === "permission_error") {
      code = "REDESIGN_PERMISSION_ERROR";
    } else if (httpStatus === 400 || errorType === "invalid_request_error") {
      code = "REDESIGN_INVALID_REQUEST";
    } else if (/ANTHROPIC_API_KEY is not configured/i.test(message)) {
      code = "REDESIGN_NOT_CONFIGURED";
    } else if (/truncated|max_tokens/i.test(message)) {
      code = "REDESIGN_TRUNCATED";
    } else if (/validation|validateRedesignHtml|rejected/i.test(message)) {
      code = "REDESIGN_VALIDATION_FAILED";
    }
  }

  return { message, code, httpStatus, errorType, requestId };
}

export function enrichRedesignError(error, fallbackMessage = "Redesign generation failed.") {
  const details = formatRedesignError(error);
  const err =
    error instanceof Error
      ? error
      : new Error(details.message || fallbackMessage);

  err.message = details.message || err.message || fallbackMessage;
  err.code = details.code;
  err.httpStatus = details.httpStatus;
  err.errorType = details.errorType;
  err.requestId = details.requestId;
  return err;
}

export function logRedesignFailure(logPrefix, error, context = {}) {
  const details = formatRedesignError(error);
  const meta = [
    `code=${details.code}`,
    details.httpStatus != null ? `http=${details.httpStatus}` : null,
    details.errorType ? `type=${details.errorType}` : null,
    details.requestId ? `req=${details.requestId}` : null,
  ]
    .filter(Boolean)
    .join(" ");
  const ctx =
    Object.keys(context).length > 0 ? ` ${JSON.stringify(context)}` : "";

  console.error(`${logPrefix} Redesign failed [${meta}]${ctx}:`, details.message);

  if (error?.stack && !details.httpStatus) {
    console.error(error.stack.split("\n").slice(0, 5).join("\n"));
  }

  return details;
}

export function sendRedesignError(res, error, logPrefix, statusCode) {
  const details = logRedesignFailure(logPrefix, error);
  const status =
    statusCode ??
    (details.httpStatus && details.httpStatus >= 400 && details.httpStatus < 600
      ? details.httpStatus
      : 503);

  return res.status(status).json({
    ok: false,
    success: false,
    error: "Redesign unavailable.",
    detail: details.message,
    code: details.code,
    ...(details.httpStatus != null ? { httpStatus: details.httpStatus } : {}),
    ...(details.errorType ? { errorType: details.errorType } : {}),
  });
}
