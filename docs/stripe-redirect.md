# Stripe Payment Link → Audit tool redirect

After checkout, customers should land on the audit app to enter their website URL.

## Redirect URLs to configure in Stripe Dashboard

Edit each Payment Link → **After payment** → **Don’t show confirmation page** → Redirect customers to your website.

| Mode | Payment Link URL | Redirect URL |
|------|------------------|--------------|
| **Test** (local `.env`) | https://buy.stripe.com/test_14A289aOrcr78Mx4gn1Fe00 | `http://localhost:5173/?success=true&session_id={CHECKOUT_SESSION_ID}` |
| **Live** (production) | https://buy.stripe.com/14A289aOrcr78Mx4gn1Fe00 | `https://usetoolcrate.com/scan/?success=true&session_id={CHECKOUT_SESSION_ID}` |

Stripe replaces `{CHECKOUT_SESSION_ID}` automatically. The landing page shows a processing spinner, then downloads the PDF when ready.

## Customer flow

1. Landing page → Pay via Stripe CTA  
2. Stripe checkout (test or live)  
3. Redirect to `/?success=true&session_id={CHECKOUT_SESSION_ID}` (PDF downloads on the landing page)  
4. Enter website URL → **Run Audit**

## Note

The audit API only runs locally (or wherever you deploy the Express backend). GitHub Pages serves the frontend only.
