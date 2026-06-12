import { Resend } from "resend";

const DEFAULT_FROM = "Website Tear Down <onboarding@resend.dev>";

let resendClient;

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
  const from = process.env.RESEND_FROM_EMAIL?.trim() || DEFAULT_FROM;
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
  // Same sending address as the other emails, but branded "ToolCrate".
  const configuredFrom = process.env.RESEND_FROM_EMAIL?.trim() || DEFAULT_FROM;
  const fromAddress = configuredFrom.match(/<([^>]+)>/)?.[1] || configuredFrom;
  const from = `ToolCrate <${fromAddress}>`;

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
  const from = process.env.RESEND_FROM_EMAIL?.trim() || DEFAULT_FROM;
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
