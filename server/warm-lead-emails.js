import { getResend } from "./email.js";

const DEFAULT_FROM = "Website Tear Down <onboarding@resend.dev>";

function getFromAddress() {
  return process.env.RESEND_FROM_EMAIL?.trim() || DEFAULT_FROM;
}

function paragraphsToHtml(body) {
  return body
    .trim()
    .split(/\n\n+/)
    .map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`)
    .join("\n");
}

async function sendWarmLeadEmail({ to, subject, bodyText }) {
  const resend = getResend();

  const { data, error } = await resend.emails.send({
    from: getFromAddress(),
    to: [to],
    subject,
    html: paragraphsToHtml(bodyText),
    text: bodyText.trim(),
  });

  if (error) {
    throw new Error(error.message || "Failed to send warm lead follow-up email.");
  }

  return data;
}

/** Step 2 — 2 days after free audit. */
export async function sendWarmLeadFollowUp2Email(lead) {
  const bodyText = `Hi there,

Just making sure you received the PDF website teardown I sent over? If you want, I can actually implement all of those fixes for you, plus set up an automated Missed-Call text system so you stop losing leads. I run a 'Conversion OS' package for $300/mo that handles it all. Let me know if you want to chat.`;

  return sendWarmLeadEmail({
    to: lead.email,
    subject: "Did you get your website teardown?",
    bodyText,
  });
}

/** Step 3 — 4 days after step 2. */
export async function sendWarmLeadFollowUp3Email(lead) {
  const bodyText = `Hey,

I don't want to bug you, just floating this to the top of your inbox one last time. If you want me to take over the website updates and install the Missed-Call text system, just reply and we can get started.`;

  return sendWarmLeadEmail({
    to: lead.email,
    subject: "Last check-in on your website fixes",
    bodyText,
  });
}
