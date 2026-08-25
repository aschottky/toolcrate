import { apiUrl, normalizeClientError } from "../scripts/api-config.js";

// Session token from /api/admin/login — also read by /admin, so one login
// unlocks both pages.
const TOKEN_KEY = "toolcrate_admin_token";
const TOKEN_EMAIL_KEY = "toolcrate_admin_email";

const loginCard = document.getElementById("login-card");
const loginForm = document.getElementById("login-form");
const loginEmail = document.getElementById("login-email");
const loginPassword = document.getElementById("login-password");
const loginSubmitBtn = document.getElementById("login-submit");
const sessionInfo = document.getElementById("session-info");
const sessionEmail = document.getElementById("session-email");
const logoutBtn = document.getElementById("logout-btn");
const authStatus = document.getElementById("auth-status");
const orgStatus = document.getElementById("org-status");

const filterTabs = document.getElementById("filter-tabs");
const searchInput = document.getElementById("search-input");
const refreshBtn = document.getElementById("refresh-invoices");
const invoicesStatus = document.getElementById("invoices-status");
const tableWrap = document.getElementById("invoices-table-wrap");
const tableBody = document.getElementById("invoices-body");
const checkAll = document.getElementById("check-all");
const bulkBar = document.getElementById("bulk-bar");
const bulkCount = document.getElementById("bulk-count");
const bulkMarkPaidBtn = document.getElementById("bulk-mark-paid");
const bulkClearBtn = document.getElementById("bulk-clear");

const statOutstanding = document.getElementById("stat-outstanding");
const statOutstandingCount = document.getElementById("stat-outstanding-count");
const statOverdue = document.getElementById("stat-overdue");
const statOverdueCount = document.getElementById("stat-overdue-count");
const statDueWeek = document.getElementById("stat-due-week");
const statDueWeekCount = document.getElementById("stat-due-week-count");

const contactsStatus = document.getElementById("contacts-status");
const createForm = document.getElementById("create-form");
const customerSelect = document.getElementById("new-customer");
const newDate = document.getElementById("new-date");
const newDueDate = document.getElementById("new-due-date");
const lineItemsWrap = document.getElementById("line-items");
const addLineBtn = document.getElementById("add-line");
const newNotes = document.getElementById("new-notes");
const newTotal = document.getElementById("new-total");
const newDelivery = document.getElementById("new-delivery");
const createSubmitBtn = document.getElementById("create-submit");
const createStatus = document.getElementById("create-status");

let currentFilter = "unpaid";
let invoicesCache = [];
let currencyCode = "USD";
const selectedIds = new Set();

// ---------------------------------------------------------------------------
// Auth + fetch

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function showLoggedIn() {
  loginCard.hidden = true;
  sessionInfo.hidden = false;
  sessionEmail.textContent = localStorage.getItem(TOKEN_EMAIL_KEY) || "";
}

function showLoggedOut(message = "", isError = false) {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(TOKEN_EMAIL_KEY);
  loginCard.hidden = false;
  sessionInfo.hidden = true;
  setStatus(authStatus, message, isError);
}

async function login(event) {
  event.preventDefault();
  loginSubmitBtn.disabled = true;
  setStatus(authStatus, "");

  try {
    const response = await fetch(apiUrl("/api/admin/login"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: loginEmail.value.trim(),
        password: loginPassword.value,
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.token) {
      throw new Error(data.error || `Login failed (HTTP ${response.status}).`);
    }

    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(TOKEN_EMAIL_KEY, data.email);
    loginPassword.value = "";
    showLoggedIn();
    init();
  } catch (error) {
    setStatus(authStatus, normalizeClientError(error.message), true);
  } finally {
    loginSubmitBtn.disabled = false;
  }
}

async function zohoFetch(path, options = {}) {
  const secret = getToken();
  if (!secret) {
    throw new Error("Sign in first.");
  }

  const { timeoutMs = 60000, ...fetchOptions } = options;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let response;
  try {
    response = await fetch(apiUrl(path), {
      ...fetchOptions,
      headers: {
        Authorization: `Bearer ${secret}`,
        ...(fetchOptions.body ? { "Content-Type": "application/json" } : {}),
      },
      signal: controller.signal,
    });
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error("Request timed out — Zoho may be slow, try again.");
    }
    throw new Error(normalizeClientError(error.message));
  } finally {
    clearTimeout(timeoutId);
  }

  const data = await response.json().catch(() => ({}));
  if (response.status === 401) {
    showLoggedOut("Your session expired — sign in again.", true);
    throw new Error("Your session expired — sign in again.");
  }
  if (!response.ok || data.ok === false) {
    throw new Error(normalizeClientError(data.error || `HTTP ${response.status}`));
  }
  return data;
}

// ---------------------------------------------------------------------------
// Helpers

function setStatus(el, message, isError = false) {
  el.hidden = !message;
  el.textContent = message || "";
  el.classList.toggle("admin-status--error", isError);
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function money(amount, code = currencyCode) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: code || "USD",
  }).format(Number(amount) || 0);
}

function formatDate(iso) {
  if (!iso) return "—";
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function todayIso(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

const STATUS_CLASS = {
  overdue: "inv-badge--overdue",
  paid: "inv-badge--paid",
  sent: "inv-badge--sent",
  draft: "inv-badge--draft",
  partially_paid: "inv-badge--partial",
  viewed: "inv-badge--sent",
};

// ---------------------------------------------------------------------------
// Invoice list + summary

async function loadInvoices() {
  setStatus(invoicesStatus, "Loading invoices…");
  tableWrap.hidden = true;

  try {
    const search = searchInput.value.trim();
    const params = new URLSearchParams({ filter: currentFilter });
    if (search) params.set("search", search);

    const data = await zohoFetch(`/api/zoho/invoices?${params}`);
    invoicesCache = data.invoices;
    if (invoicesCache[0]?.currency_code) {
      currencyCode = invoicesCache[0].currency_code;
    }
    selectedIds.clear();
    renderInvoices();
    setStatus(
      invoicesStatus,
      invoicesCache.length
        ? ""
        : `No ${currentFilter === "all" ? "" : currentFilter + " "}invoices found.`
    );
  } catch (error) {
    setStatus(invoicesStatus, error.message, true);
  }
}

async function loadSummary() {
  try {
    const data = await zohoFetch("/api/zoho/invoices?filter=unpaid");
    const unpaid = data.invoices;
    if (unpaid[0]?.currency_code) currencyCode = unpaid[0].currency_code;

    const today = todayIso();
    const weekOut = todayIso(7);
    const overdue = unpaid.filter((i) => i.due_date && i.due_date < today);
    const dueWeek = unpaid.filter(
      (i) => i.due_date && i.due_date >= today && i.due_date <= weekOut
    );
    const sum = (list) => list.reduce((acc, i) => acc + Number(i.balance || 0), 0);

    statOutstanding.textContent = money(sum(unpaid));
    statOutstandingCount.textContent = `${unpaid.length} invoice${unpaid.length === 1 ? "" : "s"}`;
    statOverdue.textContent = money(sum(overdue));
    statOverdueCount.textContent = `${overdue.length} invoice${overdue.length === 1 ? "" : "s"}`;
    statDueWeek.textContent = money(sum(dueWeek));
    statDueWeekCount.textContent = `${dueWeek.length} invoice${dueWeek.length === 1 ? "" : "s"}`;
  } catch {
    // Summary is best-effort; the table shows real errors.
  }
}

function renderInvoices() {
  const payable = new Set(["sent", "overdue", "partially_paid", "viewed", "unpaid"]);

  tableBody.innerHTML = invoicesCache
    .map((inv) => {
      const canPay = payable.has(inv.status) && Number(inv.balance) > 0;
      const isOverdue =
        canPay && inv.due_date && inv.due_date < todayIso() ? " inv-row--overdue" : "";
      const badgeClass = STATUS_CLASS[inv.status] || "inv-badge--draft";

      return `
        <tr data-id="${inv.invoice_id}" class="${isOverdue}">
          <td class="inv-col-check">
            ${canPay ? `<input type="checkbox" class="row-check" data-id="${inv.invoice_id}" ${selectedIds.has(inv.invoice_id) ? "checked" : ""} />` : ""}
          </td>
          <td class="inv-number">${escapeHtml(inv.invoice_number)}</td>
          <td>${escapeHtml(inv.customer_name)}</td>
          <td>${formatDate(inv.date)}</td>
          <td>${formatDate(inv.due_date)}</td>
          <td><span class="inv-badge ${badgeClass}">${escapeHtml(inv.status.replace("_", " "))}</span></td>
          <td class="inv-col-num">${money(inv.total, inv.currency_code)}</td>
          <td class="inv-col-num"><strong>${money(inv.balance, inv.currency_code)}</strong></td>
          <td class="inv-col-actions">
            ${
              canPay
                ? `<button type="button" class="btn btn-primary btn-small mark-paid-btn" data-id="${inv.invoice_id}">✓ Bank paid</button>
                   <button type="button" class="btn btn-secondary btn-small email-btn" data-id="${inv.invoice_id}" title="Resend invoice email">✉</button>`
                : ""
            }
            ${
              inv.status === "draft"
                ? `<button type="button" class="btn btn-secondary btn-small mark-open-btn" data-id="${inv.invoice_id}">Mark open</button>`
                : ""
            }
          </td>
        </tr>`;
    })
    .join("");

  tableWrap.hidden = invoicesCache.length === 0;
  checkAll.checked = false;
  updateBulkBar();
}

function updateBulkBar() {
  const count = selectedIds.size;
  bulkBar.hidden = count === 0;
  if (count) {
    const total = invoicesCache
      .filter((i) => selectedIds.has(i.invoice_id))
      .reduce((acc, i) => acc + Number(i.balance || 0), 0);
    bulkCount.textContent = `${count} selected — ${money(total)}`;
  }
}

// ---------------------------------------------------------------------------
// Payments

async function markPaid(invoiceId, button) {
  const inv = invoicesCache.find((i) => i.invoice_id === invoiceId);
  const label = inv ? `${inv.invoice_number} (${money(inv.balance, inv.currency_code)})` : invoiceId;
  if (!confirm(`Record full bank payment for ${label}?`)) return;

  button.disabled = true;
  button.textContent = "Saving…";
  try {
    const data = await zohoFetch(`/api/zoho/invoices/${invoiceId}/mark-paid`, {
      method: "POST",
      body: JSON.stringify({}),
    });
    setStatus(
      invoicesStatus,
      `Paid: ${data.payment.invoice_number} — ${money(data.payment.amount)}.`
    );
    await Promise.all([loadInvoices(), loadSummary()]);
  } catch (error) {
    button.disabled = false;
    button.textContent = "✓ Bank paid";
    setStatus(invoicesStatus, error.message, true);
  }
}

async function bulkMarkPaid() {
  const ids = [...selectedIds];
  if (!ids.length) return;
  const total = invoicesCache
    .filter((i) => selectedIds.has(i.invoice_id))
    .reduce((acc, i) => acc + Number(i.balance || 0), 0);
  if (!confirm(`Record bank payments for ${ids.length} invoices (${money(total)})?`)) return;

  bulkMarkPaidBtn.disabled = true;
  bulkMarkPaidBtn.textContent = "Recording payments…";
  try {
    const data = await zohoFetch("/api/zoho/invoices/bulk-mark-paid", {
      method: "POST",
      body: JSON.stringify({ invoice_ids: ids }),
      timeoutMs: 180000,
    });
    const failures = data.errors.length
      ? ` ${data.errors.length} failed: ${data.errors.map((e) => e.error).join("; ")}`
      : "";
    setStatus(
      invoicesStatus,
      `Marked ${data.paid.length} invoice${data.paid.length === 1 ? "" : "s"} paid.${failures}`,
      data.errors.length > 0
    );
    selectedIds.clear();
    await Promise.all([loadInvoices(), loadSummary()]);
  } catch (error) {
    setStatus(invoicesStatus, error.message, true);
  } finally {
    bulkMarkPaidBtn.disabled = false;
    bulkMarkPaidBtn.textContent = "Mark selected paid (bank)";
  }
}

async function markOpen(invoiceId, button) {
  button.disabled = true;
  button.textContent = "Opening…";
  try {
    await zohoFetch(`/api/zoho/invoices/${invoiceId}/mark-open`, {
      method: "POST",
      body: JSON.stringify({}),
    });
    const inv = invoicesCache.find((i) => i.invoice_id === invoiceId);
    setStatus(invoicesStatus, `${inv?.invoice_number || "Invoice"} is now open (not emailed).`);
    await Promise.all([loadInvoices(), loadSummary()]);
  } catch (error) {
    button.disabled = false;
    button.textContent = "Mark open";
    setStatus(invoicesStatus, error.message, true);
  }
}

async function resendEmail(invoiceId, button) {
  button.disabled = true;
  try {
    await zohoFetch(`/api/zoho/invoices/${invoiceId}/email`, {
      method: "POST",
      body: JSON.stringify({}),
    });
    const inv = invoicesCache.find((i) => i.invoice_id === invoiceId);
    setStatus(invoicesStatus, `Emailed ${inv?.invoice_number || "invoice"} to the customer.`);
  } catch (error) {
    setStatus(invoicesStatus, error.message, true);
  } finally {
    button.disabled = false;
  }
}

// ---------------------------------------------------------------------------
// Create invoice

function addLineRow(focus = false) {
  const row = document.createElement("div");
  row.className = "inv-line-row";
  row.innerHTML = `
    <input type="text" class="line-name" placeholder="Item / service" />
    <input type="number" class="line-qty" placeholder="Qty" min="0" step="any" value="1" />
    <input type="number" class="line-rate" placeholder="Rate" min="0" step="any" />
    <span class="line-amount">—</span>
    <button type="button" class="inv-line-remove" title="Remove line">×</button>`;
  lineItemsWrap.appendChild(row);
  if (focus) row.querySelector(".line-name").focus();
}

function readLineItems() {
  return [...lineItemsWrap.querySelectorAll(".inv-line-row")]
    .map((row) => ({
      name: row.querySelector(".line-name").value.trim(),
      quantity: Number(row.querySelector(".line-qty").value) || 1,
      rate: Number(row.querySelector(".line-rate").value),
    }))
    .filter((li) => li.name && li.rate > 0);
}

function updateCreateTotal() {
  for (const row of lineItemsWrap.querySelectorAll(".inv-line-row")) {
    const qty = Number(row.querySelector(".line-qty").value) || 0;
    const rate = Number(row.querySelector(".line-rate").value) || 0;
    row.querySelector(".line-amount").textContent = qty && rate ? money(qty * rate) : "—";
  }
  const total = readLineItems().reduce((acc, li) => acc + li.quantity * li.rate, 0);
  newTotal.textContent = total ? money(total) : "—";
}

async function loadContacts() {
  try {
    const data = await zohoFetch("/api/zoho/contacts");
    customerSelect.innerHTML =
      `<option value="">Select a customer…</option>` +
      data.contacts
        .map((c) => {
          const company =
            c.company_name && c.company_name !== c.contact_name
              ? ` — ${escapeHtml(c.company_name)}`
              : "";
          // Show the address the invoice will actually be emailed to. Zoho refuses
          // to send when a contact has none, so surface that before it is picked
          // rather than after the send fails.
          const email = c.email?.trim()
            ? ` · ${escapeHtml(c.email.trim())}`
            : " · ⚠ no email on file";
          return `<option value="${c.contact_id}">${escapeHtml(
            c.contact_name
          )}${company}${email}</option>`;
        })
        .join("");
    setStatus(contactsStatus, "");
  } catch (error) {
    customerSelect.innerHTML = `<option value="">Could not load customers</option>`;
    setStatus(contactsStatus, error.message, true);
  }
}

async function submitCreate(event) {
  event.preventDefault();
  const customerId = customerSelect.value;
  const lineItems = readLineItems();

  if (!customerId) {
    setStatus(createStatus, "Pick a customer first.", true);
    return;
  }
  if (!lineItems.length) {
    setStatus(createStatus, "Add at least one line item with a name and rate.", true);
    return;
  }

  createSubmitBtn.disabled = true;
  createSubmitBtn.textContent = "Creating…";
  setStatus(createStatus, "");

  try {
    const delivery = newDelivery.value;
    const data = await zohoFetch("/api/zoho/invoices", {
      method: "POST",
      body: JSON.stringify({
        customer_id: customerId,
        line_items: lineItems,
        date: newDate.value || undefined,
        due_date: newDueDate.value || undefined,
        notes: newNotes.value.trim() || undefined,
        delivery,
      }),
      timeoutMs: 90000,
    });

    let message = `Created ${data.invoice.invoice_number} — ${money(data.invoice.total)}.`;
    let isError = false;
    if (delivery === "email") {
      if (data.emailed) message += " Emailed to customer.";
      else {
        message += ` Created but email failed: ${data.delivery_error}`;
        isError = true;
      }
    } else if (delivery === "open") {
      if (data.marked_open) message += " Marked as open (not emailed).";
      else {
        message += ` Created as draft but marking open failed: ${data.delivery_error}`;
        isError = true;
      }
    } else {
      message += " Saved as draft.";
    }
    setStatus(createStatus, message, isError);

    createForm.reset();
    lineItemsWrap.innerHTML = "";
    addLineRow();
    setDefaultDates();
    updateCreateTotal();
    await Promise.all([loadInvoices(), loadSummary()]);
  } catch (error) {
    setStatus(createStatus, error.message, true);
  } finally {
    createSubmitBtn.disabled = false;
    createSubmitBtn.textContent = "Create invoice";
  }
}

function setDefaultDates() {
  newDate.value = todayIso();
  newDueDate.value = todayIso(14);
}

// ---------------------------------------------------------------------------
// Events

loginForm.addEventListener("submit", login);
logoutBtn.addEventListener("click", () => showLoggedOut("Signed out."));

filterTabs.addEventListener("click", (e) => {
  const tab = e.target.closest(".inv-tab");
  if (!tab) return;
  currentFilter = tab.dataset.filter;
  for (const t of filterTabs.querySelectorAll(".inv-tab")) {
    t.classList.toggle("inv-tab--active", t === tab);
  }
  loadInvoices();
});

let searchTimer;
searchInput.addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(loadInvoices, 400);
});

refreshBtn.addEventListener("click", () => {
  loadInvoices();
  loadSummary();
});

tableBody.addEventListener("click", (e) => {
  const payBtn = e.target.closest(".mark-paid-btn");
  if (payBtn) return markPaid(payBtn.dataset.id, payBtn);

  const emailBtn = e.target.closest(".email-btn");
  if (emailBtn) return resendEmail(emailBtn.dataset.id, emailBtn);

  const openBtn = e.target.closest(".mark-open-btn");
  if (openBtn) return markOpen(openBtn.dataset.id, openBtn);
});

tableBody.addEventListener("change", (e) => {
  const check = e.target.closest(".row-check");
  if (!check) return;
  if (check.checked) selectedIds.add(check.dataset.id);
  else selectedIds.delete(check.dataset.id);
  updateBulkBar();
});

checkAll.addEventListener("change", () => {
  selectedIds.clear();
  for (const check of tableBody.querySelectorAll(".row-check")) {
    check.checked = checkAll.checked;
    if (checkAll.checked) selectedIds.add(check.dataset.id);
  }
  updateBulkBar();
});

bulkMarkPaidBtn.addEventListener("click", bulkMarkPaid);
bulkClearBtn.addEventListener("click", () => {
  selectedIds.clear();
  for (const check of tableBody.querySelectorAll(".row-check")) check.checked = false;
  checkAll.checked = false;
  updateBulkBar();
});

addLineBtn.addEventListener("click", () => addLineRow(true));
lineItemsWrap.addEventListener("input", updateCreateTotal);
lineItemsWrap.addEventListener("click", (e) => {
  if (e.target.closest(".inv-line-remove")) {
    e.target.closest(".inv-line-row").remove();
    if (!lineItemsWrap.children.length) addLineRow();
    updateCreateTotal();
  }
});
createForm.addEventListener("submit", submitCreate);

// ---------------------------------------------------------------------------
// Init

async function checkConfig() {
  try {
    const data = await zohoFetch("/api/zoho/status");
    if (!data.configured) {
      setStatus(
        orgStatus,
        "Zoho is not configured on the server yet — add ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, ZOHO_REFRESH_TOKEN and ZOHO_ORGANIZATION_ID to the environment.",
        true
      );
      return false;
    }
    if (data.warning) {
      setStatus(orgStatus, data.warning, true);
    } else if (data.organization) {
      setStatus(orgStatus, `Connected to ${data.organization.name} (${data.organization.currency_code}).`);
      if (data.organization.currency_code) currencyCode = data.organization.currency_code;
    }
    return true;
  } catch (error) {
    setStatus(orgStatus, error.message, true);
    return false;
  }
}

async function init() {
  if (!getToken()) return;
  const configured = await checkConfig();
  if (!configured) return;
  loadInvoices();
  loadSummary();
  loadContacts();
}

addLineRow();
setDefaultDates();
updateCreateTotal();

if (getToken()) {
  showLoggedIn();
  init();
}
