# Stripe Payment Link → Audit tool redirect

After checkout, customers should land on the audit app to enter their website URL.

## Redirect URLs to configure in Stripe Dashboard

Edit each Payment Link → **After payment** → **Don’t show confirmation page** → Redirect customers to your website.

| Mode | Payment Link URL | Redirect URL |
|------|------------------|--------------|
| **Test** (local `.env`) | https://buy.stripe.com/test_14A289aOrcr78Mx4gn1Fe00 | `http://localhost:5173/toolcrate/app/?paid=1` |
| **Live** (production) | https://buy.stripe.com/14A289aOrcr78Mx4gn1Fe00 | `https://aschottky.github.io/toolcrate/app/?paid=1` |

The `?paid=1` query shows a “Payment received” banner on the audit page.

## Customer flow

1. Landing page → Pay via Stripe CTA  
2. Stripe checkout (test or live)  
3. Redirect to `/toolcrate/app/?paid=1`  
4. Enter website URL → **Run Audit**

## Note

The audit API only runs locally (or wherever you deploy the Express backend). GitHub Pages serves the frontend only.
