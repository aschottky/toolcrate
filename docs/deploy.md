# Deploying Toolcrate

GitHub Pages serves **only the static frontend** (`usetoolcrate.com`). The Express API must run separately.

## 1. Backend (Render)

1. Open [Render Dashboard](https://dashboard.render.com) → **New** → **Blueprint** → connect `aschottky/toolcrate`.
2. Render reads `render.yaml` and creates the API service (live URL: `https://toolcrate-backend-500j.onrender.com`).
3. In the service **Environment**, add:
   - `OPENAI_API_KEY`
   - `STRIPE_SECRET_KEY`
   - `STRIPE_WEBHOOK_SECRET`
   - `RESEND_API_KEY`
   - Optional: `RESEND_FROM_EMAIL`, `OPENAI_MODEL`
4. After deploy, open `https://toolcrate-backend-500j.onrender.com/api/health` — should return `{"ok":true,...}`.
5. Point Stripe webhooks to `https://toolcrate-backend-500j.onrender.com/webhook`.

If your Render URL differs, update `VITE_API_BASE_URL` in `.env.production` and redeploy the frontend.

## 2. Frontend (GitHub Pages)

```bash
npm run deploy
```

This runs `build:production` (live Stripe link + API URL) and pushes `dist/` to the `gh-pages` branch.

The production build includes `sw.js`, a service worker that proxies `/api/*` on `usetoolcrate.com` to Render. That avoids cross-origin blocks from VPNs and browser privacy tools.

Pushing to `main` does **not** update the live site unless you run `npm run deploy` or enable GitHub Actions Pages deploy.

## 3. Local dev

```bash
npm run dev
```

Uses `.env` (test Stripe link). Vite proxies `/api` → `localhost:4000` — no `VITE_API_BASE_URL` needed.
