import { apiUrl, normalizeClientError } from "../scripts/api-config.js";

const SECRET_KEY = "toolcrate_admin_secret";

const secretInput = document.getElementById("cron-secret");
const saveSecretBtn = document.getElementById("save-secret");
const authStatus = document.getElementById("auth-status");
const previewEmail = document.getElementById("preview-email");
const previewAudit = document.getElementById("preview-audit");
const sendPreviewAllBtn = document.getElementById("send-preview-all");
const previewStatus = document.getElementById("preview-status");
const refreshBtn = document.getElementById("refresh-audits");
const refreshWarmLeadsBtn = document.getElementById("refresh-warm-leads");
const addWarmLeadToggleBtn = document.getElementById("add-warm-lead-toggle");
const addWarmLeadForm = document.getElementById("add-warm-lead-form");
const addWarmLeadCancelBtn = document.getElementById("add-warm-lead-cancel");
const addWarmLeadSubmitBtn = document.getElementById("add-warm-lead-submit");
const newLeadEmail = document.getElementById("new-lead-email");
const newLeadWebsite = document.getElementById("new-lead-website");
const newLeadReply = document.getElementById("new-lead-reply");
const warmLeadsStatus = document.getElementById("warm-leads-status");
const warmLeadsTableWrap = document.getElementById("warm-leads-table-wrap");
const warmLeadsBody = document.getElementById("warm-leads-body");
const auditsStatus = document.getElementById("audits-status");
const auditsTableWrap = document.getElementById("audits-table-wrap");
const auditsBody = document.getElementById("audits-body");
const auditDetail = document.getElementById("audit-detail");
const closeDetailBtn = document.getElementById("close-detail");
const detailTitle = document.getElementById("detail-title");
const detailMeta = document.getElementById("detail-meta");
const detailScores = document.getElementById("detail-scores");
const generateScriptBtn = document.getElementById("generate-script-btn");
const regenerateScriptBtn = document.getElementById("regenerate-script-btn");
const cancelScriptBtn = document.getElementById("cancel-script-btn");
const scriptStatus = document.getElementById("script-status");
const scriptIdle = document.getElementById("script-idle");
const scriptLoading = document.getElementById("script-loading");
const scriptLoadingText = document.getElementById("script-loading-text");
const scriptOutput = document.getElementById("script-output");

const resetRateLimitBtn = document.getElementById("reset-rate-limit");
const rateLimitStatus = document.getElementById("rate-limit-status");
const refreshRedesignsBtn = document.getElementById("refresh-redesigns");
const redesignEngineSelect = document.getElementById("redesign-engine");
const redesignMaxTokensInput = document.getElementById("redesign-max-tokens");
const redesignManualUrlInput = document.getElementById("redesign-manual-url");
const orderRedesignManualBtn = document.getElementById("order-redesign-manual");
const clearRedesignDomainBtn = document.getElementById("clear-redesign-domain");
const redesignsStatus = document.getElementById("redesigns-status");
const redesignsTableWrap = document.getElementById("redesigns-table-wrap");
const redesignsBody = document.getElementById("redesigns-body");

const SCRIPT_GENERATE_TIMEOUT_MS = 120000;
const AUDIT_SEND_TIMEOUT_MS = 180000;
const REDESIGN_ORDER_TIMEOUT_MS = 360000;
const OPEN_DETAIL_GUARD_MS = 400;

let auditsCache = [];
let warmLeadsCache = [];
let redesignsCache = [];
let orderingRedesign = false;
let sendingAuditLeadId = null;
let selectedAuditId = null;
let selectedAuditDetail = null;
let scriptGenerationInFlight = false;
let scriptAbortController = null;

function serverConfigHint(errorMessage) {
  if (/CRON_SECRET is not configured on the server/i.test(errorMessage)) {
    return "The production API on Render does not have CRON_SECRET set. Render Dashboard → toolcrate-backend → Environment → add CRON_SECRET (same value as your local .env), then Save. Wait ~1 min and click Refresh.";
  }
  if (/Supabase is not configured/i.test(errorMessage)) {
    return "Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to Render Environment, then Save and Refresh.";
  }
  return normalizeClientError(errorMessage);
}

function getSecret() {
  return (
    // Session token from the email+password login on /invoices — one login
    // unlocks both admin pages.
    localStorage.getItem("toolcrate_admin_token") ||
    sessionStorage.getItem(SECRET_KEY) ||
    secretInput.value.trim()
  );
}

function saveSecret() {
  const value = secretInput.value.trim();
  if (!value) {
    setAuthStatus("Enter your CRON_SECRET first.", true);
    return;
  }
  sessionStorage.setItem(SECRET_KEY, value);
  setAuthStatus("Secret saved for this browser session.", false);
  loadAudits();
  loadWarmLeads();
}

function setAuthStatus(message, isError) {
  authStatus.hidden = false;
  authStatus.textContent = message;
  authStatus.classList.toggle("admin-status--error", isError);
}

function setStatus(el, message, isError = false) {
  el.hidden = false;
  el.textContent = message;
  el.classList.toggle("admin-status--error", isError);
  el.classList.toggle("admin-status--ok", !isError && Boolean(message));
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderScriptMarkdown(text) {
  const lines = String(text).split("\n");
  const parts = [];

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      parts.push("<br>");
      continue;
    }

    if (trimmed.startsWith("## ")) {
      parts.push(`<h3>${escapeHtml(trimmed.slice(3))}</h3>`);
      continue;
    }

    if (trimmed.startsWith("### ")) {
      parts.push(`<h4>${escapeHtml(trimmed.slice(4))}</h4>`);
      continue;
    }

    const withBold = escapeHtml(trimmed).replace(
      /\*\*(.+?)\*\*/g,
      "<strong>$1</strong>"
    );
    parts.push(`<p>${withBold}</p>`);
  }

  return parts.join("\n");
}

async function adminFetch(path, options = {}) {
  const secret = getSecret();
  if (!secret) {
    throw new Error("Enter and save your admin secret (CRON_SECRET).");
  }

  const { timeoutMs = 30000, signal, ...fetchOptions } = options;

  const headers = {
    Authorization: `Bearer ${secret}`,
    ...(fetchOptions.body ? { "Content-Type": "application/json" } : {}),
    ...fetchOptions.headers,
  };

  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => timeoutController.abort(), timeoutMs);

  const onAbort = () => timeoutController.abort();
  signal?.addEventListener("abort", onAbort);

  let response;

  try {
    response = await fetch(apiUrl(path), {
      ...fetchOptions,
      headers,
      signal: timeoutController.signal,
    });
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error(
        signal?.aborted
          ? "Request cancelled."
          : "Request timed out. OpenAI may be slow — try again in a moment."
      );
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
    signal?.removeEventListener("abort", onAbort);
  }
  let data;

  try {
    data = await response.json();
  } catch {
    throw new Error("Server returned an unexpected response.");
  }

  if (!response.ok || !data.ok) {
    throw new Error(data.error || `Request failed (${response.status}).`);
  }

  return data;
}

function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function sentBadge(sent) {
  return sent
    ? '<span class="badge badge--sent">Sent</span>'
    : '<span class="badge badge--pending">Pending</span>';
}

function scriptBadge(audit) {
  return audit.call_script_generated_at
    ? '<span class="badge badge--sent">Ready</span>'
    : '<span class="badge badge--pending">—</span>';
}

function warmLeadStatusBadge(lead) {
  if (typeof lead === "string") {
    if (lead === "completed") {
      return '<span class="badge badge--sent">Completed</span>';
    }
    if (lead === "audit_sent") {
      return '<span class="badge badge--sent">Audit sent</span>';
    }
    return '<span class="badge badge--pending">Pending</span>';
  }

  if (lead.status === "completed") {
    return '<span class="badge badge--sent">Completed</span>';
  }
  if (lead.status === "audit_sent") {
    if (lead.follow_up_step >= 3) {
      return '<span class="badge badge--sent">Completed</span>';
    }
    if (lead.follow_up_step === 2) {
      return '<span class="badge badge--sent">Follow-up 1 sent</span>';
    }
    return '<span class="badge badge--sent">Audit sent</span>';
  }
  return '<span class="badge badge--pending">Pending</span>';
}

function truncateReply(text, max = 120) {
  if (!text) return "—";
  const trimmed = String(text).trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max)}…`;
}

function populatePreviewSelect(audits) {
  const current = previewAudit.value;
  previewAudit.innerHTML =
    '<option value="">Latest audit (or sample URL)</option>' +
    audits
      .map(
        (a) =>
          `<option value="${a.id}">${a.website_url} — ${a.email}</option>`
      )
      .join("");

  if (current) {
    previewAudit.value = current;
  }
}

function renderAudits(audits) {
  auditsCache = audits;
  populatePreviewSelect(audits);

  if (!audits.length) {
    auditsTableWrap.hidden = true;
    setStatus(auditsStatus, "No audits in Supabase yet.", false);
    return;
  }

  auditsBody.innerHTML = audits
    .map(
      (audit) => `
        <tr data-id="${audit.id}" class="${selectedAuditId === audit.id ? "is-selected" : ""}">
          <td class="cell-url">
            <button type="button" class="btn-link" data-action="open">${escapeHtml(audit.website_url)}</button>
          </td>
          <td>${escapeHtml(audit.email)}</td>
          <td>${formatDate(audit.created_at)}</td>
          <td>${scriptBadge(audit)}</td>
          <td>${sentBadge(audit.day_2_sent)}</td>
          <td>${sentBadge(audit.day_4_sent)}</td>
          <td>${sentBadge(audit.day_7_sent)}</td>
          <td class="cell-actions">
            <button type="button" class="btn btn-small" data-action="open">View</button>
            <button type="button" class="btn btn-small" data-action="order-redesign">Order redesign</button>
            <button type="button" class="btn btn-small btn-danger" data-action="delete">Delete</button>
            <button type="button" class="btn btn-small" data-action="preview" data-day="2">Preview D2</button>
            <button type="button" class="btn btn-small" data-action="preview" data-day="4">Preview D4</button>
            <button type="button" class="btn btn-small" data-action="preview" data-day="7">Preview D7</button>
            <button type="button" class="btn btn-small btn-primary" data-action="send" data-day="2" ${
              audit.day_2_sent ? "disabled" : ""
            }>Send D2</button>
            <button type="button" class="btn btn-small btn-primary" data-action="send" data-day="4" ${
              audit.day_4_sent ? "disabled" : ""
            }>Send D4</button>
            <button type="button" class="btn btn-small btn-primary" data-action="send" data-day="7" ${
              audit.day_7_sent ? "disabled" : ""
            }>Send D7</button>
          </td>
        </tr>`
    )
    .join("");

  auditsTableWrap.hidden = false;
  setStatus(auditsStatus, `${audits.length} audit(s) loaded.`, false);
}

function renderWarmLeads(leads) {
  warmLeadsCache = leads;

  if (!leads.length) {
    warmLeadsTableWrap.hidden = true;
    setStatus(warmLeadsStatus, "No warm leads yet.", false);
    return;
  }

  warmLeadsBody.innerHTML = leads
    .map((lead) => {
      const isSending = sendingAuditLeadId === lead.id;
      const canSend = lead.status === "pending" && lead.website?.trim();
      const canSync =
        (lead.status === "audit_sent" || lead.status === "completed") &&
        lead.website?.trim();
      const sendLabel = isSending ? "Generating…" : "Generate & Send Free Audit";

      return `
        <tr data-lead-id="${lead.id}">
          <td>${escapeHtml(lead.email)}</td>
          <td class="cell-url">${lead.website ? escapeHtml(lead.website) : '<span class="admin-muted">—</span>'}</td>
          <td class="cell-reply" title="${escapeHtml(lead.reply_text || "")}">${escapeHtml(truncateReply(lead.reply_text))}</td>
          <td>${warmLeadStatusBadge(lead)}</td>
          <td>${formatDate(lead.created_at)}</td>
          <td class="cell-actions">
            <button
              type="button"
              class="btn btn-small btn-primary"
              data-action="send-audit"
              ${!canSend || isSending ? "disabled" : ""}
            >${sendLabel}</button>
            ${
              canSync
                ? `<button type="button" class="btn btn-small" data-action="sync-audit">Add to audits list</button>`
                : ""
            }
            ${
              lead.website?.trim()
                ? `<button type="button" class="btn btn-small" data-action="order-redesign">Order redesign</button>`
                : ""
            }
          </td>
        </tr>`;
    })
    .join("");

  warmLeadsTableWrap.hidden = false;
  setStatus(warmLeadsStatus, `${leads.length} warm lead(s) loaded.`, false);
}

function rootDomainFromUrl(url) {
  const trimmed = String(url || "").trim().toLowerCase();
  if (!trimmed) return null;

  const withProtocol = /^[a-z][a-z0-9+.-]*:\/\//.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  try {
    const { hostname } = new URL(withProtocol);
    const domain = hostname.replace(/^www\./, "").replace(/\.+$/, "");
    return domain || null;
  } catch {
    return null;
  }
}

function removeRedesignsForDomainFromCache(websiteUrl) {
  const rootDomain = rootDomainFromUrl(websiteUrl);
  if (!rootDomain) return;

  redesignsCache = redesignsCache.filter(
    (item) => rootDomainFromUrl(item.website_url) !== rootDomain
  );
  renderRedesigns(redesignsCache);
}

function previewLinkFor(redesign) {
  return new URL(
    `../preview-view/?t=${encodeURIComponent(redesign.preview_token)}`,
    window.location.href
  ).toString();
}

const ENGINE_LABELS = {
  "claude-sonnet": "Claude Sonnet 5",
  "claude-opus": "Claude Sonnet 5",
  "gpt-4o": "Claude Sonnet 5",
};

function blueprintLeadBadge(item) {
  const intent = String(item.lead_intent ?? "");
  if (intent.includes("TYPE:SITE_AUDIT")) {
    return '<span class="admin-badge admin-badge--audit">Site Audit</span>';
  }
  if (intent.includes("TYPE:VISION_CONCEPT") || String(item.website_url ?? "").startsWith("blueprint://")) {
    return '<span class="admin-badge admin-badge--vision">Vision Concept</span>';
  }
  return "";
}

function renderRedesigns(redesigns) {
  redesignsCache = redesigns;

  if (!redesigns.length) {
    redesignsTableWrap.hidden = true;
    setStatus(redesignsStatus, "No redesigns ordered yet.", false);
    return;
  }

  redesignsBody.innerHTML = redesigns
    .map(
      (item) => `
        <tr data-redesign-id="${item.id}">
          <td class="cell-url">
            ${blueprintLeadBadge(item)}
            ${escapeHtml(item.website_url)}
          </td>
          <td>${item.email ? escapeHtml(item.email) : '<span class="admin-muted">—</span>'}</td>
          <td>${escapeHtml(ENGINE_LABELS[item.engine] || item.engine)}</td>
          <td>${escapeHtml(item.status || "ready")}</td>
          <td>${formatDate(item.created_at)}</td>
          <td class="cell-actions">
            <a class="btn btn-small" href="${previewLinkFor(item)}" target="_blank" rel="noopener">Open preview</a>
            <button type="button" class="btn btn-small" data-action="copy-preview">Copy link</button>
            ${
              item.status === "failed" || item.status === "pending"
                ? '<button type="button" class="btn btn-small" data-action="retry-redesign">Retry</button>'
                : ""
            }
            <button type="button" class="btn btn-small btn-danger" data-action="delete-redesign">Delete</button>
          </td>
        </tr>`
    )
    .join("");

  redesignsTableWrap.hidden = false;
  setStatus(redesignsStatus, `${redesigns.length} redesign(s) loaded.`, false);
}

async function loadRedesigns() {
  setStatus(redesignsStatus, "Loading…", false);
  redesignsTableWrap.hidden = true;

  try {
    const data = await adminFetch("/api/admin/redesigns?limit=50");
    renderRedesigns(data.redesigns);
  } catch (error) {
    setStatus(redesignsStatus, serverConfigHint(error.message), true);
  }
}

function redesignSettings() {
  return {
    engine: redesignEngineSelect.value,
    max_tokens: Number(redesignMaxTokensInput.value) || 32000,
  };
}

async function orderRedesign({ sourceType, sourceId = null, websiteUrl = null, label }) {
  if (orderingRedesign) return;

  const { engine, max_tokens } = redesignSettings();
  const engineLabel = ENGINE_LABELS[engine] || engine;

  const confirmed = confirm(
    `Order an HTML redesign for ${label}?\n\nAgent: ${engineLabel}\nMax tokens: ${max_tokens}\n\nThis takes 30 seconds – 3 minutes depending on the agent.`
  );
  if (!confirmed) return;

  orderingRedesign = true;
  setStatus(redesignsStatus, `Generating redesign for ${label} with ${engineLabel}…`, false);

  try {
    const data = await adminFetch("/api/admin/redesigns", {
      method: "POST",
      body: JSON.stringify({
        source_type: sourceType,
        source_id: sourceId,
        website_url: websiteUrl,
        engine,
        max_tokens,
      }),
      timeoutMs: REDESIGN_ORDER_TIMEOUT_MS,
    });

    redesignsCache = [data.redesign, ...redesignsCache];
    renderRedesigns(redesignsCache);

    const link = previewLinkFor(data.redesign);
    setStatus(
      redesignsStatus,
      data.queued
        ? `Redesign queued — link is live now (wait screen until ready): ${link}`
        : `Redesign ready — preview: ${link}`,
      false
    );
    window.open(link, "_blank", "noopener");
  } catch (error) {
    setStatus(redesignsStatus, serverConfigHint(error.message), true);
  } finally {
    orderingRedesign = false;
  }
}

async function handleRedesignsTableClick(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  const row = button.closest("tr[data-redesign-id]");
  const redesign = redesignsCache.find((item) => item.id === row?.dataset.redesignId);
  if (!redesign) return;

  if (button.dataset.action === "copy-preview") {
    try {
      await navigator.clipboard.writeText(previewLinkFor(redesign));
      setStatus(redesignsStatus, "Preview link copied to clipboard.", false);
    } catch {
      setStatus(redesignsStatus, `Copy failed — link: ${previewLinkFor(redesign)}`, true);
    }
    return;
  }

  if (button.dataset.action === "retry-redesign") {
    const confirmed = confirm(
      `Retry redesign for ${redesign.website_url}?\n\nRoast bullets are kept. Only the HTML preview will regenerate (~2-3 min).`
    );
    if (!confirmed) return;

    button.disabled = true;
    setStatus(redesignsStatus, "Queuing redesign retry…", false);

    try {
      const data = await adminFetch(
        `/api/admin/redesigns/${encodeURIComponent(redesign.id)}/retry`,
        { method: "POST" }
      );
      const idx = redesignsCache.findIndex((item) => item.id === redesign.id);
      if (idx >= 0) {
        redesignsCache[idx] = { ...redesignsCache[idx], status: "pending" };
        renderRedesigns(redesignsCache);
      }
      setStatus(
        redesignsStatus,
        `Retry queued for ${redesign.website_url}. Same preview link still works.`,
        false
      );
    } catch (error) {
      button.disabled = false;
      setStatus(redesignsStatus, serverConfigHint(error.message), true);
    }
    return;
  }

  if (button.dataset.action === "delete-redesign") {
    const rootDomain = rootDomainFromUrl(redesign.website_url);
    const siblingCount = redesignsCache.filter(
      (item) => rootDomainFromUrl(item.website_url) === rootDomain
    ).length;

    const confirmed = confirm(
      `Delete all preview data for ${redesign.website_url}?\n\n` +
        `This removes ${siblingCount} preview row(s) for ${rootDomain} — including HTML, roast bullets, tokens, and wait-screen answers. ` +
        `The domain will be free for /try again.\n\nThis cannot be undone.`
    );
    if (!confirmed) return;

    button.disabled = true;
    setStatus(redesignsStatus, "Deleting…", false);

    try {
      const data = await adminFetch(`/api/admin/redesigns/${encodeURIComponent(redesign.id)}`, {
        method: "DELETE",
      });
      removeRedesignsForDomainFromCache(redesign.website_url);
      setStatus(
        redesignsStatus,
        `Deleted ${data.count} preview row(s) for ${data.root_domain ?? rootDomain} — domain is free for /try again.`,
        false
      );
    } catch (error) {
      button.disabled = false;
      setStatus(redesignsStatus, serverConfigHint(error.message), true);
    }
  }
}

async function loadWarmLeads() {
  setStatus(warmLeadsStatus, "Loading…", false);
  warmLeadsTableWrap.hidden = true;

  try {
    const data = await adminFetch("/api/admin/warm-leads?limit=50");
    renderWarmLeads(data.leads);
  } catch (error) {
    setStatus(warmLeadsStatus, serverConfigHint(error.message), true);
  }
}

function toggleAddWarmLeadForm(show) {
  const shouldShow = show ?? addWarmLeadForm.hidden;
  addWarmLeadForm.hidden = !shouldShow;
  addWarmLeadToggleBtn.textContent = shouldShow ? "Hide form" : "Add warm lead";

  if (shouldShow) {
    newLeadEmail.focus();
  }
}

function resetAddWarmLeadForm() {
  addWarmLeadForm.reset();
}

async function submitWarmLead(event) {
  event.preventDefault();

  const email = newLeadEmail.value.trim();
  const website = newLeadWebsite.value.trim();
  const reply_text = newLeadReply.value.trim();

  if (!email) {
    setStatus(warmLeadsStatus, "Email is required.", true);
    return;
  }

  addWarmLeadSubmitBtn.disabled = true;
  setStatus(warmLeadsStatus, "Saving lead…", false);

  try {
    const data = await adminFetch("/api/admin/warm-leads", {
      method: "POST",
      body: JSON.stringify({
        email,
        website: website || null,
        reply_text: reply_text || null,
      }),
    });

    warmLeadsCache = [data.lead, ...warmLeadsCache.filter((lead) => lead.id !== data.lead.id)];
    renderWarmLeads(warmLeadsCache);
    resetAddWarmLeadForm();
    toggleAddWarmLeadForm(false);
    setStatus(warmLeadsStatus, `Added ${data.lead.email}.`, false);
  } catch (error) {
    setStatus(warmLeadsStatus, serverConfigHint(error.message), true);
  } finally {
    addWarmLeadSubmitBtn.disabled = false;
  }
}

async function sendFreeAuditForLead(leadId) {
  const lead = warmLeadsCache.find((item) => item.id === leadId);
  if (!lead || sendingAuditLeadId) return;

  if (!lead.website?.trim()) {
    setStatus(warmLeadsStatus, "This lead has no website URL in Instantly.", true);
    return;
  }

  const confirmed = confirm(
    `Generate audit PDF for ${lead.website} and email it to ${lead.email}?\n\nThis takes 30–90 seconds.`
  );
  if (!confirmed) return;

  sendingAuditLeadId = leadId;
  renderWarmLeads(warmLeadsCache);
  setStatus(warmLeadsStatus, `Generating audit for ${lead.website}…`, false);

  try {
    const data = await adminFetch("/api/admin/send-free-audit", {
      method: "POST",
      body: JSON.stringify({ lead_id: leadId }),
      timeoutMs: AUDIT_SEND_TIMEOUT_MS,
    });

    lead.status = data.status || "audit_sent";
    lead.website = data.website || lead.website;
    setStatus(
      warmLeadsStatus,
      `Free audit sent to ${data.email} (${data.website}).`,
      false
    );
    await loadAudits();
  } catch (error) {
    setStatus(warmLeadsStatus, serverConfigHint(error.message), true);
  } finally {
    sendingAuditLeadId = null;
    renderWarmLeads(warmLeadsCache);
  }
}

async function syncWarmLeadToAudits(leadId) {
  const lead = warmLeadsCache.find((item) => item.id === leadId);
  if (!lead || sendingAuditLeadId) return;

  sendingAuditLeadId = leadId;
  renderWarmLeads(warmLeadsCache);
  setStatus(warmLeadsStatus, `Adding ${lead.website} to Recent audits…`, false);

  try {
    const data = await adminFetch(`/api/admin/warm-leads/${leadId}/sync-audit`, {
      method: "POST",
      body: JSON.stringify({ lead_id: leadId }),
      timeoutMs: AUDIT_SEND_TIMEOUT_MS,
    });

    setStatus(warmLeadsStatus, data.message, false);
    await loadAudits();
  } catch (error) {
    setStatus(warmLeadsStatus, serverConfigHint(error.message), true);
  } finally {
    sendingAuditLeadId = null;
    renderWarmLeads(warmLeadsCache);
  }
}

async function handleWarmLeadsTableClick(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  const row = button.closest("tr[data-lead-id]");
  const leadId = row?.dataset.leadId;
  if (!leadId) return;

  if (button.dataset.action === "send-audit") {
    await sendFreeAuditForLead(leadId);
    return;
  }

  if (button.dataset.action === "sync-audit") {
    await syncWarmLeadToAudits(leadId);
    return;
  }

  if (button.dataset.action === "order-redesign") {
    const lead = warmLeadsCache.find((item) => item.id === leadId);
    if (!lead?.website?.trim()) return;

    button.disabled = true;
    try {
      await orderRedesign({
        sourceType: "warm_lead",
        sourceId: leadId,
        label: lead.website,
      });
    } finally {
      button.disabled = false;
    }
  }
}

function renderScoreCards(report) {
  if (!report) {
    detailScores.hidden = true;
    return;
  }

  const categories = [
    ["SEO", report.seo],
    ["Lead capture", report.leadCapture],
    ["Mobile", report.mobile],
    ["Trust", report.trust],
    ["Messaging", report.messaging],
    ["Performance", report.performance],
    ["Security", report.security],
  ].filter(([, data]) => data?.score != null);

  if (!categories.length) {
    detailScores.hidden = true;
    return;
  }

  detailScores.innerHTML = categories
    .map(
      ([label, data]) => `
        <div class="score-card">
          <span class="score-card-label">${label}</span>
          <span class="score-card-value">${data.score}/10</span>
        </div>`
    )
    .join("");

  detailScores.hidden = false;
}

/** @param {"idle"|"loading"|"ready"|"hidden"} state */
function setScriptUiState(state) {
  const isLoading = state === "loading";
  const isReady = state === "ready";
  const isIdle = state === "idle";

  scriptLoading.hidden = !isLoading;
  scriptOutput.hidden = !isReady;
  scriptIdle.hidden = !(isIdle);
  cancelScriptBtn.hidden = !isLoading;
  regenerateScriptBtn.hidden = !isReady;
}

function showScript(script, { cached = false, generatedAt = null } = {}) {
  scriptOutput.innerHTML = renderScriptMarkdown(script);
  setScriptUiState("ready");

  if (cached && generatedAt) {
    setStatus(
      scriptStatus,
      `Loaded saved script from ${formatDate(generatedAt)}.`,
      false
    );
  } else if (generatedAt) {
    setStatus(scriptStatus, `Script generated and saved (${formatDate(generatedAt)}).`, false);
  } else {
    scriptStatus.hidden = true;
  }
}

function clearScriptDisplay({ showIdle = true } = {}) {
  scriptOutput.innerHTML = "";
  scriptStatus.hidden = true;
  setScriptUiState(showIdle ? "idle" : "hidden");
}

function renderAuditDetail(audit) {
  selectedAuditDetail = audit;
  detailTitle.textContent = audit.website_url;

  detailMeta.innerHTML = `
    <div><dt>Email</dt><dd>${escapeHtml(audit.email)}</dd></div>
    <div><dt>Created</dt><dd>${formatDate(audit.created_at)}</dd></div>
    <div><dt>Nurture</dt><dd>Day 2 ${audit.day_2_sent ? "✓" : "—"} · Day 4 ${audit.day_4_sent ? "✓" : "—"} · Day 7 ${audit.day_7_sent ? "✓" : "—"}</dd></div>
  `;

  renderScoreCards(audit.report);
  clearScriptDisplay({ showIdle: !audit.call_script?.trim() });

  if (audit.call_script?.trim()) {
    showScript(audit.call_script, {
      cached: true,
      generatedAt: audit.call_script_generated_at,
    });
  }
}

function cancelScriptGeneration() {
  scriptAbortController?.abort();
  scriptAbortController = null;
  scriptGenerationInFlight = false;
  generateScriptBtn.disabled = false;
  regenerateScriptBtn.disabled = false;
  setStatus(scriptStatus, "Generation cancelled.", false);

  if (scriptOutput.innerHTML.trim()) {
    setScriptUiState("ready");
  } else {
    setScriptUiState("idle");
  }
}

async function openAuditDetail(auditId) {
  cancelScriptGeneration();
  selectedAuditId = auditId;
  auditDetail.hidden = false;
  clearScriptDisplay({ showIdle: false });
  setStatus(scriptStatus, "Loading audit details…", false);
  generateScriptBtn.disabled = true;
  regenerateScriptBtn.disabled = true;

  try {
    const data = await adminFetch(`/api/admin/audits/${auditId}`, {
      timeoutMs: 30000,
    });
    renderAuditDetail(data.audit);

    const row = auditsCache.find((a) => a.id === auditId);
    if (row && data.audit.call_script_generated_at) {
      row.call_script_generated_at = data.audit.call_script_generated_at;
      renderAudits(auditsCache);
    }
  } catch (error) {
    setStatus(scriptStatus, normalizeClientError(error.message), true);
  } finally {
    scriptStatus.hidden = false;
    setTimeout(() => {
      generateScriptBtn.disabled = false;
      if (selectedAuditDetail?.call_script?.trim()) {
        regenerateScriptBtn.hidden = false;
        regenerateScriptBtn.disabled = false;
      }
    }, OPEN_DETAIL_GUARD_MS);
  }

  requestAnimationFrame(() => {
    auditDetail.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

function closeAuditDetail() {
  cancelScriptGeneration();
  selectedAuditId = null;
  selectedAuditDetail = null;
  auditDetail.hidden = true;
  renderAudits(auditsCache);
}

async function generateCallScriptForAudit({ force = false } = {}) {
  if (!selectedAuditId || scriptGenerationInFlight) return;

  scriptGenerationInFlight = true;
  scriptAbortController = new AbortController();

  generateScriptBtn.disabled = true;
  regenerateScriptBtn.disabled = true;
  setScriptUiState("loading");
  scriptLoadingText.textContent = force
    ? "Regenerating call script (20–40 sec)…"
    : "Generating call script (20–40 sec)…";
  setStatus(
    scriptStatus,
    "Talking to OpenAI — please wait…",
    false
  );

  try {
    const data = await adminFetch(
      `/api/admin/audits/${selectedAuditId}/generate-script`,
      {
        method: "POST",
        body: JSON.stringify({ force }),
        signal: scriptAbortController.signal,
        timeoutMs: SCRIPT_GENERATE_TIMEOUT_MS,
      }
    );

    showScript(data.script, {
      cached: data.cached,
      generatedAt: data.call_script_generated_at,
    });

    if (selectedAuditDetail) {
      selectedAuditDetail.call_script = data.script;
      selectedAuditDetail.call_script_generated_at = data.call_script_generated_at;
    }

    const row = auditsCache.find((a) => a.id === selectedAuditId);
    if (row) {
      row.call_script_generated_at = data.call_script_generated_at;
      renderAudits(auditsCache);
    }
  } catch (error) {
    setStatus(scriptStatus, normalizeClientError(error.message), true);
    if (scriptOutput.innerHTML.trim()) {
      setScriptUiState("ready");
    } else {
      setScriptUiState("idle");
    }
  } finally {
    scriptGenerationInFlight = false;
    scriptAbortController = null;
    generateScriptBtn.disabled = false;
    regenerateScriptBtn.disabled = false;
  }
}

async function loadAudits() {
  setStatus(auditsStatus, "Loading…", false);
  auditsTableWrap.hidden = true;

  try {
    const data = await adminFetch("/api/admin/audits?limit=50");
    renderAudits(data.audits);
  } catch (error) {
    setStatus(auditsStatus, serverConfigHint(error.message), true);
  }
}

async function sendNurture(auditId, day, { previewTo = null } = {}) {
  const body = { day };
  if (previewTo) {
    body.previewTo = previewTo;
  }

  return adminFetch(`/api/admin/audits/${auditId}/send-nurture`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

async function handleTableClick(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  const row = button.closest("tr[data-id]");
  const auditId = row?.dataset.id;
  const day = Number(button.dataset.day);
  const action = button.dataset.action;
  const audit = auditsCache.find((a) => a.id === auditId);

  if (!audit) return;

  if (action === "open") {
    event.preventDefault();
    event.stopPropagation();
    await openAuditDetail(auditId);
    return;
  }

  if (action === "delete") {
    const label = audit.website_url || audit.email || auditId;
    if (!window.confirm(`Delete this lead permanently?\n\n${label}`)) return;
    button.disabled = true;
    try {
      await adminFetch(`/api/admin/audits/${auditId}`, { method: "DELETE" });
      await loadAudits();
    } catch (error) {
      button.disabled = false;
      window.alert(`Could not delete: ${error.message}`);
    }
    return;
  }

  if (action === "order-redesign") {
    button.disabled = true;
    try {
      await orderRedesign({
        sourceType: "audit",
        sourceId: auditId,
        label: audit.website_url,
      });
    } finally {
      button.disabled = false;
    }
    return;
  }

  if (action === "preview") {
    const to = previewEmail.value.trim();
    if (!to) {
      alert("Set a preview email address first.");
      return;
    }

    button.disabled = true;
    try {
      await sendNurture(auditId, day, { previewTo: to });
      setStatus(
        previewStatus,
        `Day ${day} preview sent to ${to} (Supabase not updated).`,
        false
      );
    } catch (error) {
      setStatus(previewStatus, normalizeClientError(error.message), true);
    } finally {
      button.disabled = false;
    }
    return;
  }

  if (action === "send") {
    const confirmed = confirm(
      `Send Day ${day} nurture email to ${audit.email}?\n\nThis marks day_${day}_sent in Supabase.`
    );
    if (!confirmed) return;

    button.disabled = true;
    try {
      await sendNurture(auditId, day);
      setStatus(auditsStatus, `Day ${day} sent to ${audit.email}.`, false);
      await loadAudits();
    } catch (error) {
      setStatus(auditsStatus, serverConfigHint(error.message), true);
    } finally {
      button.disabled = false;
    }
  }
}

async function sendAllPreviews() {
  const to = previewEmail.value.trim();
  if (!to) {
    setStatus(previewStatus, "Enter a preview email address.", true);
    return;
  }

  sendPreviewAllBtn.disabled = true;
  setStatus(previewStatus, "Sending 3 emails…", false);

  try {
    const body = { to };
    if (previewAudit.value) {
      body.auditId = previewAudit.value;
    }

    const data = await adminFetch("/api/admin/nurture-preview", {
      method: "POST",
      body: JSON.stringify(body),
    });

    setStatus(
      previewStatus,
      `${data.message} (website: ${data.website_url})`,
      false
    );
  } catch (error) {
    setStatus(previewStatus, normalizeClientError(error.message), true);
  } finally {
    sendPreviewAllBtn.disabled = false;
  }
}

let rateLimitStatusTimer = null;

async function resetRateLimit() {
  resetRateLimitBtn.disabled = true;
  clearTimeout(rateLimitStatusTimer);

  try {
    await adminFetch("/api/admin/reset-rate-limit", { method: "POST" });
    rateLimitStatus.textContent = "Rate limit cleared for your IP";
    rateLimitStatus.hidden = false;
    rateLimitStatusTimer = setTimeout(() => {
      rateLimitStatus.hidden = true;
    }, 2000);
  } catch (error) {
    rateLimitStatus.textContent = serverConfigHint(error.message);
    rateLimitStatus.hidden = false;
    rateLimitStatusTimer = setTimeout(() => {
      rateLimitStatus.hidden = true;
    }, 4000);
  } finally {
    resetRateLimitBtn.disabled = false;
  }
}

resetRateLimitBtn.addEventListener("click", resetRateLimit);
saveSecretBtn.addEventListener("click", saveSecret);
refreshBtn.addEventListener("click", loadAudits);
refreshWarmLeadsBtn.addEventListener("click", loadWarmLeads);
refreshRedesignsBtn.addEventListener("click", loadRedesigns);
redesignsBody.addEventListener("click", handleRedesignsTableClick);
orderRedesignManualBtn.addEventListener("click", () => {
  const url = redesignManualUrlInput.value.trim();
  if (!url) {
    setStatus(redesignsStatus, "Enter a website URL first.", true);
    return;
  }
  orderRedesign({ sourceType: "manual", websiteUrl: url, label: url });
});
clearRedesignDomainBtn.addEventListener("click", async () => {
  const url = redesignManualUrlInput.value.trim();
  if (!url) {
    setStatus(redesignsStatus, "Enter a website URL first.", true);
    return;
  }

  const rootDomain = rootDomainFromUrl(url);
  if (!rootDomain) {
    setStatus(redesignsStatus, "Enter a valid website URL.", true);
    return;
  }

  const siblingCount = redesignsCache.filter(
    (item) => rootDomainFromUrl(item.website_url) === rootDomain
  ).length;

  const confirmed = confirm(
    `Delete ALL preview data for ${rootDomain}?\n\n` +
      `This removes every preview row for this domain` +
      (siblingCount ? ` (${siblingCount} loaded in this list)` : "") +
      ` — HTML, roast bullets, tokens, and wait-screen answers.\n\nThis cannot be undone.`
  );
  if (!confirmed) return;

  clearRedesignDomainBtn.disabled = true;
  setStatus(redesignsStatus, `Deleting all previews for ${rootDomain}…`, false);

  try {
    const data = await adminFetch(
      `/api/admin/redesigns/by-domain?url=${encodeURIComponent(url)}`,
      { method: "DELETE" }
    );
    removeRedesignsForDomainFromCache(url);
    setStatus(
      redesignsStatus,
      `Deleted ${data.count} preview row(s) for ${data.root_domain ?? rootDomain}.`,
      false
    );
  } catch (error) {
    setStatus(redesignsStatus, serverConfigHint(error.message), true);
  } finally {
    clearRedesignDomainBtn.disabled = false;
  }
});
addWarmLeadToggleBtn.addEventListener("click", () => toggleAddWarmLeadForm(addWarmLeadForm.hidden));
addWarmLeadForm.addEventListener("submit", submitWarmLead);
addWarmLeadCancelBtn.addEventListener("click", () => {
  resetAddWarmLeadForm();
  toggleAddWarmLeadForm(false);
});
warmLeadsBody.addEventListener("click", handleWarmLeadsTableClick);
sendPreviewAllBtn.addEventListener("click", sendAllPreviews);
auditsBody.addEventListener("click", handleTableClick);
closeDetailBtn.addEventListener("click", closeAuditDetail);
generateScriptBtn.addEventListener("click", (event) => {
  event.preventDefault();
  generateCallScriptForAudit();
});
regenerateScriptBtn.addEventListener("click", (event) => {
  event.preventDefault();
  generateCallScriptForAudit({ force: true });
});
cancelScriptBtn.addEventListener("click", cancelScriptGeneration);

const saved = sessionStorage.getItem(SECRET_KEY);
if (saved) {
  secretInput.value = saved;
  setAuthStatus("Secret loaded from session.", false);
  loadAudits();
  loadWarmLeads();
  loadRedesigns();
}

/* ── Demo sites ──────────────────────────────────────────────────────────────
   Static spec builds served from this domain at /<slug>/. The manifest is a
   file in the repo (public/demos.json); per-demo outreach state is local to
   this browser so it needs no backend. */
const DEMO_STATE_KEY = "toolcrate_demo_state";
const demosStatus = document.getElementById("demos-status");
const demosTableWrap = document.getElementById("demos-table-wrap");
const demosBody = document.getElementById("demos-body");
const refreshDemosBtn = document.getElementById("refresh-demos");

function readDemoState() {
  try {
    return JSON.parse(localStorage.getItem(DEMO_STATE_KEY) || "{}");
  } catch {
    return {};
  }
}

function writeDemoState(state) {
  localStorage.setItem(DEMO_STATE_KEY, JSON.stringify(state));
}

function updateDemoState(slug, patch) {
  const state = readDemoState();
  state[slug] = { ...(state[slug] || {}), ...patch };
  writeDemoState(state);
}

function renderDemos(demos) {
  const state = readDemoState();
  demosBody.innerHTML = "";

  demos.forEach((demo) => {
    const saved = state[demo.slug] || {};
    const row = document.createElement("tr");

    const business = document.createElement("td");
    business.innerHTML = `<strong>${demo.business}</strong><br /><span class="admin-hint">${demo.trade} · ${demo.city}</span>`;

    const hook = document.createElement("td");
    hook.textContent = demo.hook;

    const phone = document.createElement("td");
    phone.innerHTML = `<a href="tel:${demo.phone.replace(/[^\d]/g, "")}">${demo.phone}</a>`;

    const link = document.createElement("td");
    const open = document.createElement("a");
    open.href = demo.url;
    open.target = "_blank";
    open.rel = "noopener";
    open.textContent = "Open";
    const copy = document.createElement("button");
    copy.type = "button";
    copy.className = "btn btn-secondary";
    copy.textContent = "Copy link";
    copy.addEventListener("click", async () => {
      await navigator.clipboard.writeText(demo.url);
      copy.textContent = "Copied";
      setTimeout(() => (copy.textContent = "Copy link"), 1500);
    });
    link.append(open, document.createElement("br"), copy);

    // Dial: which digit to press once the bridge line answers
    const dial = document.createElement("td");
    if (demo.bridge_digit) {
      dial.innerHTML = `<span class="demo-digit">${demo.bridge_digit}</span>`;
    } else {
      dial.innerHTML = '<span class="admin-hint">\u2014</span>';
    }

    // Follow-up email: opens the default mail client with a draft ready
    const email = document.createElement("td");
    const templates = demo.emails || {};
    const templateKeys = Object.keys(templates);
    if (templateKeys.length) {
      const to = document.createElement("input");
      to.type = "email";
      to.placeholder = "their email";
      to.value = saved.email || demo.email_to || "";
      to.addEventListener("change", () => updateDemoState(demo.slug, { email: to.value }));

      const which = document.createElement("select");
      const LABELS = { after_call: "After the call", voicemail: "Left a voicemail" };
      templateKeys.forEach((key) => {
        const option = document.createElement("option");
        option.value = key;
        option.textContent = LABELS[key] || key;
        if ((saved.template || templateKeys[0]) === key) option.selected = true;
        which.appendChild(option);
      });
      which.addEventListener("change", () => updateDemoState(demo.slug, { template: which.value }));

      const draft = document.createElement("button");
      draft.type = "button";
      draft.className = "btn btn-secondary";
      draft.textContent = "Draft email";
      draft.addEventListener("click", () => {
        const tpl = templates[which.value];
        if (!tpl) return;
        const href =
          `mailto:${encodeURIComponent(to.value.trim())}` +
          `?subject=${encodeURIComponent(tpl.subject)}` +
          `&body=${encodeURIComponent(tpl.body)}`;
        window.location.href = href;
        updateDemoState(demo.slug, { email: to.value, template: which.value });
      });

      email.append(to, which, draft);
    }


    const status = document.createElement("td");
    const select = document.createElement("select");
    ["Not sent", "Sent", "Opened", "Replied", "Won", "Passed"].forEach((label) => {
      const option = document.createElement("option");
      option.value = label;
      option.textContent = label;
      if ((saved.status || "Not sent") === label) option.selected = true;
      select.appendChild(option);
    });
    select.addEventListener("change", () => {
      updateDemoState(demo.slug, {
        status: select.value,
        changedAt: new Date().toISOString(),
      });
      stamp.textContent = `updated ${new Date().toLocaleDateString()}`;
    });
    const stamp = document.createElement("div");
    stamp.className = "admin-hint";
    stamp.textContent = saved.changedAt
      ? `updated ${new Date(saved.changedAt).toLocaleDateString()}`
      : `built ${demo.updated}`;
    status.append(select, stamp);

    const notes = document.createElement("td");
    const note = document.createElement("textarea");
    note.rows = 2;
    note.placeholder = "Who you spoke to, what they said…";
    note.value = saved.note || "";
    note.addEventListener("change", () => updateDemoState(demo.slug, { note: note.value }));
    notes.appendChild(note);

    row.append(business, hook, phone, dial, link, email, status, notes);
    demosBody.appendChild(row);
  });
}

async function loadDemos() {
  demosStatus.hidden = false;
  demosStatus.textContent = "Loading demo sites…";
  try {
    const response = await fetch(`/demos.json?ts=${Date.now()}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const demos = data.demos || [];
    if (!demos.length) {
      demosStatus.textContent = "No demo sites yet.";
      demosTableWrap.hidden = true;
      return;
    }
    renderDemos(demos);
    if (data.bridge_number) {
      const tel = document.getElementById("bridge-tel");
      tel.textContent = data.bridge_number;
      tel.href = `tel:${data.bridge_number.replace(/[^\d]/g, "")}`;
      document.getElementById("bridge-hint").hidden = false;
    }
    demosStatus.textContent = `${demos.length} demo site${demos.length === 1 ? "" : "s"} live · manifest updated ${data.updated}`;
    demosTableWrap.hidden = false;
  } catch (error) {
    demosTableWrap.hidden = true;
    demosStatus.textContent = `Could not load demo sites: ${error.message}`;
  }
}

if (refreshDemosBtn) {
  refreshDemosBtn.addEventListener("click", loadDemos);
  loadDemos();
}
