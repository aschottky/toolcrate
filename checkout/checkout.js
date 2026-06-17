import { loadStripe } from "@stripe/stripe-js";
import { apiUrl, normalizeClientError } from "../scripts/api-config.js";
import { getActiveStripePublishableKey } from "../scripts/stripe-config.js";

const checkoutMount = document.getElementById("checkout");
const loadingEl = document.getElementById("checkout-loading");

const params = new URLSearchParams(window.location.search);
const tier = params.get("tier") || "full-build";

function showError(message) {
  if (loadingEl) loadingEl.hidden = true;
  checkoutMount.innerHTML = `<p class="checkout-error" role="alert">${message}</p>`;
}

async function fetchClientSecret() {
  const response = await fetch(apiUrl("/api/checkout/create-session"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tier }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok || !data.clientSecret) {
    throw new Error(
      data.error || "Could not start checkout. Please try again in a moment."
    );
  }

  return data.clientSecret;
}

async function initCheckout() {
  let publishableKey;
  try {
    publishableKey = getActiveStripePublishableKey();
  } catch (error) {
    showError(normalizeClientError(error.message || ""));
    return;
  }

  if (!publishableKey) {
    showError(
      "Checkout is not configured yet. Please contact support if this keeps happening."
    );
    return;
  }

  try {
    const stripe = await loadStripe(publishableKey);
    if (!stripe) {
      throw new Error("Could not load Stripe. Please refresh and try again.");
    }

    if (typeof stripe.createEmbeddedCheckoutPage !== "function") {
      throw new Error(
        "Embedded checkout is unavailable in this browser. Please try again later."
      );
    }

    // return_url is set server-side when creating the Checkout Session
    // (see server/checkout.js — Stripe replaces {CHECKOUT_SESSION_ID} on redirect)
    const checkout = await stripe.createEmbeddedCheckoutPage({
      fetchClientSecret,
    });

    checkout.mount("#checkout");

    if (loadingEl) loadingEl.hidden = true;
  } catch (error) {
    showError(normalizeClientError(error.message || ""));
  }
}

initCheckout();
