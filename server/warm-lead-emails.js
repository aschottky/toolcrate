import { getResend, getFromAddress } from "./email.js";

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

/** Step 2 — 2 days after the free review. */
export async function sendWarmLeadFollowUp2Email(lead) {
  const bodyText = `Hi there,

Just making sure the PDF review we sent came through? If you want, we can build the fixed version of the page for you — you see it finished before you pay anything. Builds start at $299. Give us a call at (417) 409-1721 if it's easier.`;

  return sendWarmLeadEmail({
    to: lead.email,
    subject: "Did you get the review we sent?",
    bodyText,
  });
}

/** Step 3 — 4 days after step 2. */
export async function sendWarmLeadFollowUp3Email(lead) {
  const bodyText = `Hey,

We don't want to bug you, just floating this to the top of your inbox one last time. If you want us to take over the website updates and install the Missed-Call text system, just reply and we can get started.`;

  return sendWarmLeadEmail({
    to: lead.email,
    subject: "Last check-in on your website fixes",
    bodyText,
  });
}
