# Warm lead follow-up cron

Daily job on Render to send post-audit follow-ups to warm leads.

## Endpoint

```
POST https://toolcrate-backend-500j.onrender.com/api/cron/warm-leads-nurture
Authorization: Bearer YOUR_CRON_SECRET
```

## Sequence

| Step | When | Email |
|------|------|--------|
| 1 | Manual — **Generate & Send Free Audit** | Free PDF audit |
| 2 | 2 days after step 1 | “Did you get your website teardown?” + Conversion OS pitch |
| 3 | 4 days after step 2 | Final check-in; lead marked `completed` |

## Render cron setup

1. Render Dashboard → **Cron Jobs** → New
2. Schedule: `0 14 * * *` (daily 2pm UTC — adjust as needed)
3. Command:

```bash
curl -sS -X POST "https://toolcrate-backend-500j.onrender.com/api/cron/warm-leads-nurture" \
  -H "Authorization: Bearer $CRON_SECRET"
```

Or use Render’s **Cron Job** service pointing at the URL with the secret header.

## Prerequisites

- Run `docs/supabase-warm-leads-follow-up.sql` in Supabase
- `CRON_SECRET`, `RESEND_API_KEY`, and Supabase env vars on Render
- Instantly webhook → `POST /api/webhooks/instantly` with `INSTANTLY_WEBHOOK_SECRET`

## Backfill existing leads

If you sent free audits before follow-up tracking existed:

```sql
update public.warm_leads
set follow_up_step = 1,
    last_emailed_at = coalesce(last_emailed_at, created_at)
where status = 'audit_sent'
  and follow_up_step = 0;
```
