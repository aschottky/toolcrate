import { getResend, getFromAddress } from "./email.js";

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

A couple of days ago I sent over the review of ${websiteUrl}. The part worth looking at is the speed score.

Most small business sites are carrying a lot of dead weight — extra scripts, photos straight off a phone at full size. Someone taps your site while standing in their driveway, it takes a few seconds to come up, and they go back and call the next name on the list.

I don't do patch jobs by the hour, because the same thing breaks again in a month. I build the page over, clean, so it loads fast on a phone and puts your number where a thumb lands.

If that's worth ten minutes, reply here or call me at (417) 409-1721.

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

Alexander here. The thing I see most often on sites like ${websiteUrl} is that the phone number is hard to find, or it isn't tappable on a phone — you have to pinch, zoom, and read it out loud to yourself.

You're on a job. Somebody's standing in their kitchen trying to give you money. That should take one tap.

I can build ${company} a page where the number is the first thing you see and it dials when you touch it. You look at the finished page before you pay me anything.

Reply here or call me at (417) 409-1721.

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

It's been about a week since I sent the review of ${websiteUrl}, so this is the last one from me.

You're welcome to hand that PDF to whoever built the site and have them fix it — genuinely, that's a fine outcome. If you'd rather I just build the replacement, a one-page site is $299 and a full build is $497, and you see it finished before you pay.

Easiest thing is to call me at (417) 409-1721. If you'd rather put something on the calendar: ${bookingUrl}

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
