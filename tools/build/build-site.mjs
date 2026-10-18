// Build the self-contained clone site tree: merge mirror + R2 media + local fonts + rewrites.
// Usage: node tools/build/build-site.mjs
import { cp, mkdir, writeFile, readFile, readdir, rm, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { ROOT, UPSTREAM, SITE, at } from "../lib/paths.mjs";

const MIRROR = UPSTREAM;
const META = at("research", "meta");
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const R2_HOSTS = [
  "https://pub-0a31f9a8b1e7482c97358b9371b0c390.r2.dev",
  "https://pub-ae1372de451948ab9a5024ef261735cc.r2.dev",
  "https://pub-af309aad38b04a5288f51e1a0f26f628.r2.dev",
];
const FONTS_CSS_URL = "https://fonts.googleapis.com/css2?family=Epilogue:wght@700;800;900&family=Manrope:wght@200;300;400;500;600;700;800&family=Inter:wght@400;500;600;700&family=Playfair+Display:ital,wght@1,500;1,600;1,700&display=swap";

// ---------- 1. fresh site/ ----------
console.log("[build] cleaning site/");
await rm(SITE, { recursive: true, force: true });
await mkdir(SITE, { recursive: true });

// ---------- 2. copy mirror (routes + assets + root files), excluding _r2 ----------
console.log("[build] copying upstream -> site");
for (const e of await readdir(MIRROR, { withFileTypes: true })) {
  if (e.name === "_r2") continue;
  if (e.name === "tim-kiem-shell.html") continue;
  await cp(path.join(MIRROR, e.name), path.join(SITE, e.name), { recursive: true });
}
// tim-kiem shell
if (existsSync(path.join(MIRROR, "tim-kiem-shell.html"))) {
  await mkdir(path.join(SITE, "tim-kiem"), { recursive: true });
  await cp(path.join(MIRROR, "tim-kiem-shell.html"), path.join(SITE, "tim-kiem", "index.html"));
}

// ---------- 3. merge R2 media (all hosts) into site root ----------
console.log("[build] merging R2 media");
const r2Root = path.join(MIRROR, "_r2");
const collisions = [];
for (const host of await readdir(r2Root)) {
  const base = path.join(r2Root, host);
  const walk = async (dir) => {
    for (const e of await readdir(dir, { withFileTypes: true })) {
      const src = path.join(dir, e.name);
      if (e.isDirectory()) { await walk(src); continue; }
      const rel = path.relative(base, src);
      const dst = path.join(SITE, rel);
      if (existsSync(dst)) collisions.push(rel);
      await mkdir(path.dirname(dst), { recursive: true });
      await cp(src, dst);
    }
  };
  await walk(base);
}
if (collisions.length) console.log("[build] COLLISIONS:", collisions);

// ---------- 4. localize Google Fonts ----------
console.log("[build] fetching Google Fonts css + woff2");
const fontsDir = path.join(SITE, "fonts");
const filesDir = path.join(fontsDir, "files");
await mkdir(filesDir, { recursive: true });
const cssRes = await fetch(FONTS_CSS_URL, { headers: { "User-Agent": UA } });
if (!cssRes.ok) throw new Error("fonts css HTTP " + cssRes.status);
let fontsCss = await cssRes.text();
const woffUrls = [...new Set([...fontsCss.matchAll(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/g)].map(m => m[1]))];
console.log(`[build] ${woffUrls.length} font files`);
let fi = 0;
await Promise.all(Array.from({ length: 8 }, async () => {
  while (fi < woffUrls.length) {
    const u = woffUrls[fi++];
    const name = u.split("/").pop();
    const dst = path.join(filesDir, name);
    if (!existsSync(dst)) {
      const r = await fetch(u, { headers: { "User-Agent": UA } });
      if (!r.ok) throw new Error("font HTTP " + r.status + " " + u);
      await writeFile(dst, Buffer.from(await r.arrayBuffer()));
    }
    fontsCss = fontsCss.split(u).join("./files/" + name);
  }
}));
await writeFile(path.join(fontsDir, "fonts.css"), fontsCss, "utf8");

// ---------- 5. rewrites across site ----------
console.log("[build] rewriting third-party hosts -> local");
const FONT_LINK_RE = new RegExp(`href="${FONTS_CSS_URL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`, "g");
const DROP_LINE_RE = /^\s*<link rel="(?:preconnect|dns-prefetch)"[^>]*(?:fonts\.googleapis\.com|fonts\.gstatic\.com|googletagmanager\.com|google-analytics\.com)[^>]*\/?>\s*$/gm;

let stats = { files: 0, r2Rewrites: 0, fontRewrites: 0, dropped: 0 };
const walkSite = async (dir) => {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { await walkSite(p); continue; }
    if (!/\.(html|js|css|json|xml|txt)$/i.test(e.name)) continue;
    let t = await readFile(p, "utf8");
    const before = t;
    for (const h of R2_HOSTS) {
      const parts = t.split(h);
      if (parts.length > 1) { stats.r2Rewrites += parts.length - 1; t = parts.join(""); }
    }
    const fparts = t.split(FONTS_CSS_URL);
    if (fparts.length > 1) { stats.fontRewrites += fparts.length - 1; t = fparts.join("/fonts/fonts.css"); }
    const dropMatches = t.match(DROP_LINE_RE);
    if (dropMatches) { stats.dropped += dropMatches.length; t = t.replace(DROP_LINE_RE, ""); }
    if (t !== before) { await writeFile(p, t, "utf8"); stats.files++; }
  }
};
await walkSite(SITE);

// ---------- 6. summary ----------
let totalFiles = 0, totalBytes = 0;
const count = async (dir) => {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { await count(p); continue; }
    totalFiles++;
    totalBytes += (await stat(p)).size;
  }
};
await count(SITE);
console.log(`[build] rewrote ${stats.files} files (r2 refs: ${stats.r2Rewrites}, font refs: ${stats.fontRewrites}, dropped hints: ${stats.dropped})`);
console.log(`[build] site: ${totalFiles} files, ${(totalBytes / 1024 / 1024).toFixed(1)} MB`);
await writeFile(path.join(META, "build-site-report.json"), JSON.stringify({ ...stats, totalFiles, totalBytes }, null, 2));
