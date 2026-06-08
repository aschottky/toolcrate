import { insertWarmLead, isSupabaseConfigured } from "./supabase.js";

const REPLY_EVENT_TYPES = new Set([
  "reply_received",
  "auto_reply_received",
]);

function verifyInstantlyWebhookSecret(req) {
  const secret = process.env.INSTANTLY_WEBHOOK_SECRET?.trim();
  if (!secret) {
    throw new Error("INSTANTLY_WEBHOOK_SECRET is not configured on the server.");
  }

  const bearer = req.headers.authorization?.startsWith("Bearer ")
    ? req.headers.authorization.slice(7)
    : null;
  const header =
    req.headers["x-instantly-secret"] ||
    req.headers["x-webhook-secret"] ||
    req.headers["x-cron-secret"];
  const query = req.query.secret;

  if (bearer !== secret && header !== secret && query !== secret) {
    const err = new Error("Unauthorized webhook request.");
    err.statusCode = 401;
    throw err;
  }
}

function pickString(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

function extractWebsite(payload) {
  const direct = pickString(
    payload.website,
    payload.Website,
    payload.website_url,
    payload.websiteUrl,
    payload.company_website,
    payload.companyWebsite
  );
  if (direct) return direct;

  const nested = payload.payload ?? payload.lead ?? payload.custom_variables;
  if (nested && typeof nested === "object") {
    return pickString(
      nested.website,
      nested.Website,
      nested.website_url,
      nested.websiteUrl,
      nested.company_website
    );
  }

  return null;
}

function extractEmail(payload) {
  return pickString(
    payload.lead_email,
    payload.email,
    payload.leadEmail,
    payload.payload?.email,
    payload.lead?.email
  );
}

function extractReplyText(payload) {
  return pickString(
    payload.reply_text,
    payload.reply_text_snippet,
    payload.email_text,
    payload.reply_html,
    payload.email_html
  );
}

function isReplyEvent(payload) {
  const eventType = String(payload.event_type ?? payload.eventType ?? "").toLowerCase();
  if (!eventType) return true;
  return REPLY_EVENT_TYPES.has(eventType);
}

/**
 * POST /api/webhooks/instantly — Instantly.ai reply webhook.
 */
export async function handleInstantlyWebhook(req, res) {
  try {
    verifyInstantlyWebhookSecret(req);

    if (!isSupabaseConfigured()) {
      return res.status(503).json({
        ok: false,
        error: "Supabase is not configured.",
      });
    }

    const payload = req.body ?? {};

    if (!isReplyEvent(payload)) {
      return res.json({
        ok: true,
        ignored: true,
        reason: `event_type ${payload.event_type ?? "unknown"} not handled`,
      });
    }

    const email = extractEmail(payload);
    if (!email) {
      return res.status(400).json({
        ok: false,
        error: "Missing lead email in webhook payload.",
      });
    }

    const website = extractWebsite(payload);
    const replyText = extractReplyText(payload);

    const lead = await insertWarmLead({ email, website, replyText });

    console.log(
      `[instantly-webhook] Warm lead saved: ${lead.id} (${email}${website ? `, ${website}` : ""})`
    );

    return res.status(201).json({
      ok: true,
      lead_id: lead.id,
      email: lead.email,
      website: lead.website,
      status: lead.status,
    });
  } catch (error) {
    const status = error.statusCode ?? 500;
    console.error("[instantly-webhook]", error.message);
    return res.status(status).json({
      ok: false,
      error: error.message,
    });
  }
}
