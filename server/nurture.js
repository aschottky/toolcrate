import {
  sendNurtureDay2Email,
  sendNurtureDay4Email,
  sendNurtureDay7Email,
} from "./nurture-emails.js";
import {
  fetchAuditsDueForDay2,
  fetchAuditsDueForDay4,
  fetchAuditsDueForDay7,
  isSupabaseConfigured,
  markDay2Sent,
  markDay4Sent,
  markDay7Sent,
} from "./supabase.js";

const NURTURE_STAGES = [
  {
    label: "day2",
    fetch: fetchAuditsDueForDay2,
    send: sendNurtureDay2Email,
    mark: markDay2Sent,
  },
  {
    label: "day4",
    fetch: fetchAuditsDueForDay4,
    send: sendNurtureDay4Email,
    mark: markDay4Sent,
  },
  {
    label: "day7",
    fetch: fetchAuditsDueForDay7,
    send: sendNurtureDay7Email,
    mark: markDay7Sent,
  },
];

/**
 * Process Day 2 (48h), Day 4 (96h), and Day 7 (168h) nurture emails.
 */
export async function processNurtureEmails() {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured.");
  }

  const summary = {
    processed: { day2: 0, day4: 0, day7: 0 },
    sent: { day2: [], day4: [], day7: [] },
    errors: [],
  };

  for (const stage of NURTURE_STAGES) {
    const due = await stage.fetch();

    for (const audit of due) {
      try {
        await stage.send(audit);
        await stage.mark(audit.id);
        summary.processed[stage.label] += 1;
        summary.sent[stage.label].push({
          id: audit.id,
          email: audit.email,
          website_url: audit.website_url,
        });
        console.log(
          `[nurture] Sent ${stage.label} email to ${audit.email} (${audit.id})`
        );
      } catch (error) {
        const message = error?.message || "Unknown error";
        console.error(`[nurture] Failed ${stage.label} for ${audit.id}:`, message);
        summary.errors.push({
          id: audit.id,
          email: audit.email,
          stage: stage.label,
          error: message,
        });
      }
    }
  }

  return summary;
}

function getStage(label) {
  const stage = NURTURE_STAGES.find((s) => s.label === label);
  if (!stage) {
    throw new Error(`Unknown nurture stage: ${label}`);
  }
  return stage;
}

/**
 * Send one nurture email for an audit.
 * @param {object} audit
 * @param {"day2"|"day4"|"day7"} stageLabel
 * @param {{ markSent?: boolean, overrideTo?: string }} options
 */
export async function sendNurtureStage(audit, stageLabel, options = {}) {
  const { markSent = true, overrideTo = null } = options;
  const stage = getStage(stageLabel);
  const recipient = overrideTo?.trim() || audit.email;
  const auditForSend = { ...audit, email: recipient };

  await stage.send(auditForSend);

  if (markSent && !overrideTo) {
    await stage.mark(audit.id);
  }

  return { stage: stageLabel, sentTo: recipient, marked: markSent && !overrideTo };
}

/**
 * Send Day 2, 4, and 7 templates to a preview inbox (does not update Supabase).
 */
export async function sendAllNurturePreviews({ to, audit }) {
  const sample =
    audit ??
    ({
      id: "preview",
      email: to,
      website_url: "https://example-contractor.com",
    });

  const results = [];

  for (const stage of NURTURE_STAGES) {
    await stage.send({ ...sample, email: to });
    results.push(stage.label);
  }

  return { sent: results, to, website_url: sample.website_url };
}
