import { buildAuditPdf } from "./audit-pipeline.js";
import { sendDesignReadyEmail, sendFreeAuditEmail } from "./email.js";
import { generateCallScript } from "./call-script.js";
import { evaluateLeadSuitability, preflightLogCode } from "./preflight.js";
import { generateSiteRoast } from "./roast.js";
import { normalizeWebsiteUrl, scrapeWebsiteText } from "./scrape.js";
import { normalizeRootDomain } from "./url-utils.js";
import {
  DEFAULT_REDESIGN_MAX_TOKENS,
  listRedesignEngines,
  resolveRedesignEngine,
} from "./redesign-engines.js";
import {
  completeRedesign,
  deleteRedesignById,
  deleteAllRedesignsForDomain,
  fetchAllRedesignsForDomain,
  fetchAuditById,
  fetchRedesignNotificationInfo,
  fetchAuditDetailById,
  fetchRecentAudits,
  fetchRecentRedesigns,
  fetchRedesignById,
  fetchPreviousDesignExclusions,
  resetRedesignForRetry,
  findAuditByStripeSessionId,
  fetchWarmLeadById,
  fetchWarmLeads,
  insertPendingRedesign,
  insertRedesign,
  insertWarmLead,
  isSupabaseConfigured,
  markDesignEmailSent,
  markInitialEmailSent,
  markRedesignFailed,
  markRoastFailed,
  saveRoastBullets,
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

const MIN_REDESIGN_TOKENS = 4000;
const MAX_REDESIGN_TOKENS = 64000;

export async function listRedesigns(req) {
  requireSupabase();
  const limit = Number(req.query.limit) || 50;
  const redesigns = await fetchRecentRedesigns(limit);
  return { ok: true, redesigns, engines: listRedesignEngines() };
}

export async function deleteRedesign(req) {
  requireSupabase();

  const redesignId = String(req.params.id ?? "").trim();
  if (!redesignId) {
    const err = new Error("Redesign id is required.");
    err.statusCode = 400;
    throw err;
  }

  const result = await deleteRedesignById(redesignId);
  if (!result?.count) {
    const err = new Error("Redesign not found.");
    err.statusCode = 404;
    throw err;
  }

  console.log(
    `[admin] Deleted ${result.count} preview row(s) for ${result.root_domain ?? "unknown domain"}:`,
    result.deleted.map((row) => row.preview_token).join(", ")
  );

  return { ok: true, ...result };
}

export async function deleteRedesignsForDomain(req) {
  requireSupabase();

  const websiteUrl = String(req.body?.url ?? req.query?.url ?? "").trim();
  if (!websiteUrl) {
    const err = new Error("url is required.");
    err.statusCode = 400;
    throw err;
  }

  const rootDomain = normalizeRootDomain(websiteUrl);
  if (!rootDomain) {
    const err = new Error("Could not parse a valid domain from url.");
    err.statusCode = 400;
    throw err;
  }

  const result = await deleteAllRedesignsForDomain(rootDomain);

  console.log(
    `[admin] Domain wipe ${rootDomain}: removed ${result.count} preview row(s)`
  );

  return { ok: true, ...result };
}

export async function retryRedesign(req) {
  requireSupabase();

  const redesignId = String(req.params.id ?? "").trim();
  if (!redesignId) {
    const err = new Error("Redesign id is required.");
    err.statusCode = 400;
    throw err;
  }

  const existing = await fetchRedesignById(redesignId);
  if (!existing) {
    const err = new Error("Redesign not found.");
    err.statusCode = 404;
    throw err;
  }

  if (existing.status === "ready") {
    const err = new Error("This preview is already ready.");
    err.statusCode = 400;
    throw err;
  }

  const redesign = await resetRedesignForRetry(redesignId);
  const normalizedUrl = normalizeWebsiteUrl(
    normalizeRootDomain(existing.website_url) ?? existing.website_url
  );
  const engine = resolveRedesignEngine(existing.engine || "claude-opus");
  const maxTokens = existing.max_tokens || DEFAULT_REDESIGN_MAX_TOKENS;
  const logPrefix = `[admin-retry:${redesignId}]`;

  runPreviewPipelineRetry({
    redesignId,
    normalizedUrl,
    engine,
    maxTokens,
    logPrefix,
    roastStatus: existing.roast_status ?? "pending",
  });

  console.log(`${logPrefix} Queued preview retry for ${normalizedUrl}.`);

  return {
    ok: true,
    redesign,
    queued: true,
    preview_token: redesign.preview_token,
  };
}

/**
 * Order a redesign for a warm lead, a completed audit, or a manual URL.
 * Body: { source_type: 'warm_lead'|'audit'|'manual', source_id?, website_url?, engine, max_tokens? }
 */
export async function orderRedesign(req) {
  requireSupabase();

  const sourceType = String(req.body?.source_type ?? "manual").trim();
  const sourceId = req.body?.source_id?.trim() || null;
  const engine = resolveRedesignEngine(String(req.body?.engine ?? "").trim());

  const maxTokens = Math.min(
    Math.max(Number(req.body?.max_tokens) || DEFAULT_REDESIGN_MAX_TOKENS, MIN_REDESIGN_TOKENS),
    MAX_REDESIGN_TOKENS
  );

  let websiteUrl = String(req.body?.website_url ?? "").trim();
  let email = null;

  if (sourceType === "warm_lead") {
    if (!sourceId) {
      const err = new Error("source_id is required for warm_lead orders.");
      err.statusCode = 400;
      throw err;
    }
    const lead = await fetchWarmLeadById(sourceId);
    if (!lead.website?.trim()) {
      const err = new Error("This lead has no website URL.");
      err.statusCode = 400;
      throw err;
    }
    websiteUrl = lead.website;
    email = lead.email;
  } else if (sourceType === "audit") {
    if (!sourceId) {
      const err = new Error("source_id is required for audit orders.");
      err.statusCode = 400;
      throw err;
    }
    const audit = await fetchAuditById(sourceId);
    websiteUrl = audit.website_url;
    email = audit.email;
  } else if (sourceType !== "manual") {
    const err = new Error("source_type must be warm_lead, audit, or manual.");
    err.statusCode = 400;
    throw err;
  }

  if (!websiteUrl) {
    const err = new Error("website_url is required.");
    err.statusCode = 400;
    throw err;
  }

  // Canonicalize to the bare root domain first (same as /api/public-redesign)
  // so duplicate detection never misses on www/protocol/path differences.
  const rootDomain = normalizeRootDomain(websiteUrl);
  const normalizedUrl = normalizeWebsiteUrl(rootDomain ?? websiteUrl);
  const logPrefix = `[redesign-order:${sourceType}]`;

  // Preferred flow: insert a pending row first so the preview link (token)
  // exists immediately — the /preview/ page shows a wait screen until the
  // background generation fills in the html. Falls back to the original
  // synchronous flow if the wait-screen columns haven't been migrated yet
  // (docs/supabase-redesigns.sql).
  let pending = null;
  try {
    pending = await insertPendingRedesign({
      websiteUrl: normalizedUrl,
      email,
      sourceType,
      sourceId,
      engine: engine.id,
      model: engine.model,
      maxTokens,
    });
  } catch (error) {
    console.warn(
      `${logPrefix} Pending insert failed (${error.message}) — generating synchronously.`
    );
  }

  if (pending) {
    runPreviewGeneration({
      redesignId: pending.id,
      normalizedUrl,
      engine,
      maxTokens,
      logPrefix: `${logPrefix}:${pending.id}`,
    });
    return { ok: true, redesign: pending, queued: true };
  }

  const html = await generateRedesignFromUrl({
    normalizedUrl,
    engine,
    maxTokens,
    logPrefix,
  });

  const redesign = await insertRedesign({
    websiteUrl: normalizedUrl,
    email,
    sourceType,
    sourceId,
    engine: engine.id,
    model: engine.model,
    maxTokens,
    html: html.html,
    styleDirection: html.styleDirection,
    heroHeadline: html.heroHeadline,
    primaryAccentColor: html.primaryAccentColor,
  });

  return { ok: true, redesign };
}

async function rejectPreflight({
  redesignId,
  logPrefix,
  preflight,
  runRoast,
  runRedesign,
}) {
  const detail =
    preflight.pageCount != null
      ? `${preflight.reason} (${preflight.pageCount} pages, ${preflight.check ?? "unknown"})`
      : `${preflight.reason} (${preflight.check ?? "unknown"})`;

  const logCode = preflight.logCode ?? preflightLogCode(preflight);
  console.warn(`${logPrefix} [preflight] ${logCode}: ${detail}`);

  if (runRoast) {
    await markRoastFailed(redesignId).catch((markError) =>
      console.error(`${logPrefix} Could not mark roast failed:`, markError.message)
    );
  }
  if (runRedesign) {
    await markRedesignFailed(redesignId).catch((markError) =>
      console.error(`${logPrefix} Could not mark redesign failed:`, markError.message)
    );
  }
}

async function runPreflightGate(scraped, normalizedUrl, logPrefix) {
  const preflight = await evaluateLeadSuitability(scraped.textForAudit, normalizedUrl);

  if (!preflight.suitable) {
    return preflight;
  }

  console.log(
    `${logPrefix} [preflight] APPROVED: ${preflight.business_category ?? "unknown"}`
  );
  return preflight;
}

async function generateRedesignFromUrl({
  normalizedUrl,
  engine,
  maxTokens,
  logPrefix,
  redesignId,
  scraped: scrapedInput,
  skipPreflight = false,
}) {
  const scraped = scrapedInput ?? (await scrapeWebsiteText(normalizedUrl));

  if (!skipPreflight) {
    const preflight = await runPreflightGate(scraped, normalizedUrl, logPrefix);
    if (!preflight.suitable) {
      const err = new Error(`Preflight rejected: ${preflight.reason}`);
      err.code = "PREFLIGHT_REJECTED";
      err.preflight = preflight;
      throw err;
    }
  }

  const generationExclusions = await fetchPreviousDesignExclusions(normalizedUrl, {
    excludeRedesignId: redesignId,
  });

  if (
    generationExclusions.styleDirections.length ||
    generationExclusions.heroHeadlines.length ||
    generationExclusions.primaryAccentColors.length
  ) {
    console.log(
      `${logPrefix} Excluding prior designs — styles: [${generationExclusions.styleDirections.join(", ")}], headlines: ${generationExclusions.heroHeadlines.length}, accents: ${generationExclusions.primaryAccentColors.length}`
    );
  }

  console.log(
    `${logPrefix} Generating with ${engine.id} (${engine.model}, max_tokens ${maxTokens})...`
  );
  const started = Date.now();
  const result = await engine.generate(scraped, {
    model: engine.model,
    maxTokens,
    websiteUrl: normalizedUrl,
    generationExclusions,
  });
  console.log(
    `${logPrefix} Generated ${result.html.length} chars (${result.styleDirection}) in ${Math.round((Date.now() - started) / 1000)}s`
  );

  return result;
}

const PREVIEW_BASE_URL = "https://usetoolcrate.com/preview-view?t=";

/**
 * Phase 1: site-specific roast. Returns true when bullets were saved.
 */
export async function executeRoastGeneration({
  redesignId,
  normalizedUrl,
  logPrefix,
  scraped: scrapedInput,
}) {
  let lastError = null;

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      let scraped = scrapedInput;
      if (!scraped) {
        console.log(`${logPrefix} [roast] Attempt ${attempt}/2 — scraping ${normalizedUrl}...`);
        scraped = await scrapeWebsiteText(normalizedUrl);
      } else if (attempt === 1) {
        console.log(`${logPrefix} [roast] Attempt ${attempt}/2 — using shared scrape`);
      }
      console.log(
        `${logPrefix} [roast] Scrape OK (${scraped.scrapeSource}, ${scraped.charCount} chars)`
      );

      console.log(`${logPrefix} [roast] Generating site roast...`);
      const started = Date.now();
      const { roast_bullets } = await generateSiteRoast(scraped);
      await saveRoastBullets(redesignId, roast_bullets);
      console.log(
        `${logPrefix} [roast] Saved ${roast_bullets.length} bullets in ${Math.round((Date.now() - started) / 1000)}s`
      );
      return true;
    } catch (error) {
      lastError = error;
      scrapedInput = null;
      const phase = /scrape|access this website|blocking/i.test(error.message)
        ? "scrape"
        : "roast-ai";
      console.error(
        `${logPrefix} [roast] Attempt ${attempt}/2 failed (${phase}):`,
        error.message
      );
      if (error.stack) {
        console.error(error.stack.split("\n").slice(0, 4).join("\n"));
      }
      if (attempt < 2) {
        await new Promise((resolve) => setTimeout(resolve, 1200));
      }
    }
  }

  console.error(
    `${logPrefix} [roast] Giving up after 2 attempts:`,
    lastError?.message || "unknown error"
  );
  try {
    await markRoastFailed(redesignId);
  } catch (updateError) {
    console.error(`${logPrefix} [roast] Could not mark failed:`, updateError.message);
  }
  return false;
}

/** @deprecated Use runPreviewGeneration for sequential roast → redesign. */
export function runRoastGeneration({ redesignId, normalizedUrl, logPrefix }) {
  setImmediate(() => {
    executeRoastGeneration({ redesignId, normalizedUrl, logPrefix });
  });
}

async function executeRedesignGeneration({
  redesignId,
  normalizedUrl,
  engine,
  maxTokens,
  logPrefix,
  scraped,
  preflightComplete = false,
}) {
  try {
    const result = await generateRedesignFromUrl({
      normalizedUrl,
      engine,
      maxTokens,
      logPrefix,
      redesignId,
      scraped,
      skipPreflight: preflightComplete,
    });
    await completeRedesign(redesignId, result);
    console.log(`${logPrefix} Preview is live.`);
    await sendDesignReadyNotification(redesignId, logPrefix);
  } catch (error) {
    console.error(`${logPrefix} Background generation failed:`, error.message);
    try {
      await markRedesignFailed(redesignId);
    } catch (updateError) {
      console.error(`${logPrefix} Could not mark redesign failed:`, updateError.message);
    }
  }
}

/**
 * One scrape, then roast, then redesign — never two Opus streams at once.
 * Redesign still runs if roast fails (roast is best-effort for the wait screen).
 */
async function executePreviewPipeline({
  redesignId,
  normalizedUrl,
  engine,
  maxTokens,
  logPrefix,
  runRoast = true,
  runRedesign = true,
}) {
  console.log(
    `${logPrefix} Pipeline: sequential scrape → roast → redesign (single Opus job at a time)`
  );

  let scraped;
  try {
    console.log(`${logPrefix} Scraping ${normalizedUrl}...`);
    scraped = await scrapeWebsiteText(normalizedUrl);
    console.log(
      `${logPrefix} Scrape OK (${scraped.scrapeSource}, ${scraped.charCount} chars, ${scraped.imageUrls?.length ?? 0} images)`
    );
  } catch (error) {
    console.error(`${logPrefix} Scrape failed — cannot continue:`, error.message);
    if (runRoast) {
      await markRoastFailed(redesignId).catch((markError) =>
        console.error(`${logPrefix} Could not mark roast failed:`, markError.message)
      );
    }
    if (runRedesign) {
      await markRedesignFailed(redesignId).catch((markError) =>
        console.error(`${logPrefix} Could not mark redesign failed:`, markError.message)
      );
    }
    return;
  }

  const preflight = await runPreflightGate(scraped, normalizedUrl, logPrefix);
  if (!preflight.suitable) {
    await rejectPreflight({
      redesignId,
      logPrefix,
      preflight,
      runRoast,
      runRedesign,
    });
    return;
  }

  if (runRoast) {
    await executeRoastGeneration({
      redesignId,
      normalizedUrl,
      logPrefix,
      scraped,
    });
  }

  if (runRedesign) {
    await executeRedesignGeneration({
      redesignId,
      normalizedUrl,
      engine,
      maxTokens,
      logPrefix,
      scraped,
      preflightComplete: true,
    });
  }
}

/**
 * Sequential preview pipeline: Phase 1 roast, then Phase 2 redesign.
 */
export function runPreviewGeneration({
  redesignId,
  normalizedUrl,
  engine,
  maxTokens,
  logPrefix,
}) {
  setImmediate(() =>
    executePreviewPipeline({
      redesignId,
      normalizedUrl,
      engine,
      maxTokens,
      logPrefix,
      runRoast: true,
      runRedesign: true,
    })
  );
}

export function runPreviewPipelineRetry({
  redesignId,
  normalizedUrl,
  engine,
  maxTokens,
  logPrefix,
  roastStatus,
}) {
  const runRoast = roastStatus === "failed" || roastStatus === "pending";
  setImmediate(() =>
    executePreviewPipeline({
      redesignId,
      normalizedUrl,
      engine,
      maxTokens,
      logPrefix,
      runRoast,
      runRedesign: true,
    })
  );
}

export function runRedesignGeneration({ redesignId, normalizedUrl, engine, maxTokens, logPrefix }) {
  setImmediate(() =>
    executeRedesignGeneration({ redesignId, normalizedUrl, engine, maxTokens, logPrefix })
  );
}

/**
 * Notify the prospect that their preview is live. Fires for every completed
 * design that has an email on the record; the design_email_sent flag prevents
 * duplicates on retries. Failures are logged, never thrown — a missed email
 * must not mark the redesign as failed.
 */
async function sendDesignReadyNotification(redesignId, logPrefix) {
  try {
    const info = await fetchRedesignNotificationInfo(redesignId);

    if (!info?.email) {
      return; // No address on the record — skip silently.
    }
    if (info.design_email_sent === true) {
      console.log(`${logPrefix} Design-ready email already sent — skipping.`);
      return;
    }
    if (info.design_email_sent === null) {
      console.warn(
        `${logPrefix} design_email_sent column missing — skipping email. Run docs/supabase-redesigns.sql in Supabase.`
      );
      return;
    }

    const previewUrl = `${PREVIEW_BASE_URL}${encodeURIComponent(info.preview_token)}`;
    const roastBullets =
      (info.roast_status === "roast_ready" || info.roast_status === "ready") &&
      Array.isArray(info.roast_bullets)
        ? info.roast_bullets
        : null;

    await sendDesignReadyEmail({
      customerEmail: info.email,
      previewUrl,
      websiteUrl: info.website_url,
      roastBullets,
      firstName: info.first_name,
    });
    await markDesignEmailSent(redesignId);
    console.log(`${logPrefix} Design-ready email sent to ${info.email}.`);
  } catch (error) {
    console.error(`${logPrefix} Design-ready email failed:`, error.message);
  }
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
  app.get("/api/admin/redesigns", guard(listRedesigns));
  app.post("/api/admin/redesigns", guard(orderRedesign));
  app.delete("/api/admin/redesigns/by-domain", guard(deleteRedesignsForDomain));
  app.post("/api/admin/redesigns/:id/retry", guard(retryRedesign));
  app.delete("/api/admin/redesigns/:id", guard(deleteRedesign));
}
