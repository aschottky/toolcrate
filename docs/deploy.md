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

**Render plan:** The free tier is enough for preview generation. Roast and redesign run **sequentially** (one Claude Opus job at a time) so they do not compete for memory. Upgrade to **Starter ($7/mo)** if you want faster cold starts (free tier spins down after ~15 min idle) and more reliable background jobs under load — not required for correctness.

If your Render URL differs, update `VITE_API_BASE_URL` in `.env.production` and redeploy the frontend.

## 2. Frontend (GitHub Pages)

```bash
npm run deploy
```

This runs `build:production` (live Stripe link + API URL) and pushes `dist/` to the `gh-pages` branch.

The production build bakes `VITE_API_BASE_URL` into the frontend so `/app` calls Render directly (CORS enabled on the API).

Pushing to `main` does **not** update the live site unless you run `npm run deploy` or enable GitHub Actions Pages deploy.

## 3. Local dev

```bash
npm run dev
```

Uses `.env` (test Stripe link). Vite proxies `/api` → `localhost:4000` — no `VITE_API_BASE_URL` needed.
