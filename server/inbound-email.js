import { getResend } from "./email.js";

/**
 * Forwards mail received on @usetoolcrate.com (Resend receiving) to a real inbox.
 *
 * Resend → webhook `email.received` → this handler → re-send to INBOUND_FORWARD_TO
 * with Reply-To set to the original sender, so hitting Reply answers the customer
 * instead of looping back into usetoolcrate.com.
 */

const FORWARD_FROM = "ToolCrate Inbox <inbox@usetoolcrate.com>";
const OWN_DOMAIN = "usetoolcrate.com";

function getForwardTo() {
  return process.env.INBOUND_FORWARD_TO?.trim() || "alex@schottky.com";
}

function bareAddress(value) {
  const match = String(value || "").match(/<([^>]+)>/);
  return (match ? match[1] : String(value || "")).trim().toLowerCase();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function forwardReceivedEmail(emailId) {
  const resend = getResend();

  const { data: email, error } = await resend.emails.receiving.get(emailId);
  if (error) throw new Error(`Could not load received email: ${error.message}`);

  const sender = bareAddress(email.from);
  if (sender.endsWith(`@${OWN_DOMAIN}`)) {
    console.log(`📭 Inbound ${emailId} is from our own domain (${sender}) — not forwarding.`);
    return null;
  }

  let attachments;
  if (email.attachments?.length) {
    const { data: list, error: attachError } =
      await resend.emails.receiving.attachments.list({ emailId });
    if (attachError) {
      console.warn(`📎 Inbound ${emailId}: attachments unavailable (${attachError.message})`);
    } else {
      attachments = list.data.map((a) => ({
        filename: a.filename || "attachment",
        path: a.download_url,
        contentType: a.content_type,
        contentId: a.content_id || undefined,
      }));
    }
  }

  const toLine = email.to.join(", ");
  const banner = `Forwarded from ${toLine} · From: ${email.from}`;
  const subject = `[ToolCrate] ${email.subject || "(no subject)"}`;
  const text = `${banner}\n\n${email.text || "(no text body)"}`;
  const html = email.html
    ? `<div style="font:12px/1.5 system-ui,sans-serif;color:#71717a;border-bottom:1px solid #e4e4e7;padding:0 0 8px;margin:0 0 16px;">${escapeHtml(banner)}</div>${email.html}`
    : undefined;

  const { data: sent, error: sendError } = await resend.emails.send({
    from: FORWARD_FROM,
    to: getForwardTo(),
    replyTo: email.reply_to?.length ? email.reply_to : email.from,
    subject,
    text,
    html,
    attachments,
  });
  if (sendError) throw new Error(`Forward send failed: ${sendError.message}`);
  return sent?.id ?? null;
}

/** Express handler — mount with express.text({ type: "*\/*" }) BEFORE express.json. */
export async function handleInboundEmailWebhook(req, res) {
  const secret = process.env.RESEND_INBOUND_WEBHOOK_SECRET;
  if (!secret) {
    console.error("❌ RESEND_INBOUND_WEBHOOK_SECRET is not set — rejecting inbound webhook.");
    return res.status(500).json({ error: "Webhook not configured" });
  }

  let event;
  try {
    event = getResend().webhooks.verify({
      payload: typeof req.body === "string" ? req.body : String(req.body ?? ""),
      headers: {
        id: req.headers["svix-id"] ?? req.headers["webhook-id"],
        timestamp: req.headers["svix-timestamp"] ?? req.headers["webhook-timestamp"],
        signature: req.headers["svix-signature"] ?? req.headers["webhook-signature"],
      },
      webhookSecret: secret,
    });
  } catch (err) {
    console.error("❌ Inbound webhook signature error:", err.message);
    return res.status(400).json({ error: "Invalid signature" });
  }

  if (event?.type !== "email.received") {
    return res.status(200).json({ received: true });
  }

  const emailId = event.data?.email_id;
  try {
    const forwardedId = await forwardReceivedEmail(emailId);
    console.log(`📬 Inbound ${emailId} → ${getForwardTo()} (${forwardedId ?? "skipped"})`);
    return res.status(200).json({ received: true });
  } catch (err) {
    // Non-2xx makes Resend retry later.
    console.error(`❌ Inbound ${emailId} forward failed:`, err.message);
    return res.status(500).json({ error: "Forward failed" });
  }
}
