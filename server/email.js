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

const DEFAULT_EMAIL_ROAST_BULLETS = [
  { emoji: "⚠️", text: "No phone number visible above the fold" },
  { emoji: "📵", text: "No reviews or social proof on the homepage" },
  { emoji: "🐌", text: "Headline doesn't explain what you actually do" },
  { emoji: "👻", text: "Site likely loads slowly on mobile" },
];

const EMAIL_ROAST_EMOJIS = ["⚠️", "📵", "🐌", "👻"];

function trimBulletWords(text, maxWords = 12) {
  const words = String(text ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length <= maxWords) return words.join(" ");
  return `${words.slice(0, maxWords).join(" ")}…`;
}

/** Real first name only — rejects email-like values and blanks. */
export function normalizeProspectFirstName(firstName) {
  const name = String(firstName ?? "").trim();
  if (!name || /[@.]/.test(name)) return null;
  return name.slice(0, 80);
}

export function buildEmailGreeting(firstName) {
  const name = normalizeProspectFirstName(firstName);
  return name ? `Hey ${name},` : "Hey there,";
}

function companyNameFromUrl(websiteUrl) {
  try {
    const host = new URL(websiteUrl).hostname.replace(/^www\./i, "");
    const base = host.split(".")[0].replace(/[-_]+/g, " ").trim();
    if (!base) return "your business";
    return base.replace(/\b\w/g, (c) => c.toUpperCase());
  } catch {
    return "your business";
  }
}

function resolveEmailRoastBullets(stored) {
  const hasEnough = Array.isArray(stored) && stored.length >= 4;
  const source = hasEnough ? stored.slice(0, 4) : DEFAULT_EMAIL_ROAST_BULLETS;

  return source.map((bullet, index) => {
    const text =
      typeof bullet === "string" ? bullet : bullet?.text || DEFAULT_EMAIL_ROAST_BULLETS[index].text;
    const emoji =
      (typeof bullet === "object" && bullet?.emoji) ||
      EMAIL_ROAST_EMOJIS[index] ||
      "⚠️";

    return {
      emoji,
      text: trimBulletWords(text),
    };
  });
}

/**
 * "Your design preview is ready" notification — sent when background generation finishes.
 *
 * @param {object} options
 * @param {string} options.customerEmail
 * @param {string} options.previewUrl — full link to /preview-view?t=
 * @param {string} [options.websiteUrl]
 * @param {Array<{emoji?: string, text: string}|string>|null|undefined} [options.roastBullets]
 * @param {string} [options.firstName]
 * @returns {Promise<{ id: string }>}
 */
export async function sendDesignReadyEmail({
  customerEmail,
  previewUrl,
  websiteUrl,
  roastBullets,
  firstName,
}) {
  const to = customerEmail?.trim();
  if (!to) {
    throw new Error("Customer email is required.");
  }

  const resend = getResend();
  const from = getFromAddress();
  const greeting = buildEmailGreeting(firstName);
  const companyName = companyNameFromUrl(websiteUrl || "");
  const bullets = resolveEmailRoastBullets(roastBullets);

  const bulletLinesHtml = bullets
    .map((b) => `<p style="margin: 0 0 0.5rem;">${b.emoji} ${b.text}</p>`)
    .join("\n");

  const bulletLinesText = bullets.map((b) => `${b.emoji} ${b.text}`).join("\n");

  const subject = `we looked at ${companyName}'s site while we were at it...`;

  const previewCtaLabel = "→ See Your Custom Redesign";
  const previewCtaHtml = `<a href="${previewUrl}" style="color: #2563eb; text-decoration: underline;">${previewCtaLabel}</a>`;

  const html = `
<div style="font-family: sans-serif; max-width: 600px; line-height: 1.6; color: #1a1a1a;">
  <p>${greeting}</p>
  <p>Your custom conversion redesign is ready — but before you see it, here's what stood out when I reviewed your current site:</p>
  ${bulletLinesHtml}
  <p style="margin: 1.5rem 0 0.75rem;">Now see what it could look like instead:</p>
  <p style="margin: 0 0 1.5rem;">${previewCtaHtml}</p>
  <p style="margin: 0;">— Alexander<br>ToolCrate</p>
</div>
  `.trim();

  const text = `${greeting}

Your custom conversion redesign is ready — but before you see it, here's what stood out when I reviewed your current site:

${bulletLinesText}

Now see what it could look like instead:

${previewCtaLabel}
${previewUrl}

— Alexander
ToolCrate`;

  const { data, error } = await resend.emails.send({
    from,
    to: [to],
    subject,
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
  <p>[1] Complete your 5-minute intake form here: <a href="https://usetoolcrate.com/intake">https://usetoolcrate.com/intake</a><br>
  [2] I'll review it and reach out within 24 hours to confirm scope and timeline.<br>
  [3] Your build starts within 3 business days.</p>
  <p>Questions? Just reply to this email.</p>
  <p>— Alexander</p>
    `);
    text = `Hey ${greeting}, Alexander here from ToolCrate.

Your payment went through and I'm already looking forward to building something great for your business.

Here's what happens next:
[1] Complete your 5-minute intake form here: https://usetoolcrate.com/intake
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
 * Notify Alexander when a new expert-curated review is queued from /try.
 *
 * @param {object} options
 * @param {string} options.businessUrl
 * @param {string|null|undefined} options.userEmail
 * @param {string|null|undefined} [options.userName]
 * @param {string} options.reviewUrl — internal preview link for Alexander
 * @returns {Promise<{ id: string }|null>}
 */
export async function sendNewLeadReviewNotification({
  businessUrl,
  userEmail,
  userName,
  userPhone,
  reviewUrl,
}) {
  if (!process.env.RESEND_API_KEY) {
    console.warn(
      `[email] RESEND_API_KEY not set — skipping new-lead review notification to ${PREVIEW_NOTIFY_TO}.`
    );
    return null;
  }

  const resend = getResend();
  const from = getBrandedFrom("ToolCrate");
  const notifyTo = PREVIEW_NOTIFY_TO;

  const emailLabel = userEmail?.trim() || "None provided";
  const nameLabel = userName?.trim() || "Not provided";
  const phoneLabel = userPhone?.trim() || "Not provided";
  const subject = `New submission: ${businessUrl}`;

  const html = `
    <p>A new lead submitted through the ToolCrate funnel.</p>
    <p><strong>Name:</strong> ${nameLabel}<br>
    <strong>URL:</strong> ${businessUrl}<br>
    <strong>Lead email:</strong> ${emailLabel}<br>
    <strong>Phone:</strong> ${phoneLabel}</p>
    <p><a href="${reviewUrl}">Open in admin preview</a></p>
    <p>No automatic AI generation was triggered. Start roast/redesign from admin when you are ready to work this lead.</p>
  `.trim();

  const text = `New submission: ${businessUrl}

Name: ${nameLabel}
Lead email: ${emailLabel}
Phone: ${phoneLabel}

Open in admin preview: ${reviewUrl}

No automatic AI generation was triggered. Start roast/redesign from admin when ready.`;

  const { data, error } = await resend.emails.send({
    from,
    to: [notifyTo],
    subject,
    html,
    text,
  });

  if (error) {
    throw new Error(error.message || "Failed to send new-lead review notification via Resend.");
  }

  console.log(`[email] New-lead review notification sent to ${notifyTo} (${businessUrl}).`);
  return data;
}

/**
 * @deprecated Use sendNewLeadReviewNotification for /try submissions.
 */
export async function sendPreviewStartedNotification(businessUrl, userEmail) {
  const reviewUrl = `https://usetoolcrate.com/admin`;
  return sendNewLeadReviewNotification({ businessUrl, userEmail, reviewUrl });
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
