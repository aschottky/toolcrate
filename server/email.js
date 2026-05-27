import { Resend } from "resend";

const DEFAULT_FROM = "Website Tear Down <onboarding@resend.dev>";

let resendClient;

function getResend() {
  if (!process.env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is not configured on the server.");
  }
  if (!resendClient) {
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }
  return resendClient;
}

function formatSiteLabel(websiteUrl) {
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
