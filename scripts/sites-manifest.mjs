/**
 * Writes public/sites.json — the public, outreach-free subset of the demo
 * manifest that /sites/ lists. The full manifest (email drafts, bridge digits,
 * sent status) lives in server/data/demos.json and is served only to /admin
 * via GET /api/admin/demos.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(readFileSync(join(root, "server/data/demos.json"), "utf8"));

const publicManifest = {
  updated: manifest.updated,
  demos: (manifest.demos || []).map(({ business, trade, city, phone, hook, url }) => ({
    business,
    trade,
    city,
    phone,
    hook,
    url,
  })),
  extras: (manifest.extras || []).map(({ title, url, note }) => ({ title, url, note })),
};

writeFileSync(join(root, "public/sites.json"), `${JSON.stringify(publicManifest, null, 2)}\n`);
console.log(`sites.json: ${publicManifest.demos.length} demos, ${publicManifest.extras.length} extras`);
