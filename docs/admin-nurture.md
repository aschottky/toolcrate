# Admin page (nurture + call scripts)

Internal UI to preview nurture emails, send follow-ups, and generate AI phone scripts.

## Local

1. Set `CRON_SECRET`, `RESEND_*`, and `SUPABASE_*` in `.env`.
2. Run `npm run dev`.
3. Open **http://localhost:5173/admin/** (or the port Vite prints).
4. Paste `CRON_SECRET` → **Save** → **Send all 3 emails to me** (defaults to alexschottky@gmail.com).

Preview sends do **not** update `day_*_sent` flags. **Send D2/D4/D7** buttons email the customer and mark the flag in Supabase.

## Production

1. Add `admin/` to your deploy (included in Vite build via `npm run deploy`).
2. Visit **https://usetoolcrate.com/admin/** (or your domain).
3. Ensure `.env.production` has `VITE_API_BASE_URL` pointing at Render.

## API (same secret as cron)

| Method | Path | Body |
|--------|------|------|
| GET | `/api/admin/audits?limit=50` | — |
| POST | `/api/admin/nurture-preview` | `{ "to": "you@example.com", "auditId?": "uuid" }` |
| POST | `/api/admin/audits/:id/send-nurture` | `{ "day": 2, "previewTo?": "you@example.com" }` |

Header: `Authorization: Bearer CRON_SECRET`

### Call script

Run `docs/supabase-call-script.sql` once to add `call_script` columns.

| Method | Path | Body |
|--------|------|------|
| GET | `/api/admin/audits/:id` | — (includes cached `call_script`) |
| POST | `/api/admin/generate-script` | `{ "audit_id": "uuid", "force?": true }` |
| POST | `/api/admin/audits/:id/generate-script` | `{ "force?": true }` |

Returns cached script unless `force: true`. Saves result to Supabase.

### One-shot curl (all 3 previews)

```bash
curl -X POST http://localhost:4000/api/admin/nurture-preview \
  -H "Authorization: Bearer YOUR_CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"to":"alexschottky@gmail.com"}'
```
