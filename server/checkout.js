import {
  assertStripeKeyMatchesSession,
  getStripeForApp,
  getStripeForSessionId,
  getStripeSecretKeyForSessionId,
  isStripeProduction,
} from "./stripe-keys.js";

const TIER_PRICE_KEYS = {
  "full-build": {
    live: {
      setup: "STRIPE_PRICE_FULL_BUILD_SETUP",
      recurring: "STRIPE_PRICE_FULL_BUILD_RECURRING",
    },
    test: {
      setup: "STRIPE_PRICE_TEST_FULL_BUILD_SETUP",
      recurring: "STRIPE_PRICE_TEST_FULL_BUILD_RECURRING",
    },
  },
  "conversion-os": {
    live: {
      setup: "STRIPE_PRICE_CONVERSION_OS_SETUP",
      recurring: "STRIPE_PRICE_CONVERSION_OS_RECURRING",
    },
    test: {
      setup: "STRIPE_PRICE_TEST_CONVERSION_OS_SETUP",
      recurring: "STRIPE_PRICE_TEST_CONVERSION_OS_RECURRING",
    },
  },
};

function resolveTierPrices(tier) {
  const keys = TIER_PRICE_KEYS[tier];
  if (!keys) return null;

  const envKeys = isStripeProduction() ? keys.live : keys.test;
  const setup = process.env[envKeys.setup]?.trim();
  const recurring = process.env[envKeys.recurring]?.trim();
  if (!setup || !recurring) return null;

  return { setup, recurring };
}

function checkoutReturnBase(req, siteOriginFromRequest) {
  const configured = process.env.DOMAIN?.trim();
  if (configured) return configured.replace(/\/$/, "");
  return siteOriginFromRequest(req);
}

function emailFromSession(session) {
  const expandedCustomer =
    typeof session.customer === "object" && session.customer !== null
      ? session.customer.email?.trim()
      : null;

  return (
    session.customer_details?.email?.trim() ||
    expandedCustomer ||
    session.customer_email?.trim() ||
    null
  );
}

function tierFromSession(session) {
  return session.metadata?.tier?.trim() || null;
}

async function retrieveCheckoutSession(sessionId) {
  const secretKey = getStripeSecretKeyForSessionId(sessionId);
  assertStripeKeyMatchesSession(sessionId, secretKey);
  const stripe = getStripeForSessionId(sessionId);
  return stripe.checkout.sessions.retrieve(sessionId, {
    expand: ["customer", "line_items"],
  });
}

export function registerCheckoutRoutes(app, { siteOriginFromRequest }) {
  app.post("/api/checkout/create-session", async (req, res) => {
    const { tier } = req.body ?? {};
    const selected = resolveTierPrices(tier);

    if (!selected) {
      const priceHint = isStripeProduction()
        ? "STRIPE_PRICE_*"
        : "STRIPE_PRICE_TEST_*";
      return res.status(400).json({
        error: `Invalid tier or missing price IDs. Set ${priceHint} env vars for this tier.`,
      });
    }

    try {
      const stripe = getStripeForApp();
      const returnBase = checkoutReturnBase(req, siteOriginFromRequest);

      const session = await stripe.checkout.sessions.create({
        ui_mode: "embedded_page",
        mode: "subscription",
        line_items: [
          { price: selected.recurring, quantity: 1 },
          { price: selected.setup, quantity: 1 },
        ],
        metadata: { tier },
        return_url: `${returnBase}/success/?session_id={CHECKOUT_SESSION_ID}`,
      });

      return res.json({ clientSecret: session.client_secret });
    } catch (err) {
      console.error("[checkout] Session error:", err);

      let message = err.message;
      if (/similar object exists in live mode/i.test(message)) {
        message =
          "Stripe is in test mode locally but these price IDs are live. Set STRIPE_PRICE_TEST_* vars in .env with test-mode price IDs from Stripe Dashboard.";
      } else if (/similar object exists in test mode/i.test(message)) {
        message =
          "Stripe is in live mode but these price IDs are test-mode. Set STRIPE_PRICE_* vars on Render with live price IDs.";
      }

      return res.status(500).json({ error: message });
    }
  });

  app.get("/api/checkout/session", async (req, res) => {
    const sessionId = String(req.query.session_id ?? "").trim();

    if (!sessionId) {
      return res.status(400).json({ error: "Missing session_id." });
    }

    try {
      const session = await retrieveCheckoutSession(sessionId);

      if (session.status !== "complete") {
        return res.status(400).json({ error: "Checkout session is not complete." });
      }

      return res.json({
        email: emailFromSession(session),
        tier: tierFromSession(session),
      });
    } catch (err) {
      console.error("[checkout] Session error:", err.message);

      const isMissing =
        err.type === "StripeInvalidRequestError" &&
        /no such checkout\.session/i.test(err.message);

      return res.status(400).json({
        error: isMissing
          ? "Checkout session not found."
          : err.message || "Could not retrieve checkout session.",
      });
    }
  });

  app.get("/api/checkout/session-status", async (req, res) => {
    const sessionId = String(req.query.session_id ?? "").trim();

    if (!sessionId) {
      return res.status(400).json({
        ok: false,
        error: "Missing session_id.",
      });
    }

    try {
      const session = await retrieveCheckoutSession(sessionId);

      return res.json({
        ok: true,
        status: session.status,
        customerEmail: emailFromSession(session),
        tier: tierFromSession(session),
      });
    } catch (err) {
      console.error("[checkout] Session status error:", err.message);

      const isMissing =
        err.type === "StripeInvalidRequestError" &&
        /no such checkout\.session/i.test(err.message);

      return res.status(400).json({
        ok: false,
        error: isMissing
          ? "Checkout session not found."
          : err.message || "Could not retrieve checkout session.",
      });
    }
  });
}
