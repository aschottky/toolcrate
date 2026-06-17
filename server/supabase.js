import { createClient } from "@supabase/supabase-js";
import { normalizeRootDomain } from "./url-utils.js";

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

  try {
    const { data, error } = await query;

    if (!error) {
      return (data ?? []).map(withDefaultNurtureFlags);
    }

    if (select !== AUDIT_SELECT_BASIC && isMissingNurtureColumnsError(error.message)) {
      return queryAudits(AUDIT_SELECT_BASIC, builder);
    }

    throw wrapSupabaseError(error, "fetch audits");
  } catch (error) {
    if (select !== AUDIT_SELECT_BASIC && isMissingNurtureColumnsError(error?.message)) {
      return queryAudits(AUDIT_SELECT_BASIC, builder);
    }
    throw wrapSupabaseError(error, "fetch audits");
  }
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

const WARM_LEAD_SELECT =
  "id, email, website, reply_text, status, follow_up_step, last_emailed_at, created_at";

function isMissingWarmLeadFollowUpColumns(message = "") {
  return /follow_up_step|last_emailed_at|completed/i.test(message);
}

function wrapSupabaseError(error, context) {
  const message = error?.message || String(error);
  if (/fetch failed|ENOTFOUND|ECONNREFUSED|ETIMEDOUT|network/i.test(message)) {
    return new Error(
      `Cannot reach Supabase (${context}). Check SUPABASE_URL in Render — open Supabase Dashboard → Project Settings → API and copy the Project URL. The hostname in your env may be wrong or the project may be paused.`
    );
  }
  return new Error(message || `Supabase error (${context}).`);
}

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
    throw wrapSupabaseError(error, "insert warm lead");
  }

  return data;
}

export async function upsertWarmLeadFromReply({ email, website, replyText }) {
  const supabase = getSupabaseAdmin();
  const normalizedEmail = email.trim().toLowerCase();

  let existing = null;

  try {
    const { data, error } = await supabase
      .from("warm_leads")
      .select(WARM_LEAD_SELECT)
      .eq("email", normalizedEmail)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw wrapSupabaseError(error, "look up warm lead");
    }
    existing = data;
  } catch (error) {
    if (isMissingWarmLeadFollowUpColumns(error.message)) {
      const { data, error } = await supabase
        .from("warm_leads")
        .select("id, email, website, reply_text, status, created_at")
        .eq("email", normalizedEmail)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw wrapSupabaseError(error, "look up warm lead");
      existing = data;
    } else {
      throw error;
    }
  }

  const basePatch = {
    reply_text: replyText?.trim() || null,
    status: "pending",
  };
  if (website?.trim()) {
    basePatch.website = website.trim();
  }

  const fullPatch = {
    ...basePatch,
    follow_up_step: 0,
    last_emailed_at: null,
  };

  if (existing) {
    let { data, error } = await supabase
      .from("warm_leads")
      .update(fullPatch)
      .eq("id", existing.id)
      .select(WARM_LEAD_SELECT)
      .single();

    if (error && isMissingWarmLeadFollowUpColumns(error.message)) {
      ({ data, error } = await supabase
        .from("warm_leads")
        .update(basePatch)
        .eq("id", existing.id)
        .select("id, email, website, reply_text, status, created_at")
        .single());
    }

    if (error) {
      throw wrapSupabaseError(error, "update warm lead");
    }

    return { ...data, updated: true };
  }

  const inserted = await insertWarmLead({ email: normalizedEmail, website, replyText });
  return { ...inserted, updated: false };
}

export async function fetchWarmLeads(limit = 50) {
  const supabase = getSupabaseAdmin();
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);

  try {
    const { data, error } = await supabase
      .from("warm_leads")
      .select(WARM_LEAD_SELECT)
      .order("created_at", { ascending: false })
      .limit(safeLimit);

    if (error) {
      throw wrapSupabaseError(error, "fetch warm leads");
    }

    return data ?? [];
  } catch (error) {
    throw wrapSupabaseError(error, "fetch warm leads");
  }
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
  const now = new Date().toISOString();

  const fullUpdate = {
    status: "audit_sent",
    follow_up_step: 1,
    last_emailed_at: now,
  };

  let { data, error } = await supabase
    .from("warm_leads")
    .update(fullUpdate)
    .eq("id", leadId)
    .eq("status", "pending")
    .select(WARM_LEAD_SELECT)
    .maybeSingle();

  if (error && isMissingWarmLeadFollowUpColumns(error.message)) {
    ({ data, error } = await supabase
      .from("warm_leads")
      .update({ status: "audit_sent" })
      .eq("id", leadId)
      .eq("status", "pending")
      .select("id, email, website, reply_text, status, created_at")
      .maybeSingle());
  }

  if (error) {
    throw new Error(error.message || "Failed to update warm lead status.");
  }

  if (!data) {
    const existing = await fetchWarmLeadById(leadId);
    if (existing.status === "audit_sent" || existing.status === "completed") {
      const err = new Error("Free audit was already sent for this lead.");
      err.statusCode = 409;
      throw err;
    }
    throw new Error("Could not update warm lead status.");
  }

  return data;
}

const REDESIGN_LIST_SELECT =
  "id, website_url, email, source_type, source_id, engine, model, max_tokens, preview_token, created_at";

function isMissingRedesignsTable(message = "") {
  return /relation .*redesigns.* does not exist|Could not find the table/i.test(message);
}

function wrapRedesignError(error, context) {
  if (isMissingRedesignsTable(error?.message)) {
    return new Error(
      "redesigns table missing. Run docs/supabase-redesigns.sql in Supabase → SQL Editor."
    );
  }
  return wrapSupabaseError(error, context);
}

export async function insertRedesign({
  websiteUrl,
  email,
  sourceType,
  sourceId,
  engine,
  model,
  maxTokens,
  html,
}) {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("redesigns")
    .insert({
      website_url: websiteUrl,
      email: email?.trim().toLowerCase() || null,
      source_type: sourceType,
      source_id: sourceId || null,
      engine,
      model,
      max_tokens: maxTokens,
      html,
    })
    .select(REDESIGN_LIST_SELECT)
    .single();

  if (error) {
    throw wrapRedesignError(error, "insert redesign");
  }

  return data;
}

export async function fetchRecentRedesigns(limit = 50) {
  const supabase = getSupabaseAdmin();
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);

  const { data, error } = await supabase
    .from("redesigns")
    .select(REDESIGN_LIST_SELECT)
    .order("created_at", { ascending: false })
    .limit(safeLimit);

  if (error) {
    throw wrapRedesignError(error, "fetch redesigns");
  }

  return data ?? [];
}

function isMissingPreviewWaitColumns(message = "") {
  return /'?(status|lead_intent)'? column|column .*(status|lead_intent)/i.test(message);
}

function isMissingRoastColumns(message = "") {
  return /'?(roast_bullets|roast_status)'? column|column .*(roast_bullets|roast_status)/i.test(
    message
  );
}

/**
 * Insert a redesign row BEFORE generation so the preview token exists
 * immediately. Requires the status column / nullable html from
 * docs/supabase-redesigns.sql — callers fall back to the synchronous
 * generate-then-insert flow when this throws.
 */
export async function insertPendingRedesign({
  websiteUrl,
  email,
  sourceType,
  sourceId,
  engine,
  model,
  maxTokens,
}) {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("redesigns")
    .insert({
      website_url: websiteUrl,
      email: email?.trim().toLowerCase() || null,
      source_type: sourceType,
      source_id: sourceId || null,
      engine,
      model,
      max_tokens: maxTokens,
      html: null,
      status: "pending",
    })
    .select(REDESIGN_LIST_SELECT)
    .single();

  if (error) {
    throw wrapRedesignError(error, "insert pending redesign");
  }

  return data;
}

export async function completeRedesign(redesignId, html) {
  const supabase = getSupabaseAdmin();

  const { error } = await supabase
    .from("redesigns")
    .update({ html, status: "ready" })
    .eq("id", redesignId);

  if (error) {
    throw wrapRedesignError(error, "complete redesign");
  }
}

export async function saveRoastBullets(redesignId, roastBullets) {
  const supabase = getSupabaseAdmin();

  const { error } = await supabase
    .from("redesigns")
    .update({
      roast_bullets: roastBullets,
      roast_status: "ready",
    })
    .eq("id", redesignId);

  if (error) {
    throw wrapRedesignError(error, "save roast bullets");
  }
}

export async function markRoastFailed(redesignId) {
  const supabase = getSupabaseAdmin();

  const { error } = await supabase
    .from("redesigns")
    .update({ roast_status: "failed" })
    .eq("id", redesignId);

  if (error) {
    throw wrapRedesignError(error, "mark roast failed");
  }
}

export async function markRedesignFailed(redesignId) {
  const supabase = getSupabaseAdmin();

  const { error } = await supabase
    .from("redesigns")
    .update({ status: "failed" })
    .eq("id", redesignId);

  if (error) {
    throw wrapRedesignError(error, "mark redesign failed");
  }
}

/**
 * Latest redesign whose stored website_url resolves to the given root domain.
 * The ilike pre-filter narrows the scan; the exact match happens in JS via
 * normalizeRootDomain so www/protocol/path differences never cause misses.
 */
export async function findLatestRedesignForDomain(rootDomain) {
  const supabase = getSupabaseAdmin();

  let { data, error } = await supabase
    .from("redesigns")
    .select("id, website_url, email, preview_token, status, created_at")
    .ilike("website_url", `%${rootDomain}%`)
    .order("created_at", { ascending: false })
    .limit(25);

  if (error && isMissingPreviewWaitColumns(error.message)) {
    ({ data, error } = await supabase
      .from("redesigns")
      .select("id, website_url, email, preview_token, created_at")
      .ilike("website_url", `%${rootDomain}%`)
      .order("created_at", { ascending: false })
      .limit(25));
  }

  if (error) {
    throw wrapRedesignError(error, "find redesign by domain");
  }

  return (
    (data ?? []).find(
      (row) => normalizeRootDomain(row.website_url) === rootDomain
    ) ?? null
  );
}

/**
 * Everything needed to decide on / send the "design ready" notification.
 * Returns design_email_sent: null when the column is missing (pre-migration)
 * so callers can skip sending rather than risk duplicate emails.
 */
export async function fetchRedesignNotificationInfo(redesignId) {
  const supabase = getSupabaseAdmin();

  let { data, error } = await supabase
    .from("redesigns")
    .select("id, email, preview_token, design_email_sent")
    .eq("id", redesignId)
    .maybeSingle();

  if (error && /design_email_sent/i.test(error.message)) {
    ({ data, error } = await supabase
      .from("redesigns")
      .select("id, email, preview_token")
      .eq("id", redesignId)
      .maybeSingle());
    if (!error && data) {
      data = { ...data, design_email_sent: null };
    }
  }

  if (error) {
    throw wrapRedesignError(error, "fetch redesign notification info");
  }

  return data ?? null;
}

export async function markDesignEmailSent(redesignId) {
  const supabase = getSupabaseAdmin();

  const { error } = await supabase
    .from("redesigns")
    .update({ design_email_sent: true })
    .eq("id", redesignId);

  if (error) {
    throw wrapRedesignError(error, "mark design email sent");
  }
}

/** Backfill the prospect's email on a redesign row (used when a duplicate
 *  domain is submitted and the original row had no email). */
export async function setRedesignEmail(redesignId, email) {
  const supabase = getSupabaseAdmin();

  const { error } = await supabase
    .from("redesigns")
    .update({ email: email.trim().toLowerCase() })
    .eq("id", redesignId);

  if (error) {
    throw wrapRedesignError(error, "set redesign email");
  }
}

export async function fetchRedesignByToken(previewToken) {
  const supabase = getSupabaseAdmin();

  const query = (select) =>
    supabase
      .from("redesigns")
      .select(select)
      .eq("preview_token", previewToken)
      .maybeSingle();

  // business_name / company_name are optional columns (used to personalize the
  // wait screen); older tables also lack status — fall back progressively.
  let { data, error } = await query(
    "id, website_url, html, status, business_name, company_name, roast_bullets, roast_status"
  );

  if (error && /business_name|company_name/i.test(error.message)) {
    ({ data, error } = await query(
      "id, website_url, html, status, roast_bullets, roast_status"
    ));
  }

  if (error && isMissingRoastColumns(error.message)) {
    ({ data, error } = await query("id, website_url, html, status, business_name, company_name"));
    if (error && /business_name|company_name/i.test(error.message)) {
      ({ data, error } = await query("id, website_url, html, status"));
    }
  }

  if (error && isMissingPreviewWaitColumns(error.message)) {
    ({ data, error } = await query("id, website_url, html"));
  }

  if (error) {
    throw wrapRedesignError(error, "fetch redesign preview");
  }

  if (!data) return null;

  return {
    ...data,
    status: data.status ?? (data.html ? "ready" : "pending"),
  };
}

/** Returns the updated row id, or null when the token doesn't exist. */
export async function saveRedesignLeadIntent(previewToken, intent) {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("redesigns")
    .update({ lead_intent: intent })
    .eq("preview_token", previewToken)
    .select("id")
    .maybeSingle();

  if (error) {
    if (isMissingPreviewWaitColumns(error.message)) {
      throw new Error(
        "lead_intent column missing. Run docs/supabase-redesigns.sql in Supabase → SQL Editor."
      );
    }
    throw wrapRedesignError(error, "save lead intent");
  }

  return data ?? null;
}

/** Step 2 due: audit sent, step 1, 48+ hours since last email. */
export async function fetchWarmLeadsDueForStep2() {
  return fetchWarmLeadsDueForStep(1, 48);
}

/** Step 3 due: audit sent, step 2, 96+ hours (4 days) since last email. */
export async function fetchWarmLeadsDueForStep3() {
  return fetchWarmLeadsDueForStep(2, 96);
}

async function fetchWarmLeadsDueForStep(currentStep, hoursSinceEmail) {
  const supabase = getSupabaseAdmin();
  const cutoff = hoursAgoIso(hoursSinceEmail);

  try {
    const { data, error } = await supabase
      .from("warm_leads")
      .select(WARM_LEAD_SELECT)
      .eq("status", "audit_sent")
      .eq("follow_up_step", currentStep)
      .lte("last_emailed_at", cutoff);

    if (error) {
      throw wrapSupabaseError(error, "fetch warm lead nurture queue");
    }

    return data ?? [];
  } catch (error) {
    if (isMissingWarmLeadFollowUpColumns(error.message)) {
      throw new Error(
        "warm_leads follow-up columns missing. Run docs/supabase-warm-leads-follow-up.sql in Supabase."
      );
    }
    throw error;
  }
}

export async function markWarmLeadStep2Sent(leadId) {
  return markWarmLeadFollowUpStep(leadId, { follow_up_step: 2 });
}

export async function markWarmLeadStep3Sent(leadId) {
  return markWarmLeadFollowUpStep(leadId, {
    follow_up_step: 3,
    status: "completed",
  });
}

async function markWarmLeadFollowUpStep(leadId, fields) {
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();
  const payload = { ...fields, last_emailed_at: now };

  const { error } = await supabase.from("warm_leads").update(payload).eq("id", leadId);

  if (error) {
    if (isMissingWarmLeadFollowUpColumns(error.message)) {
      throw new Error(
        "warm_leads follow-up columns missing. Run docs/supabase-warm-leads-follow-up.sql in Supabase."
      );
    }
    throw new Error(error.message || "Failed to update warm lead follow-up step.");
  }
}
