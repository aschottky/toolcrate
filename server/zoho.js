/**
 * Zoho Invoice API client + admin routes (/api/zoho/*).
 *
 * Auth: OAuth 2.0 "Self Client" — a permanent refresh token in env is
 * exchanged for short-lived (1h) access tokens, cached in memory.
 *
 * Required env:
 *   ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET  — from https://api-console.zoho.com (Self Client)
 *   ZOHO_REFRESH_TOKEN                  — generated once from a Self Client grant code
 *   ZOHO_ORGANIZATION_ID                — Zoho Invoice → Settings → Organization Profile
 * Optional env:
 *   ZOHO_DC — data-center TLD: com (default), eu, in, com.au, jp, ca
 */

const ZOHO_DC = process.env.ZOHO_DC?.trim() || "com";
const ACCOUNTS_BASE = `https://accounts.zoho.${ZOHO_DC}`;
const API_BASE = `https://www.zohoapis.${ZOHO_DC}/invoice/v3`;

/** Payment mode used by the one-click "mark paid" buttons. */
const BANK_PAYMENT_MODE = "banktransfer";

const FILTER_MAP = {
  unpaid: "Status.Unpaid",
  overdue: "Status.OverDue",
  paid: "Status.Paid",
  draft: "Status.Draft",
  sent: "Status.Sent",
  all: "Status.All",
};

function isZohoConfigured() {
  return Boolean(
    process.env.ZOHO_CLIENT_ID?.trim() &&
      process.env.ZOHO_CLIENT_SECRET?.trim() &&
      process.env.ZOHO_REFRESH_TOKEN?.trim() &&
      process.env.ZOHO_ORGANIZATION_ID?.trim()
  );
}

function requireZoho() {
  if (!isZohoConfigured()) {
    const err = new Error(
      "Zoho is not configured. Set ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, ZOHO_REFRESH_TOKEN and ZOHO_ORGANIZATION_ID."
    );
    err.statusCode = 503;
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Access-token cache (tokens live 1h; refresh 2 min early)

let cachedToken = null;
let cachedTokenExpiresAt = 0;
let refreshPromise = null;

async function fetchAccessToken() {
  const params = new URLSearchParams({
    refresh_token: process.env.ZOHO_REFRESH_TOKEN.trim(),
    client_id: process.env.ZOHO_CLIENT_ID.trim(),
    client_secret: process.env.ZOHO_CLIENT_SECRET.trim(),
    grant_type: "refresh_token",
  });

  const res = await fetch(`${ACCOUNTS_BASE}/oauth/v2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error || !data.access_token) {
    throw new Error(
      `Zoho token refresh failed: ${data.error || res.status}. Check ZOHO_REFRESH_TOKEN / client credentials (and ZOHO_DC if your account is not on .${ZOHO_DC}).`
    );
  }

  cachedToken = data.access_token;
  cachedTokenExpiresAt =
    Date.now() + (Number(data.expires_in) || 3600) * 1000 - 120_000;
  return cachedToken;
}

async function getAccessToken() {
  if (cachedToken && Date.now() < cachedTokenExpiresAt) {
    return cachedToken;
  }
  // Dedupe concurrent refreshes (Zoho throttles token requests).
  refreshPromise ??= fetchAccessToken().finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}

// ---------------------------------------------------------------------------
// Core fetch wrapper

async function zohoFetch(path, { method = "GET", query, body } = {}) {
  requireZoho();
  const token = await getAccessToken();

  const url = new URL(`${API_BASE}${path}`);
  for (const [key, value] of Object.entries(query || {})) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, value);
    }
  }

  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Zoho-oauthtoken ${token}`,
      "X-com-zoho-invoice-organizationid":
        process.env.ZOHO_ORGANIZATION_ID.trim(),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));

  // Zoho responds with { code: 0 } on success; anything else is an error.
  if (!res.ok || (typeof data.code === "number" && data.code !== 0)) {
    const err = new Error(
      data.message || `Zoho API error (HTTP ${res.status}) on ${method} ${path}`
    );
    err.statusCode = res.status >= 400 && res.status < 500 ? res.status : 502;
    throw err;
  }

  return data;
}

// ---------------------------------------------------------------------------
// Handlers

async function getStatus() {
  if (!isZohoConfigured()) {
    return { ok: true, configured: false };
  }
  const data = await zohoFetch("/organizations");
  const orgId = process.env.ZOHO_ORGANIZATION_ID.trim();
  const org =
    (data.organizations || []).find((o) => String(o.organization_id) === orgId) ||
    null;
  return {
    ok: true,
    configured: true,
    organization: org
      ? {
          organization_id: org.organization_id,
          name: org.name,
          currency_code: org.currency_code,
          currency_symbol: org.currency_symbol,
        }
      : null,
    warning: org
      ? null
      : `ZOHO_ORGANIZATION_ID=${orgId} was not found among this account's organizations.`,
  };
}

async function listInvoices(req) {
  const filter = FILTER_MAP[req.query.filter] || FILTER_MAP.unpaid;
  const data = await zohoFetch("/invoices", {
    query: {
      filter_by: filter,
      search_text: req.query.search?.trim() || undefined,
      sort_column: "due_date",
      per_page: 200,
      page: Number(req.query.page) || 1,
    },
  });

  const invoices = (data.invoices || []).map((inv) => ({
    invoice_id: inv.invoice_id,
    invoice_number: inv.invoice_number,
    customer_id: inv.customer_id,
    customer_name: inv.customer_name,
    status: inv.status,
    date: inv.date,
    due_date: inv.due_date,
    total: inv.total,
    balance: inv.balance,
    currency_code: inv.currency_code,
    currency_symbol: inv.currency_symbol,
  }));

  return {
    ok: true,
    invoices,
    has_more_page: data.page_context?.has_more_page ?? false,
  };
}

async function listContacts() {
  const data = await zohoFetch("/contacts", {
    query: { status: "active", sort_column: "contact_name", per_page: 200 },
  });
  return {
    ok: true,
    contacts: (data.contacts || []).map((c) => ({
      contact_id: c.contact_id,
      contact_name: c.contact_name,
      company_name: c.company_name,
      email: c.email,
      outstanding_receivable_amount: c.outstanding_receivable_amount,
    })),
  };
}

/**
 * Resolve the addresses an invoice email should be sent to.
 *
 * Zoho does NOT fall back to the customer's stored addresses when the email body
 * is empty. GET /invoices/{id}/email returns the contact persons with
 * "selected": false, and a send with no recipients fails with
 *   "The email address for this customer was not found in the customer's details."
 * even though the contact has a perfectly good email on file.
 *
 * Recipients must therefore be passed explicitly as `to_mail_ids`, and Zoho wants
 * EMAIL ADDRESSES there - passing contact_person_id values is rejected with
 * "Invalid value passed for to_mail_ids".
 */
async function getInvoiceRecipients(invoiceId) {
  const data = await zohoFetch(`/invoices/${invoiceId}/email`);
  const emails = (data.data?.to_contacts || [])
    .map((c) => c.email?.trim())
    .filter(Boolean);
  return [...new Set(emails)];
}

/** Email an invoice to every address Zoho knows for its customer. */
async function sendInvoiceEmail(invoiceId) {
  const to = await getInvoiceRecipients(invoiceId);
  if (!to.length) {
    const err = new Error(
      "No email address on file for this customer in Zoho. Add one to the contact (Zoho → Contacts → Email) and try again."
    );
    err.statusCode = 422;
    throw err;
  }
  await zohoFetch(`/invoices/${invoiceId}/email`, {
    method: "POST",
    body: { to_mail_ids: to },
  });
  return to;
}

async function createInvoice(req) {
  const { customer_id, line_items, date, due_date, notes, delivery } =
    req.body || {};

  if (!customer_id) {
    const err = new Error("customer_id is required.");
    err.statusCode = 400;
    throw err;
  }
  const items = (line_items || []).filter(
    (li) => li && (li.name || li.description) && Number(li.rate) > 0
  );
  if (!items.length) {
    const err = new Error(
      "At least one line item with a name and a rate is required."
    );
    err.statusCode = 400;
    throw err;
  }

  const payload = {
    customer_id,
    date: date || undefined,
    due_date: due_date || undefined,
    notes: notes?.trim() || undefined,
    line_items: items.map((li) => ({
      name: String(li.name || li.description).slice(0, 100),
      description: li.description ? String(li.description) : undefined,
      rate: Number(li.rate),
      quantity: Number(li.quantity) || 1,
    })),
  };

  const created = await zohoFetch("/invoices", { method: "POST", body: payload });
  const invoice = created.invoice;

  // delivery: "email" (send to customer, marks it sent),
  //           "open"  (mark as sent/open without emailing),
  //           "draft" (leave as draft)
  const mode = delivery || "email";
  let emailed = false;
  let markedOpen = false;
  let deliveryError = null;

  if (invoice?.invoice_id && mode !== "draft") {
    try {
      if (mode === "email") {
        await sendInvoiceEmail(invoice.invoice_id);
        emailed = true;
      } else if (mode === "open") {
        await zohoFetch(`/invoices/${invoice.invoice_id}/status/sent`, {
          method: "POST",
        });
        markedOpen = true;
      }
    } catch (error) {
      deliveryError = error.message;
    }
  }

  return {
    ok: true,
    invoice: {
      invoice_id: invoice.invoice_id,
      invoice_number: invoice.invoice_number,
      status: invoice.status,
      total: invoice.total,
    },
    emailed,
    marked_open: markedOpen,
    delivery_error: deliveryError,
  };
}

/** Fetch an invoice and record a full-balance bank payment against it. */
async function recordBankPayment(invoiceId, { date, reference } = {}) {
  const detail = await zohoFetch(`/invoices/${invoiceId}`);
  const invoice = detail.invoice;
  const balance = Number(invoice.balance);

  if (!(balance > 0)) {
    throw new Error(
      `Invoice ${invoice.invoice_number} has no outstanding balance (status: ${invoice.status}).`
    );
  }

  const payment = await zohoFetch("/customerpayments", {
    method: "POST",
    body: {
      customer_id: invoice.customer_id,
      payment_mode: BANK_PAYMENT_MODE,
      amount: balance,
      date: date || new Date().toISOString().slice(0, 10),
      reference_number: reference || undefined,
      description: `Bank payment for ${invoice.invoice_number}`,
      invoices: [{ invoice_id: invoice.invoice_id, amount_applied: balance }],
    },
  });

  return {
    invoice_id: invoice.invoice_id,
    invoice_number: invoice.invoice_number,
    amount: balance,
    payment_id: payment.payment?.payment_id,
  };
}

async function markInvoicePaid(req) {
  const result = await recordBankPayment(req.params.id, {
    date: req.body?.date,
    reference: req.body?.reference,
  });
  return { ok: true, payment: result };
}

async function bulkMarkPaid(req) {
  const ids = (req.body?.invoice_ids || []).filter(Boolean);
  if (!ids.length) {
    const err = new Error("invoice_ids is required.");
    err.statusCode = 400;
    throw err;
  }

  const results = [];
  const errors = [];
  // Sequential on purpose — Zoho rate-limits bursts of concurrent calls.
  for (const id of ids) {
    try {
      results.push(await recordBankPayment(id, { date: req.body?.date }));
    } catch (error) {
      errors.push({ invoice_id: id, error: error.message });
    }
  }

  return { ok: true, paid: results, errors };
}

async function markInvoiceOpen(req) {
  await zohoFetch(`/invoices/${req.params.id}/status/sent`, { method: "POST" });
  return { ok: true };
}

async function emailInvoice(req) {
  const to = await sendInvoiceEmail(req.params.id);
  return { ok: true, sent_to: to };
}

// ---------------------------------------------------------------------------

export function registerZohoRoutes(app, { verifyCronSecret }) {
  function guard(handler) {
    return async (req, res) => {
      try {
        verifyCronSecret(req);
        const payload = await handler(req);
        return res.json(payload);
      } catch (error) {
        const status = error.statusCode ?? 500;
        console.error("[zoho]", error.message);
        return res.status(status).json({ ok: false, error: error.message });
      }
    };
  }

  app.get("/api/zoho/status", guard(getStatus));
  app.get("/api/zoho/invoices", guard(listInvoices));
  app.get("/api/zoho/contacts", guard(listContacts));
  app.post("/api/zoho/invoices", guard(createInvoice));
  app.post("/api/zoho/invoices/:id/mark-paid", guard(markInvoicePaid));
  app.post("/api/zoho/invoices/:id/mark-open", guard(markInvoiceOpen));
  app.post("/api/zoho/invoices/bulk-mark-paid", guard(bulkMarkPaid));
  app.post("/api/zoho/invoices/:id/email", guard(emailInvoice));
}
