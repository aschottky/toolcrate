import {
  sendWarmLeadFollowUp2Email,
  sendWarmLeadFollowUp3Email,
} from "./warm-lead-emails.js";
import {
  fetchWarmLeadsDueForStep2,
  fetchWarmLeadsDueForStep3,
  isSupabaseConfigured,
  markWarmLeadStep2Sent,
  markWarmLeadStep3Sent,
} from "./supabase.js";

const WARM_LEAD_STAGES = [
  {
    label: "step2",
    fetch: fetchWarmLeadsDueForStep2,
    send: sendWarmLeadFollowUp2Email,
    mark: markWarmLeadStep2Sent,
  },
  {
    label: "step3",
    fetch: fetchWarmLeadsDueForStep3,
    send: sendWarmLeadFollowUp3Email,
    mark: markWarmLeadStep3Sent,
  },
];

/** Process warm-lead follow-ups (step 2 at +2 days, step 3 at +4 days after last email). */
export async function processWarmLeadNurture() {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured.");
  }

  const summary = {
    processed: { step2: 0, step3: 0 },
    sent: { step2: [], step3: [] },
    errors: [],
  };

  for (const stage of WARM_LEAD_STAGES) {
    const due = await stage.fetch();

    for (const lead of due) {
      try {
        await stage.send(lead);
        await stage.mark(lead.id);
        summary.processed[stage.label] += 1;
        summary.sent[stage.label].push({
          id: lead.id,
          email: lead.email,
          website: lead.website,
        });
        console.log(
          `[warm-lead-nurture] Sent ${stage.label} to ${lead.email} (${lead.id})`
        );
      } catch (error) {
        const message = error?.message || "Unknown error";
        console.error(
          `[warm-lead-nurture] Failed ${stage.label} for ${lead.id}:`,
          message
        );
        summary.errors.push({
          id: lead.id,
          email: lead.email,
          stage: stage.label,
          error: message,
        });
      }
    }
  }

  return summary;
}
