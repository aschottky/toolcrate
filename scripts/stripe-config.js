/** Injected from STRIPE_* publishable keys via vite.config.js `define`. */
/* global __STRIPE_PUBLISHABLE_KEY__, __STRIPE_TEST_PUBLISHABLE_KEY__ */

/**
 * @param {"live"|"test"} mode
 * @returns {string}
 */
export function getStripePublishableKey(mode = "live") {
  const testKey =
    typeof __STRIPE_TEST_PUBLISHABLE_KEY__ !== "undefined"
      ? __STRIPE_TEST_PUBLISHABLE_KEY__
      : "";
  const liveKey =
    typeof __STRIPE_PUBLISHABLE_KEY__ !== "undefined"
      ? __STRIPE_PUBLISHABLE_KEY__
      : "";

  if (mode === "test") {
    if (!testKey) {
      throw new Error(
        "STRIPE_TEST_PUBLISHABLE_KEY is not configured in .env."
      );
    }
    return testKey;
  }

  if (!liveKey) {
    throw new Error("STRIPE_PUBLISHABLE_KEY is not configured in .env.");
  }
  return liveKey;
}

/** Test publishable key in dev, live in production builds. */
export function getActiveStripePublishableKey() {
  return getStripePublishableKey(import.meta.env.PROD ? "live" : "test");
}
