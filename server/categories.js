/** Canonical audit score categories (order preserved for UI/PDF). */
export const AUDIT_CATEGORIES = [
  { key: "seo", label: "SEO" },
  { key: "leadCapture", label: "Lead Capture" },
  { key: "mobile", label: "Mobile-Friendliness" },
  { key: "trust", label: "Trust & Credibility" },
  { key: "messaging", label: "Messaging & Clarity" },
  { key: "performance", label: "Performance & Bloat" },
  { key: "security", label: "Tech Stack & Security" },
];

export const AUDIT_CATEGORY_KEYS = AUDIT_CATEGORIES.map((c) => c.key);
