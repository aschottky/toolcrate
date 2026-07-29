/**
 * Email + password login for the admin pages (/admin, /invoices).
 *
 * POST /api/admin/login { email, password } → { ok, token, email, expires_at }
 * The token is an HMAC-signed session token (7 days), accepted by
 * verifyCronSecret alongside the raw CRON_SECRET.
 *
 * Env: ADMIN_EMAIL, ADMIN_PASSWORD (signing uses CRON_SECRET).
 */

import crypto from "node:crypto";

const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function getSigningSecret() {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    throw new Error("CRON_SECRET is not configured on the server.");
  }
  return secret;
}

function signPayload(encodedPayload) {
  return crypto
    .createHmac("sha256", getSigningSecret())
    .update(encodedPayload)
    .digest("base64url");
}

/** Constant-time string comparison (hashes first so lengths always match). */
function safeEqual(a, b) {
  const hashA = crypto.createHash("sha256").update(String(a)).digest();
  const hashB = crypto.createHash("sha256").update(String(b)).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

export function createSessionToken(email) {
  const payload = Buffer.from(
    JSON.stringify({ email, exp: Date.now() + TOKEN_TTL_MS })
  ).toString("base64url");
  return `${payload}.${signPayload(payload)}`;
}

/** Returns the payload ({ email, exp }) if valid and unexpired, else null. */
export function verifySessionToken(token) {
  if (typeof token !== "string" || !token.includes(".")) return null;

  const [payload, signature] = token.split(".");
  try {
    if (!safeEqual(signature, signPayload(payload))) return null;
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (!data.exp || Date.now() > data.exp) return null;
    return data;
  } catch {
    return null;
  }
}

export function handleAdminLogin(req, res) {
  const adminEmail = process.env.ADMIN_EMAIL?.trim();
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword) {
    return res.status(503).json({
      ok: false,
      error: "Login is not configured — set ADMIN_EMAIL and ADMIN_PASSWORD on the server.",
    });
  }

  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "");

  const emailOk = safeEqual(email, adminEmail.toLowerCase());
  const passwordOk = safeEqual(password, adminPassword);

  if (!email || !password || !emailOk || !passwordOk) {
    return res.status(401).json({ ok: false, error: "Wrong email or password." });
  }

  const token = createSessionToken(email);
  return res.json({
    ok: true,
    token,
    email,
    expires_at: Date.now() + TOKEN_TTL_MS,
  });
}
