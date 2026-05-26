/** Live Payment Link — used when VITE_STRIPE_PAYMENT_LINK is unset (e.g. production deploy). */
export const STRIPE_PAYMENT_LINK_LIVE =
  "https://buy.stripe.com/14A289aOrcr78Mx4gn1Fe00";

export const stripePaymentLink =
  import.meta.env.VITE_STRIPE_PAYMENT_LINK || STRIPE_PAYMENT_LINK_LIVE;

export function applyStripeCtas() {
  document.querySelectorAll("[data-stripe-cta]").forEach((el) => {
    el.href = stripePaymentLink;
    el.target = "_blank";
    el.rel = "noopener noreferrer";
  });
}
