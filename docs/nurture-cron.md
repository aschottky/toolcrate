# Nurture email cron (Day 2, 4, 7)

| Email | Timing | Supabase flags |
|-------|--------|----------------|
| Day 2 | **48 hours** after `created_at` | `day_2_sent = false` → `true` |
| Day 4 | **96 hours** after audit, Day 2 already sent | `day_4_sent = false` → `true` |
| Day 7 | **168 hours** after audit, Day 4 already sent | `day_7_sent = false` → `true` |

Run `docs/supabase-nurture-columns.sql` if your table was created before the boolean columns existed.

## Endpoint (secured)

```http
POST /api/cron/process-nurture
Authorization: Bearer YOUR_CRON_SECRET
```

Alias: `POST /api/cron/process-nurture-emails` (same handler).

Also accepts `X-Cron-Secret` header or `?secret=` query param.

### Env

```bash
CRON_SECRET=long-random-string
CONVERSION_OS_BOOKING_URL=https://calendly.com/your-link   # Day 7 CTA
```

### Local test

```bash
curl -X POST http://localhost:4000/api/cron/process-nurture \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

To test Day 2 immediately: set `created_at` to 3 days ago and ensure `day_2_sent = false`.

## Production cron

**cron-job.org** (daily):

- URL: `https://toolcrate-backend-500j.onrender.com/api/cron/process-nurture`
- Method: POST
- Header: `Authorization: Bearer YOUR_CRON_SECRET`

Add `CRON_SECRET` and `CONVERSION_OS_BOOKING_URL` to Render environment variables.
