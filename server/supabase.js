import { createClient } from "@supabase/supabase-js";

let supabaseAdmin;

function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set on the server."
    );
  }

  if (!supabaseAdmin) {
    supabaseAdmin = createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  return supabaseAdmin;
}

export function isSupabaseConfigured() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function hoursAgoIso(hours) {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

export async function findAuditByStripeSessionId(stripeSessionId) {
  const supabase = getSupabaseAdmin();

  const fullSelect =
    "id, email, website_url, report, initial_email_sent_at, created_at";
  let { data, error } = await supabase
    .from("audits")
    .select(fullSelect)
    .eq("stripe_session_id", stripeSessionId)
    .maybeSingle();

  if (error && isMissingNurtureColumnsError(error.message)) {
    ({ data, error } = await supabase
      .from("audits")
      .select("id, email, website_url, report, created_at")
      .eq("stripe_session_id", stripeSessionId)
      .maybeSingle());
  }

  if (error) {
    throw new Error(error.message || "Failed to look up audit in Supabase.");
  }

  return data ?? null;
}

export async function markInitialEmailSent(auditId) {
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();

  const { error } = await supabase
    .from("audits")
    .update({ initial_email_sent_at: now })
    .eq("id", auditId)
    .is("initial_email_sent_at", null);

  if (error) {
    throw new Error(error.message || "Failed to mark initial email sent.");
  }
}

/**
 * Persist a completed paid audit for nurture sequencing.
 */
export async function saveAuditRecord({
  email,
  websiteUrl,
  stripeSessionId,
  report,
}) {
  const existing = await findAuditByStripeSessionId(stripeSessionId);
  if (existing) {
    return { id: existing.id, isNew: false };
  }

  const supabase = getSupabaseAdmin();

  const baseRow = {
    email: email.trim().toLowerCase(),
    website_url: websiteUrl,
    stripe_session_id: stripeSessionId,
    report,
  };

  const fullRow = {
    ...baseRow,
    nurture_step: 0,
    day_2_sent: false,
    day_4_sent: false,
    day_7_sent: false,
  };

  let { data, error } = await supabase
    .from("audits")
    .insert(fullRow)
    .select("id")
    .single();

  if (error && isMissingNurtureColumnsError(error.message)) {
    ({ data, error } = await supabase
      .from("audits")
      .insert(baseRow)
      .select("id")
      .single());
  }

  if (error) {
    throw new Error(error.message || "Failed to save audit to Supabase.");
  }

  return { id: data.id, isNew: true };
}

const AUDIT_SELECT =
  "id, email, website_url, report, created_at, nurture_step, day_2_sent, day_4_sent, day_7_sent, last_nurture_email_at";

const AUDIT_LIST_SELECT =
  "id, email, website_url, created_at, nurture_step, day_2_sent, day_4_sent, day_7_sent, call_script_generated_at";

const AUDIT_DETAIL_SELECT =
  "id, email, website_url, report, created_at, nurture_step, day_2_sent, day_4_sent, day_7_sent, last_nurture_email_at, call_script, call_script_generated_at";

const AUDIT_SELECT_BASIC = "id, email, website_url, created_at";

function isMissingNurtureColumnsError(message = "") {
  return /day_2_sent|day_4_sent|day_7_sent|nurture_step|last_nurture_email_at|call_script/i.test(
    message
  );
}

function withDefaultNurtureFlags(row) {
  return {
    ...row,
    nurture_step: row.nurture_step ?? 0,
    day_2_sent: row.day_2_sent ?? false,
    day_4_sent: row.day_4_sent ?? false,
    day_7_sent: row.day_7_sent ?? false,
    last_nurture_email_at: row.last_nurture_email_at ?? null,
  };
}

async function queryAudits(select, builder) {
  const supabase = getSupabaseAdmin();
  let query = supabase.from("audits").select(select);
  query = builder(query);

  const { data, error } = await query;

  if (!error) {
    return (data ?? []).map(withDefaultNurtureFlags);
  }

  if (select !== AUDIT_SELECT_BASIC && isMissingNurtureColumnsError(error.message)) {
    return queryAudits(AUDIT_SELECT_BASIC, builder);
  }

  throw new Error(error.message || "Failed to fetch audits.");
}

async function queryAuditById(select, auditId) {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("audits")
    .select(select)
    .eq("id", auditId)
    .maybeSingle();

  if (!error) {
    return data ? withDefaultNurtureFlags(data) : null;
  }

  if (select !== AUDIT_SELECT_BASIC && isMissingNurtureColumnsError(error.message)) {
    return queryAuditById(AUDIT_SELECT_BASIC, auditId);
  }

  throw new Error(error.message || "Failed to fetch audit.");
}

export async function fetchRecentAudits(limit = 50) {
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);

  return queryAudits(AUDIT_LIST_SELECT, (q) =>
    q.order("created_at", { ascending: false }).limit(safeLimit)
  );
}

export async function fetchAuditById(auditId) {
  const data = await queryAuditById(AUDIT_SELECT, auditId);

  if (!data) {
    const err = new Error("Audit not found.");
    err.statusCode = 404;
    throw err;
  }

  return data;
}

export async function fetchAuditDetailById(auditId) {
  let data = await queryAuditById(AUDIT_DETAIL_SELECT, auditId);

  if (!data) {
    data = await queryAuditById(AUDIT_SELECT, auditId);
  }

  if (!data) {
    const err = new Error("Audit not found.");
    err.statusCode = 404;
    throw err;
  }

  return data;
}

export async function saveCallScript(auditId, script) {
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();

  const { error } = await supabase
    .from("audits")
    .update({
      call_script: script,
      call_script_generated_at: now,
    })
    .eq("id", auditId);

  if (error) {
    if (/call_script/i.test(error.message)) {
      throw new Error(
        "call_script column missing. Run docs/supabase-call-script.sql in Supabase."
      );
    }
    throw new Error(error.message || "Failed to save call script.");
  }

  return { call_script_generated_at: now };
}

/** 48+ hours since audit, Day 2 not sent. */
export async function fetchAuditsDueForDay2() {
  const supabase = getSupabaseAdmin();
  const cutoff = hoursAgoIso(48);

  const { data, error } = await supabase
    .from("audits")
    .select(AUDIT_SELECT)
    .eq("day_2_sent", false)
    .lte("created_at", cutoff);

  if (error) {
    throw new Error(error.message || "Failed to fetch Day 2 nurture queue.");
  }

  return data ?? [];
}

/** 96+ hours since audit, Day 2 sent, Day 4 not sent. */
export async function fetchAuditsDueForDay4() {
  const supabase = getSupabaseAdmin();
  const cutoff = hoursAgoIso(96);

  const { data, error } = await supabase
    .from("audits")
    .select(AUDIT_SELECT)
    .eq("day_2_sent", true)
    .eq("day_4_sent", false)
    .lte("created_at", cutoff);

  if (error) {
    throw new Error(error.message || "Failed to fetch Day 4 nurture queue.");
  }

  return data ?? [];
}

/** 168+ hours since audit, Day 4 sent, Day 7 not sent. */
export async function fetchAuditsDueForDay7() {
  const supabase = getSupabaseAdmin();
  const cutoff = hoursAgoIso(168);

  const { data, error } = await supabase
    .from("audits")
    .select(AUDIT_SELECT)
    .eq("day_4_sent", true)
    .eq("day_7_sent", false)
    .lte("created_at", cutoff);

  if (error) {
    throw new Error(error.message || "Failed to fetch Day 7 nurture queue.");
  }

  return data ?? [];
}

export async function markDay2Sent(auditId) {
  return markNurtureFlag(auditId, { day_2_sent: true, nurture_step: 1 });
}

export async function markDay4Sent(auditId) {
  return markNurtureFlag(auditId, { day_4_sent: true, nurture_step: 2 });
}

export async function markDay7Sent(auditId) {
  return markNurtureFlag(auditId, { day_7_sent: true, nurture_step: 3 });
}

async function markNurtureFlag(auditId, flags) {
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();
  const payload = { ...flags, last_nurture_email_at: now };

  const { error } = await supabase.from("audits").update(payload).eq("id", auditId);

  if (error) {
    throw new Error(error.message || "Failed to update nurture flags in Supabase.");
  }
}

const WARM_LEAD_SELECT = "id, email, website, reply_text, status, created_at";

export async function insertWarmLead({ email, website, replyText }) {
  const supabase = getSupabaseAdmin();

  const row = {
    email: email.trim().toLowerCase(),
    website: website?.trim() || null,
    reply_text: replyText?.trim() || null,
    status: "pending",
  };

  const { data, error } = await supabase
    .from("warm_leads")
    .insert(row)
    .select(WARM_LEAD_SELECT)
    .single();

  if (error) {
    throw new Error(error.message || "Failed to insert warm lead.");
  }

  return data;
}

export async function fetchWarmLeads(limit = 50) {
  const supabase = getSupabaseAdmin();
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);

  const { data, error } = await supabase
    .from("warm_leads")
    .select(WARM_LEAD_SELECT)
    .order("created_at", { ascending: false })
    .limit(safeLimit);

  if (error) {
    throw new Error(error.message || "Failed to fetch warm leads.");
  }

  return data ?? [];
}

export async function fetchWarmLeadById(leadId) {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("warm_leads")
    .select(WARM_LEAD_SELECT)
    .eq("id", leadId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "Failed to fetch warm lead.");
  }

  if (!data) {
    const err = new Error("Warm lead not found.");
    err.statusCode = 404;
    throw err;
  }

  return data;
}

export async function markWarmLeadAuditSent(leadId) {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("warm_leads")
    .update({ status: "audit_sent" })
    .eq("id", leadId)
    .eq("status", "pending")
    .select(WARM_LEAD_SELECT)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "Failed to update warm lead status.");
  }

  if (!data) {
    const existing = await fetchWarmLeadById(leadId);
    if (existing.status === "audit_sent") {
      const err = new Error("Free audit was already sent for this lead.");
      err.statusCode = 409;
      throw err;
    }
    throw new Error("Could not update warm lead status.");
  }

  return data;
}
