#!/usr/bin/env node
/**
 * Pre-deploy checks for the committed static site.
 *
 * Run: npm run check
 *
 * Verifies that what sits in site/ is safe to publish:
 *   - every internal link and asset reference resolves
 *   - clean-URL canonicals match the route they live on
 *   - sitemap.xml only lists pages that exist
 *   - no dev hostnames or stale contact details leaked in
 *   - asset references carry the build token, and 404.html matches 404/index.html
 *
 * Exits non-zero on the first category with failures; prints every problem found.
 */
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative, dirname, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const site = join(root, "site");
const ORIGIN = "https://xartisan.studio";

const problems = [];
const fail = (check, detail) => problems.push({ check, detail });

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const files = walk(site);
const htmlFiles = files.filter((f) => f.endsWith(".html"));
const rel = (f) => relative(site, f).split(sep).join("/");

const FORBIDDEN = [
  ["localhost", /localhost/i],
  ["127.0.0.1", /127\.0\.0\.1/],
  ["old phone 0435 878 929", /0435[\s-]?878[\s-]?929/],
  ["old phone +61435878929", /\+?61435878929/],
  ["old email hello@", /hello@xartisan\.studio/],
];

// 1. internal links + assets
let refCount = 0;
for (const file of htmlFiles) {
  const html = readFileSync(file, "utf8");
  for (const m of html.matchAll(/(?:href|src)="(\/[^"#?]*)/g)) {
    const href = m[1];
    if (href.startsWith("//")) continue;
    refCount++;
    const target = join(site, href.replace(/^\//, ""));
    const ok = existsSync(target) && (statSync(target).isFile() || existsSync(join(target, "index.html")));
    if (!ok) fail("broken internal link", `${rel(file)} -> ${href}`);
  }
  for (const [label, re] of FORBIDDEN) {
    if (re.test(html)) fail("forbidden string", `${label} in ${rel(file)}`);
  }
}

// 2. canonicals
for (const file of htmlFiles) {
  const r = rel(file);
  if (r === "404.html" || r === "404/index.html") continue;
  const html = readFileSync(file, "utf8");
  const canonical = html.match(/<link rel="canonical" href="([^"]+)"/)?.[1];
  const route = r.endsWith("index.html") ? "/" + r.slice(0, -"index.html".length) : "/" + r;
  const expected = (ORIGIN + route).replace(/\/$/, "") || ORIGIN;
  if (!canonical) fail("missing canonical", r);
  else if (canonical.replace(/\/$/, "") !== expected) {
    fail("canonical mismatch", `${r}: ${canonical} (expected ${expected})`);
  }
}

// 3. sitemap
const sitemap = readFileSync(join(site, "sitemap.xml"), "utf8");
const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
for (const loc of locs) {
  if (!loc.startsWith(ORIGIN)) {
    fail("sitemap origin", loc);
    continue;
  }
  const path = loc.slice(ORIGIN.length) || "/";
  const target = join(site, path.replace(/^\//, ""));
  const ok = existsSync(target) && (statSync(target).isFile() || existsSync(join(target, "index.html")));
  if (!ok) fail("sitemap entry has no page", loc);
}

// 4. build token present on JS/CSS references
const token = readFileSync(join(site, "index.html"), "utf8").match(/\/assets\/[^"?]+\.(?:js|css)\?v=([0-9a-f]{8})/)?.[1];
if (!token) fail("build token", "no ?v= token found in index.html");
else {
  for (const file of htmlFiles) {
    const html = readFileSync(file, "utf8");
    for (const m of html.matchAll(/(?:src|href)="\/assets\/[^"?]+\.(?:js|css)\?v=([0-9a-f]{8})"/g)) {
      if (m[1] !== token) fail("stale asset token", `${rel(file)}: ${m[1]} != ${token}`);
    }
  }
}

// 5. 404 pair must stay in sync
const a = readFileSync(join(site, "404.html"), "utf8");
const b = readFileSync(join(site, "404/index.html"), "utf8");
if (a !== b) fail("404 drift", "site/404.html differs from site/404/index.html");

// report
const counts = problems.reduce((acc, p) => ({ ...acc, [p.check]: (acc[p.check] ?? 0) + 1 }), {});
if (problems.length) {
  for (const p of problems.slice(0, 40)) console.log(`FAIL [${p.check}] ${p.detail}`);
  if (problems.length > 40) console.log(`... and ${problems.length - 40} more`);
  console.log(`\n${problems.length} problem(s):`, counts);
  process.exit(1);
}
console.log(
  `OK  ${htmlFiles.length} pages · ${refCount} internal refs · ${locs.length} sitemap URLs · token ${token}`,
);
