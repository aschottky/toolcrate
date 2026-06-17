import Stripe from "stripe";

const stripeClients = new Map();

/** embedded_page checkout requires >= 2026-03-25.dahlia */
const STRIPE_API_VERSION =
  process.env.STRIPE_API_VERSION?.trim() || "2026-04-22.dahlia";

/** Test mode — explicit TEST prefix in env var name. */
export function getStripeTestSecretKey() {
  return process.env.STRIPE_TEST_SECRET_KEY?.trim() || "";
}

/** Live mode — STRIPE_SECRET_KEY (no LIVE prefix). */
export function getStripeLiveSecretKey() {
  return process.env.STRIPE_SECRET_KEY?.trim() || "";
}

export function stripeKeyModeFromSecret(secretKey) {
  if (secretKey.startsWith("sk_test_")) return "test";
  if (secretKey.startsWith("sk_live_")) return "live";
  return "unknown";
}

export function assertStripeKeyMatchesSession(sessionId, secretKey) {
  const isTestSession = sessionId.startsWith("cs_test_");
  const isLiveSession = sessionId.startsWith("cs_live_");
  const mode = stripeKeyModeFromSecret(secretKey);

  if (isTestSession && mode === "live") {
    throw new Error(
      "Stripe key mismatch: server is using sk_live_... (STRIPE_SECRET_KEY) but this is a test checkout (cs_test_...). Use STRIPE_TEST_SECRET_KEY for test sessions."
    );
  }

  if (isLiveSession && mode === "test") {
    throw new Error(
      "Stripe key mismatch: server is using sk_test_... (STRIPE_TEST_SECRET_KEY) but this is a live checkout (cs_live_...). Use STRIPE_SECRET_KEY for live sessions."
    );
  }
}

function getStripeClient(secretKey) {
  if (!secretKey) {
    throw new Error("Stripe secret key is not configured.");
  }
  if (!stripeClients.has(secretKey)) {
    stripeClients.set(
      secretKey,
      new Stripe(secretKey, { apiVersion: STRIPE_API_VERSION })
    );
  }
  return stripeClients.get(secretKey);
}

export function getStripeTest() {
  return getStripeClient(getStripeTestSecretKey());
}

export function getStripeLive() {
  return getStripeClient(getStripeLiveSecretKey());
}

/** true on Render (NODE_ENV=production) — false for local `npm run dev`. */
export function isStripeProduction() {
  return process.env.NODE_ENV === "production";
}

/** "test" locally, "live" on Render. */
export function getStripeMode() {
  return isStripeProduction() ? "live" : "test";
}

/** All checkout flows — test locally, live in production. */
export function getStripeForApp() {
  return isStripeProduction() ? getStripeLive() : getStripeTest();
}

/** @deprecated alias */
export function getStripeForStandardCheckout() {
  return getStripeForApp();
}

/** Pick test vs live secret from the Checkout Session ID prefix. */
export function getStripeForSessionId(sessionId) {
  if (sessionId.startsWith("cs_live_")) {
    return getStripeLive();
  }
  if (sessionId.startsWith("cs_test_")) {
    return getStripeTest();
  }
  throw new Error("Unrecognized checkout session ID format.");
}

export function getStripeSecretKeyForSessionId(sessionId) {
  if (sessionId.startsWith("cs_live_")) {
    return getStripeLiveSecretKey();
  }
  if (sessionId.startsWith("cs_test_")) {
    return getStripeTestSecretKey();
  }
  return "";
}
