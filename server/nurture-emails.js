import { getResend } from "./email.js";

const DEFAULT_FROM = "Website Tear Down <onboarding@resend.dev>";

function getFromAddress() {
  return process.env.RESEND_FROM_EMAIL?.trim() || DEFAULT_FROM;
}

function getBookingUrl() {
  return (
    process.env.CONVERSION_OS_BOOKING_URL?.trim() ||
    process.env.CALENDLY_URL?.trim() ||
    "https://calendly.com"
  );
}

/** Best-effort company label from domain, e.g. joes-plumbing.com → Joes Plumbing */
function getCompanyName(websiteUrl) {
  try {
    const host = new URL(websiteUrl).hostname.replace(/^www\./i, "");
    const base = host.split(".")[0] || host;
    return base
      .split(/[-_]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(" ");
  } catch {
    return "our team";
  }
}

function paragraphsToHtml(body) {
  return body
    .trim()
    .split(/\n\n+/)
    .map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`)
    .join("\n");
}

async function sendNurtureEmail({ to, subject, bodyText }) {
  const resend = getResend();
  const html = paragraphsToHtml(bodyText);

  const { data, error } = await resend.emails.send({
    from: getFromAddress(),
    to: [to],
    subject,
    html,
    text: bodyText.trim(),
  });

  if (error) {
    throw new Error(error.message || "Failed to send nurture email.");
  }

  return data;
}

/**
 * Day 2 — 48 hours after audit.
 */
export async function sendNurtureDay2Email(audit) {
  const websiteUrl = audit.website_url;
  const bodyText = `Hi there,

A couple of days ago, you ran a tear-down of ${websiteUrl}. If you looked at page 2 of the report, you likely noticed the 'Performance & Bloat' score.

Most local business websites are loaded down with excessive scripts and unoptimized images. When a customer clicks your site on their phone and it takes 4+ seconds to load, they hit the back button and call your competitor.

I don't do hourly 'patch jobs' to fix this because it just breaks again next month. Instead, I migrate my clients to my 'Conversion OS'—a lightning-fast, mobile-optimized system designed specifically to capture leads.

If you are tired of losing traffic to slow load times, reply to this email and let's talk about getting your site on a secure, modern foundation.

Best,
Alexander`;

  return sendNurtureEmail({
    to: audit.email,
    subject: "Your website speed is costing you leads.",
    bodyText,
  });
}

/**
 * Day 4 — 96 hours after audit.
 */
export async function sendNurtureDay4Email(audit) {
  const websiteUrl = audit.website_url;
  const company = getCompanyName(websiteUrl);

  const bodyText = `Hi there,

Alexander here. One of the biggest leaks I see in websites like ${websiteUrl} is how contact information is handled. The audit usually catches this under 'Lead Capture'.

If your phone number is buried, or if you simply miss a call because you are busy on a job site, that lead is gone. 60% of contractors don't answer the phone on the first ring.

My Conversion OS system includes an automated Missed-Call Text-Back feature. If someone calls you and you can't answer, the system immediately texts them: 'Hi, this is ${company}. We're on a job site, how can we help?'

This one feature saves my clients thousands of dollars a month. Want to see how it works? Reply to this email and I'll send you a quick demo.

Best,
Alexander`;

  return sendNurtureEmail({
    to: audit.email,
    subject: "How to stop losing phone leads",
    bodyText,
  });
}

/**
 * Day 7 — 168 hours after audit.
 */
export async function sendNurtureDay7Email(audit) {
  const websiteUrl = audit.website_url;
  const bookingUrl = getBookingUrl();

  const bodyText = `Hi there,

It's been a week since you ran the audit on ${websiteUrl}. By now, you know exactly what is broken under the hood and why it's costing you leads.

You can hand that PDF to your current web guy to try and fix the leaks, but if you want it done right the first time, let's talk.

I'm taking on 3 new clients this month to install my Conversion OS lead capture system. If you want a website that actually makes your phone ring instead of just acting as a digital business card, click here to book a 15-minute call with me: ${bookingUrl}

Best,
Alexander`;

  const resend = getResend();
  const html = `${paragraphsToHtml(bodyText).replace(
    bookingUrl,
    `<a href="${bookingUrl}">book a 15-minute call with me</a>`
  )}`;

  const { data, error } = await resend.emails.send({
    from: getFromAddress(),
    to: [audit.email],
    subject: "Taking on 3 new clients this month",
    html,
    text: bodyText.trim(),
  });

  if (error) {
    throw new Error(error.message || "Failed to send nurture email.");
  }

  return data;
}
