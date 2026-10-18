// Aggregate crawl outputs -> union of asset URLs -> download into upstream
import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { UPSTREAM, RESEARCH, at } from "../lib/paths.mjs";

const CRAWL = path.join(RESEARCH, "crawl");
const ROOT = UPSTREAM;
const META = at("research", "meta");
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const files = (await readdir(CRAWL)).filter(f => f.endsWith(".json") && !f.startsWith("_"));
const urlToRoutes = new Map(); // url -> Set(routes)
for (const f of files) {
  const j = JSON.parse(await readFile(path.join(CRAWL, f), "utf8"));
  for (const u of j.urls) {
    if (!urlToRoutes.has(u)) urlToRoutes.set(u, new Set());
    urlToRoutes.get(u).add(j.route);
  }
}
console.log(`[union] ${urlToRoutes.size} unique urls across ${files.length} routes`);

const SKIP = [/googletagmanager\.com/, /google-analytics\.com/, /fonts\.googleapis\.com/, /fonts\.gstatic\.com/, /facebook\.net/, /zalo\.me/];
const IMG = /\.(png|jpe?g|webp|avif|gif|svg|ico|woff2?|ttf|otf|mp4|webm)(\?|$)/i;
const JS = /\.js(\?|$)/i;
const CSS = /\.css(\?|$)/i;

function localPath(u) {
  const url = new URL(u);
  if (url.hostname === "ximitech.vn") return path.join(ROOT, decodeURIComponent(url.pathname));
  if (url.hostname.endsWith("r2.dev")) return path.join(ROOT, "_r2", url.hostname.split(".")[0], decodeURIComponent(url.pathname).replace(/^\//, ""));
  return null;
}

const toDownload = [];
for (const [u, routes] of urlToRoutes) {
  if (SKIP.some(r => r.test(u))) continue;
  const u2 = u.split("#")[0];
  if (!(IMG.test(u2) || JS.test(u2) || CSS.test(u2))) continue;
  const lp = localPath(u2);
  if (!lp) { console.log("SKIP host:", u2.slice(0, 100)); continue; }
  toDownload.push({ url: u2, file: lp, routes: [...routes] });
}
console.log(`[union] to download: ${toDownload.length}`);

async function fetchTo(url, filePath) {
  for (let a = 1; a <= 3; a++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA } });
      if (!res.ok) throw new Error("HTTP " + res.status);
      await mkdir(path.dirname(filePath), { recursive: true });
      const buf = Buffer.from(await res.arrayBuffer());
      await writeFile(filePath, buf);
      return { ok: true, bytes: buf.length };
    } catch (e) {
      if (a === 3) return { ok: false, error: String(e) };
      await new Promise(r => setTimeout(r, 250 * a));
    }
  }
}

const results = [];
let i = 0, ok = 0, cached = 0, fail = 0;
const worker = async () => {
  while (i < toDownload.length) {
    const idx = i++;
    const j = toDownload[idx];
    if (existsSync(j.file) && (await stat(j.file)).size > 0) {
      results.push({ ...j, ok: true, cached: true });
      cached++; continue;
    }
    const r = await fetchTo(j.url, j.file);
    if (r.ok) ok++; else { fail++; console.log("FAIL:", j.url, r.error); }
    results.push({ ...j, ...r });
  }
};
await Promise.all(Array.from({ length: 8 }, worker));
console.log(`[union] downloaded new=${ok} cached=${cached} fail=${fail}`);

await writeFile(path.join(META, "asset-union.json"), JSON.stringify({
  total: toDownload.length, newDownloaded: ok, cached, fail,
  items: results.map(r => ({ url: r.url, file: path.relative(ROOT, r.file).replaceAll("\\", "/"), ok: r.ok, bytes: r.bytes, routes: r.routes })),
}, null, 2));
console.log("[union] wrote research/meta/asset-union.json");
