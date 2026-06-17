import { Resend } from "resend";

const DEFAULT_FROM = "Alexander <alexander@usetoolcrate.com>";

let resendClient;

export function getFromAddress() {
  return process.env.RESEND_FROM_EMAIL?.trim() || DEFAULT_FROM;
}

/** Same verified address with a different display name (e.g. ToolCrate). */
export function getBrandedFrom(displayName) {
  const configured = getFromAddress();
  const address = configured.match(/<([^>]+)>/)?.[1] || configured;
  return `${displayName} <${address}>`;
}

export function getResend() {
  if (!process.env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is not configured on the server.");
  }
  if (!resendClient) {
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }
  return resendClient;
}

export function formatSiteLabel(websiteUrl) {
  try {
    return new URL(websiteUrl).hostname;
  } catch {
    return websiteUrl;
  }
}

/**
 * Email the audit PDF to the customer via Resend.
 *
 * @param {string} customerEmail
 * @param {string} websiteUrl
 * @param {Buffer} pdfBuffer
 * @returns {Promise<{ id: string }>}
 */
export async function sendAuditReportEmail(customerEmail, websiteUrl, pdfBuffer) {
  const to = customerEmail?.trim();
  if (!to) {
    throw new Error("Customer email is required.");
  }

  if (!Buffer.isBuffer(pdfBuffer) || pdfBuffer.length === 0) {
    throw new Error("A valid PDF buffer is required.");
  }

  const resend = getResend();
  const from = getFromAddress();
  const siteLabel = formatSiteLabel(websiteUrl);

  const html = `
    <p>Hi there!</p>
    <p>Thanks for purchasing your <strong>$17 Website Tear Down</strong>.</p>
    <p>Your AI-generated audit for <a href="${websiteUrl}">${websiteUrl}</a> is attached below as <strong>Website-Audit.pdf</strong>.</p>
    <p>Inside you'll find scores across 7 areas — SEO, lead capture, mobile, trust, messaging, performance, and tech security — plus three specific fixes you can tackle right away.</p>
    <p>If anything looks off or you want a second pair of eyes on the recommendations, just reply to this email.</p>
    <p>— Alexander<br>Website Tear Down</p>
  `.trim();

  const text = `Hi there!

Thanks for purchasing your $17 Website Tear Down.

Your AI-generated audit for ${websiteUrl} is attached below (Website-Audit.pdf).

Inside you'll find scores across 7 areas — SEO, lead capture, mobile, trust, messaging, performance, and tech security — plus three specific fixes you can tackle right away.

If anything looks off or you want a second pair of eyes on the recommendations, just reply to this email.

— Alexander
Website Tear Down`;

  const { data, error } = await resend.emails.send({
    from,
    to: [to],
    subject: `Your Website Tear Down audit — ${siteLabel}`,
    html,
    text,
    attachments: [
      {
        filename: "Website-Audit.pdf",
        content: pdfBuffer,
        contentType: "application/pdf",
      },
    ],
  });

  if (error) {
    throw new Error(error.message || "Failed to send audit email via Resend.");
  }

  return data;
}

/**
 * "Your design preview is ready" notification — sent automatically when a
 * background redesign generation finishes.
 *
 * @param {string} customerEmail
 * @param {string} previewUrl — full public preview link
 * @returns {Promise<{ id: string }>}
 */
export async function sendDesignReadyEmail(customerEmail, previewUrl) {
  const to = customerEmail?.trim();
  if (!to) {
    throw new Error("Customer email is required.");
  }

  const resend = getResend();
  const from = getBrandedFrom("ToolCrate");

  const html = `
<div style="font-family: Inter, sans-serif; max-width: 560px; margin: 0 auto; background: #0f172a; color: white; padding: 2.5rem; border-radius: 1rem;">
  <p style="font-size: 1.5rem; font-weight: 700; margin: 0 0 0.5rem;">Your preview is ready. 🎉</p>
  <p style="color: #94a3b8; margin: 0 0 2rem;">Our AI just finished designing a brand-new version of your site. Take a look:</p>
  <a href="${previewUrl}" style="display: inline-block; background: linear-gradient(135deg, #f97316, #fb923c); color: white; font-weight: 700; padding: 1rem 2rem; border-radius: 9999px; text-decoration: none; font-size: 1rem;">See Your Design Preview →</a>
  <p style="color: #475569; font-size: 0.875rem; margin: 2rem 0 0;">If you like what you see and want it live, reply to this email. Setup is $497 and takes 48 hours.<br><br>- Alexander<br>ToolCrate</p>
</div>
  `.trim();

  const text = `Your preview is ready. 🎉

Our AI just finished designing a brand-new version of your site. Take a look:

${previewUrl}

If you like what you see and want it live, reply to this email. Setup is $497 and takes 48 hours.

- Alexander
ToolCrate`;

  const { data, error } = await resend.emails.send({
    from,
    to: [to],
    subject: "Your design preview is ready ✨",
    html,
    text,
  });

  if (error) {
    throw new Error(error.message || "Failed to send design-ready email via Resend.");
  }

  return data;
}


function welcomeEmailShell(bodyHtml) {
  return `
<div style="font-family: sans-serif; max-width: 600px; line-height: 1.6; color: #1a1a1a;">
${bodyHtml}
</div>
  `.trim();
}

/**
 * Post-purchase welcome email for Full Build or Conversion OS checkout.
 *
 * @param {string} email
 * @param {string|null|undefined} name
 * @param {'full-build'|'conversion-os'} tier
 * @returns {Promise<{ id: string }>}
 */
export async function sendWelcomeEmail(email, name, tier) {
  const to = email?.trim();
  if (!to) {
    throw new Error("Customer email is required.");
  }

  if (tier !== "full-build" && tier !== "conversion-os") {
    throw new Error(`Unsupported welcome email tier: ${tier}`);
  }

  const resend = getResend();
  const greeting = name?.trim() || "there";

  let subject;
  let html;
  let text;

  if (tier === "full-build") {
    subject = "You're in - here's what happens next";
    html = welcomeEmailShell(`
  <p>Hey ${greeting}, Alexander here from ToolCrate.</p>
  <p>Your payment went through and I'm already looking forward to building something great for your business.</p>
  <p>Here's what happens next:</p>
  <p>[1] You'll receive a short intake form within the hour — takes about 5 minutes.<br>
  [2] I'll review it and reach out within 24 hours to confirm scope and timeline.<br>
  [3] Your build starts within 3 business days.</p>
  <p>Questions? Just reply to this email.</p>
  <p>— Alexander</p>
    `);
    text = `Hey ${greeting}, Alexander here from ToolCrate.

Your payment went through and I'm already looking forward to building something great for your business.

Here's what happens next:
[1] You'll receive a short intake form within the hour - takes about 5 minutes.
[2] I'll review it and reach out within 24 hours to confirm scope and timeline.
[3] Your build starts within 3 business days.

Questions? Just reply to this email.

— Alexander`;
  } else {
    subject = "Welcome to Conversion OS - founding member confirmed";
    html = welcomeEmailShell(`
  <p>Hey ${greeting}, Alexander here.</p>
  <p>Your founding membership is confirmed — you're one of a very small group getting in at this price, and I don't take that lightly.</p>
  <p>Here's what's next:</p>
  <p>[1] Intake form coming your way within the hour.<br>
  [2] Onboarding call scheduled within 48 hours to map your first 30 days.<br>
  [3] Month 1 kicks off immediately after our call.</p>
  <p>This is going to be good.</p>
  <p>— Alexander</p>
    `);
    text = `Hey ${greeting}, Alexander here.

Your founding membership is confirmed - you're one of a very small group getting in at this price, and I don't take that lightly.

Here's what's next:
[1] Intake form coming your way within the hour.
[2] Onboarding call scheduled within 48 hours to map your first 30 days.
[3] Month 1 kicks off immediately after our call.

This is going to be good.

— Alexander`;
  }

  const { data, error } = await resend.emails.send({
    from: getFromAddress(),
    to: [to],
    subject,
    html,
    text,
  });

  if (error) {
    throw new Error(error.message || "Failed to send welcome email via Resend.");
  }

  return data;
}

const PREVIEW_NOTIFY_TO =
  process.env.PREVIEW_NOTIFY_EMAIL?.trim() || "alexschottky@gmail.com";

/**
 * Notify Alexander when someone starts a free preview from /try.
 *
 * @param {string} businessUrl — normalized site URL
 * @param {string|null|undefined} userEmail
 * @returns {Promise<{ id: string }|null>}
 */
export async function sendPreviewStartedNotification(businessUrl, userEmail) {
  if (!process.env.RESEND_API_KEY) {
    console.warn("[email] RESEND_API_KEY not set — skipping preview-started notification.");
    return null;
  }

  const resend = getResend();
  const from = getBrandedFrom("ToolCrate");

  const emailLabel = userEmail?.trim() || "None";
  const currentTime = new Date().toLocaleString("en-US", {
    timeZone: "America/Los_Angeles",
    dateStyle: "medium",
    timeStyle: "short",
  });

  const subject = `🚀 New ToolCrate Preview: ${businessUrl}`;

  const html = `
    <p>Someone just started a free preview!</p>
    <p><strong>URL:</strong> ${businessUrl}<br>
    <strong>Email provided:</strong> ${emailLabel}<br>
    <strong>Time:</strong> ${currentTime}</p>
    <p>Check it out: <a href="https://usetoolcrate.com/admin">usetoolcrate.com/admin</a></p>
  `.trim();

  const text = `Someone just started a free preview!

URL: ${businessUrl}
Email provided: ${emailLabel}
Time: ${currentTime}

Check it out: https://usetoolcrate.com/admin`;

  const { data, error } = await resend.emails.send({
    from,
    to: [PREVIEW_NOTIFY_TO],
    subject,
    html,
    text,
  });

  if (error) {
    throw new Error(error.message || "Failed to send preview-started notification via Resend.");
  }

  return data;
}

/**
 * Email a free audit PDF to a warm lead (Instantly reply follow-up).
 *
 * @param {string} customerEmail
 * @param {string} websiteUrl
 * @param {Buffer} pdfBuffer
 * @returns {Promise<{ id: string }>}
 */
export async function sendFreeAuditEmail(customerEmail, websiteUrl, pdfBuffer) {
  const to = customerEmail?.trim();
  if (!to) {
    throw new Error("Customer email is required.");
  }

  if (!Buffer.isBuffer(pdfBuffer) || pdfBuffer.length === 0) {
    throw new Error("A valid PDF buffer is required.");
  }

  const resend = getResend();
  const from = getFromAddress();
  const siteLabel = formatSiteLabel(websiteUrl);

  const html = `
    <p>Hi there,</p>
    <p>Per our conversation, attached is the free website teardown I ran for your business.</p>
    <p>Your audit for <a href="${websiteUrl}">${websiteUrl}</a> is attached as <strong>Website-Audit.pdf</strong>.</p>
    <p>Let me know if you have any questions about the fixes!</p>
    <p>— Alexander<br>Website Tear Down</p>
  `.trim();

  const text = `Hi there,

Per our conversation, attached is the free website teardown I ran for your business.

Your audit for ${websiteUrl} is attached (Website-Audit.pdf).

Let me know if you have any questions about the fixes!

— Alexander
Website Tear Down`;

  const { data, error } = await resend.emails.send({
    from,
    to: [to],
    subject: `Your free website teardown — ${siteLabel}`,
    html,
    text,
    attachments: [
      {
        filename: "Website-Audit.pdf",
        content: pdfBuffer,
        contentType: "application/pdf",
      },
    ],
  });

  if (error) {
    throw new Error(error.message || "Failed to send free audit email via Resend.");
  }

  return data;
}
