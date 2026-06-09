import { buildAuditPdf } from "./audit-pipeline.js";
import { sendFreeAuditEmail } from "./email.js";
import { generateCallScript } from "./call-script.js";
import {
  fetchAuditById,
  fetchAuditDetailById,
  fetchRecentAudits,
  findAuditByStripeSessionId,
  fetchWarmLeadById,
  fetchWarmLeads,
  insertWarmLead,
  isSupabaseConfigured,
  markInitialEmailSent,
  markWarmLeadAuditSent,
  saveAuditRecord,
  saveCallScript,
} from "./supabase.js";
import { sendAllNurturePreviews, sendNurtureStage } from "./nurture.js";

const STAGE_BY_DAY = {
  2: "day2",
  4: "day4",
  7: "day7",
};

function requireSupabase() {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured.");
  }
}

function parseDay(value) {
  const day = Number(value);
  if (!STAGE_BY_DAY[day]) {
    const err = new Error("day must be 2, 4, or 7.");
    err.statusCode = 400;
    throw err;
  }
  return STAGE_BY_DAY[day];
}

export async function listAudits(req) {
  requireSupabase();
  const limit = Number(req.query.limit) || 50;
  const audits = await fetchRecentAudits(limit);
  return { ok: true, audits };
}

export async function sendAuditNurture(req) {
  requireSupabase();
  const stageLabel = parseDay(req.body?.day);
  const previewTo = req.body?.previewTo?.trim() || null;
  const audit = await fetchAuditById(req.params.id);

  const result = await sendNurtureStage(audit, stageLabel, {
    markSent: !previewTo,
    overrideTo: previewTo,
  });

  return {
    ok: true,
    auditId: audit.id,
    ...result,
  };
}

export async function getAuditDetail(req) {
  requireSupabase();
  const audit = await fetchAuditDetailById(req.params.id);

  return {
    ok: true,
    audit: {
      id: audit.id,
      email: audit.email,
      website_url: audit.website_url,
      created_at: audit.created_at,
      day_2_sent: audit.day_2_sent,
      day_4_sent: audit.day_4_sent,
      day_7_sent: audit.day_7_sent,
      report: audit.report,
      call_script: audit.call_script ?? null,
      call_script_generated_at: audit.call_script_generated_at ?? null,
    },
  };
}

function resolveAuditId(req) {
  const id =
    req.body?.audit_id?.trim() ||
    req.body?.auditId?.trim() ||
    req.params?.id?.trim() ||
    "";

  if (!id) {
    const err = new Error("audit_id is required.");
    err.statusCode = 400;
    throw err;
  }

  return id;
}

export async function generateScript(req) {
  requireSupabase();
  const auditId = resolveAuditId(req);
  const force = Boolean(req.body?.force || req.body?.regenerate);

  const audit = await fetchAuditDetailById(auditId);

  if (!audit.report) {
    const err = new Error("This audit has no report data to generate a script from.");
    err.statusCode = 400;
    throw err;
  }

  if (!force && audit.call_script?.trim()) {
    return {
      ok: true,
      auditId,
      script: audit.call_script,
      cached: true,
      call_script_generated_at: audit.call_script_generated_at,
    };
  }

  const started = Date.now();
  console.log(`[admin] Generating call script for audit ${auditId}...`);

  const script = await generateCallScript({
    websiteUrl: audit.website_url,
    report: audit.report,
  });

  const saved = await saveCallScript(auditId, script);
  console.log(`[admin] Call script saved for ${auditId} (${Date.now() - started}ms)`);

  return {
    ok: true,
    auditId,
    script,
    cached: false,
    call_script_generated_at: saved.call_script_generated_at,
  };
}

export async function previewAllNurtureEmails(req) {
  const to = String(req.body?.to ?? req.body?.email ?? "").trim();

  if (!to) {
    const err = new Error("to (email address) is required.");
    err.statusCode = 400;
    throw err;
  }

  let audit = null;
  const auditId = req.body?.auditId?.trim();

  if (isSupabaseConfigured()) {
    try {
      if (auditId) {
        audit = await fetchAuditById(auditId);
      } else {
        const [latest] = await fetchRecentAudits(1);
        audit = latest ?? null;
      }
    } catch (error) {
      console.warn("[admin] Could not load audit for preview:", error.message);
    }
  }

  const result = await sendAllNurturePreviews({ to, audit });

  return {
    ok: true,
    message: `Sent 3 nurture preview emails to ${to}`,
    ...result,
  };
}

export async function listWarmLeads(req) {
  requireSupabase();
  const limit = Number(req.query.limit) || 50;
  const leads = await fetchWarmLeads(limit);
  return { ok: true, leads };
}

export async function createWarmLead(req) {
  requireSupabase();

  const email = String(req.body?.email ?? "").trim();
  const website = String(req.body?.website ?? req.body?.websiteUrl ?? "").trim() || null;
  const replyText =
    String(req.body?.reply_text ?? req.body?.replyText ?? "").trim() || null;

  if (!email) {
    const err = new Error("email is required.");
    err.statusCode = 400;
    throw err;
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    const err = new Error("email must be a valid address.");
    err.statusCode = 400;
    throw err;
  }

  const lead = await insertWarmLead({ email, website, replyText });

  return { ok: true, lead };
}

function resolveLeadId(req) {
  const id =
    req.body?.lead_id?.trim() ||
    req.body?.leadId?.trim() ||
    req.params?.id?.trim() ||
    "";

  if (!id) {
    const err = new Error("lead_id is required.");
    err.statusCode = 400;
    throw err;
  }

  return id;
}

function warmLeadSessionId(leadId) {
  return `warm_lead:${leadId}`;
}

export async function syncWarmLeadAudit(req) {
  requireSupabase();
  const leadId = resolveLeadId(req);
  const lead = await fetchWarmLeadById(leadId);

  if (!lead.website?.trim()) {
    const err = new Error("This lead has no website URL.");
    err.statusCode = 400;
    throw err;
  }

  const sessionId = warmLeadSessionId(leadId);
  const existing = await findAuditByStripeSessionId(sessionId);

  if (existing) {
    return {
      ok: true,
      audit_id: existing.id,
      cached: true,
      message: "Already in Recent audits.",
    };
  }

  const logPrefix = `[sync-audit:${leadId}]`;
  console.log(`${logPrefix} Backfilling audit for ${lead.website}...`);

  const { normalizedUrl, report } = await buildAuditPdf(lead.website, logPrefix);

  const saved = await saveAuditRecord({
    email: lead.email,
    websiteUrl: normalizedUrl,
    stripeSessionId: sessionId,
    report,
  });

  await markInitialEmailSent(saved.id);

  return {
    ok: true,
    audit_id: saved.id,
    cached: false,
    website: normalizedUrl,
    message: "Added to Recent audits (no email resent).",
  };
}

export async function sendFreeAudit(req) {
  requireSupabase();
  const leadId = resolveLeadId(req);
  const lead = await fetchWarmLeadById(leadId);

  if (!lead.website?.trim()) {
    const err = new Error(
      "This lead has no website URL. Add a website in Instantly custom variables and re-import, or update the row in Supabase."
    );
    err.statusCode = 400;
    throw err;
  }

  if (lead.status === "audit_sent" || lead.status === "completed") {
    const err = new Error("Free audit was already sent for this lead.");
    err.statusCode = 409;
    throw err;
  }

  const logPrefix = `[free-audit:${leadId}]`;
  console.log(`${logPrefix} Generating audit for ${lead.website} → ${lead.email}`);

  const { pdfBuffer, normalizedUrl, report } = await buildAuditPdf(
    lead.website,
    logPrefix
  );

  console.log(`${logPrefix} Saving audit to Supabase...`);
  const saved = await saveAuditRecord({
    email: lead.email,
    websiteUrl: normalizedUrl,
    stripeSessionId: warmLeadSessionId(leadId),
    report,
  });

  console.log(`${logPrefix} Emailing PDF to ${lead.email}...`);
  const emailResult = await sendFreeAuditEmail(lead.email, normalizedUrl, pdfBuffer);

  await markInitialEmailSent(saved.id);
  const updated = await markWarmLeadAuditSent(leadId);

  console.log(`${logPrefix} Done — status audit_sent, audit ${saved.id}`);

  return {
    ok: true,
    lead_id: updated.id,
    audit_id: saved.id,
    email: updated.email,
    website: normalizedUrl,
    status: updated.status,
    resend_id: emailResult?.id ?? null,
  };
}

export function registerAdminRoutes(app, { verifyCronSecret }) {
  function guard(handler) {
    return async (req, res) => {
      try {
        verifyCronSecret(req);
        const payload = await handler(req);
        return res.json(payload);
      } catch (error) {
        const status = error.statusCode ?? 500;
        console.error("[admin]", error.message);
        return res.status(status).json({
          ok: false,
          error: error.message,
        });
      }
    };
  }

  app.get("/api/admin/audits", guard(listAudits));
  app.get("/api/admin/audits/:id", guard(getAuditDetail));
  app.post("/api/admin/audits/:id/send-nurture", guard(sendAuditNurture));
  app.post("/api/admin/audits/:id/generate-script", guard(generateScript));
  app.post("/api/admin/generate-script", guard(generateScript));
  app.post("/api/admin/nurture-preview", guard(previewAllNurtureEmails));
  app.get("/api/admin/warm-leads", guard(listWarmLeads));
  app.post("/api/admin/warm-leads", guard(createWarmLead));
  app.post("/api/admin/warm-leads/:id/sync-audit", guard(syncWarmLeadAudit));
  app.post("/api/admin/send-free-audit", guard(sendFreeAudit));
}
