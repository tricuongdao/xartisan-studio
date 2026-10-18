// Probe + download all candidate media from R2 (patterns recovered from bundle analysis)
import { mkdir, writeFile, readdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { UPSTREAM, at } from "../lib/paths.mjs";

const HOST = "https://pub-0a31f9a8b1e7482c97358b9371b0c390.r2.dev";
const HOST3 = "https://pub-af309aad38b04a5288f51e1a0f26f628.r2.dev";
const R2ROOT = path.join(UPSTREAM, "_r2");
const META = at("research", "meta");
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

// project slugs from sitemap
const sitemap = await readFile(path.join(META, "sitemap.xml"), "utf8");
const slugs = [...sitemap.matchAll(/<loc>https:\/\/ximitech\.vn\/du-an\/([^<]+)<\/loc>/g)].map(m => m[1]);
console.log(`[probe] ${slugs.length} project slugs`);

const candidates = new Set();
// project image variants
for (const s of slugs) for (const n of [640, 1280, 1920, 2880]) candidates.add(`${HOST}/uploads/ximitech/projects/v2/${s}-${n}.webp`);
// gallery
for (let i = 1; i <= 40; i++) candidates.add(`${HOST}/uploads/ximitech/kho-giao-dien/v1/${i}.webp`);
// videos
for (const f of [
  "hero/hero-bg-light.webm","hero/hero-bg-light.mp4","hero/hero-bg-light.jpg",
  "hero/hero-bg-light-mobile.mp4","hero/hero-bg-light-mobile.jpg",
  "hero/hero-bg-dark.webm","hero/hero-bg-dark.mp4","hero/hero-bg-dark.jpg",
  "hero/hero-bg-dark-mobile.mp4","hero/hero-bg-dark-mobile.jpg",
  "film/brand-film-16x9.mp4","film/brand-film-16x9.jpg",
  "film/brand-film-9x16.mp4","film/brand-film-9x16.jpg",
]) candidates.add(`${HOST}/uploads/ximitech/video/v1/${f}`);
// company profile
for (const f of ["tranthanhdo.webp","ximitech-profile-cover.webp"]) candidates.add(`${HOST}/uploads/ximitech/company-profile/v1/${f}`);

let missing = 0, present = 0, downloaded = 0, dlBytes = 0;
const rows = [];
async function head(url) {
  try {
    const res = await fetch(url, { method: "HEAD", headers: { "User-Agent": UA } });
    return res.status;
  } catch { return 0; }
}
async function dl(url) {
  const u = new URL(url);
  const local = path.join(R2ROOT, u.hostname.split(".")[0], decodeURIComponent(u.pathname).replace(/^\//, ""));
  if (existsSync(local) && (await stat(local)).size > 0) return { local, cached: true, bytes: (await stat(local)).size };
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error("HTTP " + res.status);
  const buf = Buffer.from(await res.arrayBuffer());
  await mkdir(path.dirname(local), { recursive: true });
  await writeFile(local, buf);
  return { local, cached: false, bytes: buf.length };
}

const list = [...candidates];
let i = 0;
await Promise.all(Array.from({ length: 8 }, async () => {
  while (i < list.length) {
    const url = list[i++];
    const st = await head(url);
    if (st !== 200) { missing++; rows.push({ url, status: st }); continue; }
    present++;
    try {
      const r = await dl(url);
      if (!r.cached) { downloaded++; dlBytes += r.bytes; console.log(`  + ${url.replace(HOST, "")} (${(r.bytes/1024/1024).toFixed(2)} MB)`); }
    } catch (e) { rows.push({ url, error: String(e) }); }
  }
}));
console.log(`[probe] present=${present} missing=${missing} downloaded=${downloaded} bytes=${(dlBytes/1024/1024).toFixed(2)}MB`);
await writeFile(path.join(META, "media-probe.json"), JSON.stringify(rows, null, 1));
