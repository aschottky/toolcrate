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
