// Mirror ximitech.vn: all routes, all assets, all images.
// Usage: node tools/sync/mirror.mjs
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { UPSTREAM, at } from "../lib/paths.mjs";

const ORIGIN = "https://ximitech.vn";
const R2DEV = "https://pub-0a31f9a8b1e7482c97358b9371b0c390.r2.dev";
const ROOT = UPSTREAM;                 // raw snapshot target
const META = at("research", "meta");   // sitemap + manifest live here
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const ASSET_FILES = [
  "index-DAfw2Y79.js","index-BT757EXe.css","vendor-react-BaqgPuim.js","vendor-radix-CIIFFl0l.js",
  "vendor-icons-xx0BMbwT.js","vendor-motion-B2aXCTtA.js","Blog-s__qQNIp.js","SeoLayout-CuGaHTIj.js",
  "blog-CE27P5gZ.js","blogPosts-BytO_tYi.js","BlogCover-DaspM6LB.js","BlogPost-DdsJrswq.js",
  "CapabilityProfile-DePoOAgZ.js","CurtainChapter-Q8xUbhSg.js","Careers-B2s3_nRn.js","CompanyPage-BQ4Zl90y.js",
  "MarketingPage-BLJ5g1qS.js","NotFound-ChbCxhR4.js","PrivacyPolicy-B70vyD1l.js","ProjectDetail-DyXWaEkD.js",
  "Projects-C0kpfK7V.js","SearchPage-CSDOjFZF.js","Terms-DUW2xTNl.js","chatbotKnowledge-CK2UAvVi.js","WorkGallery-CyYN0KRM.js","vendor-three-nfDmK6kc.js","world-CfZ9xr8b.js"
];

const ROOT_FILES = ["robots.txt","sitemap.xml","favicon.ico","apple-touch-icon.png","OG.png","logo.png","logo192.png","logo512.png","ximitech-logo.webp"];

const IMG_EXT = /\.(png|jpe?g|webp|avif|gif|svg|ico|woff2?|ttf|otf|mp4|webm|css|js|json|xml|txt)(\?[^"')\s]*)?$/i;

function cleanUrl(u) {
  return u.split("#")[0];
}

async function fetchTo(url, filePath, { text = false } = {}) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await mkdir(path.dirname(filePath), { recursive: true });
      if (text) {
        const t = await res.text();
        await writeFile(filePath + ".txt", t, "utf8");
        return { ok: true, url, bytes: Buffer.byteLength(t) };
      }
      const buf = Buffer.from(await res.arrayBuffer());
      await writeFile(filePath, buf);
      return { ok: true, url, bytes: buf.length };
    } catch (e) {
      if (attempt === 3) return { ok: false, url, error: String(e) };
      await new Promise(r => setTimeout(r, 300 * attempt));
    }
  }
}

async function runPool(items, worker, concurrency = 6) {
  const results = [];
  let i = 0;
  const next = async () => {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await worker(items[idx], idx);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, next));
  return results;
}

// ---------- 1. routes ----------
const sitemap = await readFile(path.join(META, "sitemap.xml"), "utf8");
const routes = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
const routePaths = routes.map(u => new URL(u).pathname.replace(/\/$/, "") || "/");
console.log(`[mirror] ${routePaths.length} routes`);

let pageResults = await runPool(routePaths, async (p) => {
  const file = p === "/" ? path.join(ROOT, "index.html") : path.join(ROOT, p.replace(/^\//, ""), "index.html");
  const r = await fetchTo(ORIGIN + p, file);
  return { route: p, ...r };
}, 6);
const pagesOk = pageResults.filter(r => r.ok).length;
console.log(`[mirror] pages ok ${pagesOk}/${routePaths.length}`);
const failedPages = pageResults.filter(r => !r.ok);
if (failedPages.length) console.log("FAILED PAGES:", JSON.stringify(failedPages, null, 2));

// ---------- 2. root files + assets ----------
let misc = await runPool([...ROOT_FILES.map(f => ({ url: `${ORIGIN}/${f}`, file: path.join(ROOT, f) })),
  ...ASSET_FILES.map(f => ({ url: `${ORIGIN}/assets/${f}`, file: path.join(ROOT, "assets", f) }))],
  async (j) => ({ ...(await fetchTo(j.url, j.file)), file: j.file }), 6);
console.log(`[mirror] misc ok ${misc.filter(r => r.ok).length}/${misc.length}`);

// ---------- 3. discover referenced assets in html/css/js ----------
const discovered = new Map(); // absolute url -> local file
function addUrl(u, base) {
  try {
    if (!u) return;
    u = u.trim().replace(/^['"]|['"]$/g, "");
    if (u.startsWith("data:") || u.startsWith("blob:") || u.startsWith("mailto:") || u.startsWith("tel:")) return;
    if (u.startsWith("//")) u = "https:" + u;
    let abs;
    if (u.startsWith("http")) abs = u;
    else if (u.startsWith("/")) abs = ORIGIN + u;
    else abs = new URL(u, base).href;
    const url = new URL(abs);
    if (!IMG_EXT.test(url.pathname)) return;
    if (url.hostname.endsWith("googletagmanager.com") || url.hostname.endsWith("google-analytics.com")) return;
    if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") return; // fonts handled separately
    let local;
    if (url.hostname === new URL(ORIGIN).hostname) local = path.join(ROOT, decodeURIComponent(url.pathname));
    else if (url.hostname === new URL(R2DEV).hostname) local = path.join(ROOT, "_r2", decodeURIComponent(url.pathname).replace(/^\//, ""));
    else return; // only mirror known hosts
    discovered.set(url.href, local);
  } catch {}
}

// collect candidate text from mirrored html/css/js
async function scanText(text, base) {
  // html attrs
  for (const m of text.matchAll(/(?:src|href|poster|content)="([^"]+)"/g)) addUrl(m[1], base);
  for (const m of text.matchAll(/srcset="([^"]+)"/g)) {
    for (const part of m[1].split(",")) addUrl(part.trim().split(/\s+/)[0], base);
  }
  // css url()
  for (const m of text.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)) addUrl(m[1], base);
  // js quoted strings that look like asset urls
  for (const m of text.matchAll(/["'`](\/[^"'`\s]+\.(?:png|jpe?g|webp|avif|gif|svg|ico|woff2?|ttf|mp4|webm))["'`]/g)) addUrl(m[1], base);
  for (const m of text.matchAll(/["'`](https?:\/\/[^"'`\s]+\.(?:png|jpe?g|webp|avif|gif|svg|ico|woff2?|ttf|mp4|webm))["'`]/g)) addUrl(m[1], base);
  for (const m of text.matchAll(/(?:https?:)?\/\/pub-[0-9a-f]+\.r2\.dev\/[^"'`\s)\]]+/g)) addUrl(m[0], base);
}

const { readdir } = await import("node:fs/promises");
async function walk(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...await walk(p));
    else out.push(p);
  }
  return out;
}

const allFiles = await walk(ROOT);
for (const f of allFiles) {
  if (/\.(html|css|js)$/.test(f)) {
    const t = await readFile(f, "utf8");
    await scanText(t, ORIGIN + "/");
  }
}
console.log(`[mirror] discovered ${discovered.size} candidate asset urls`);

// ---------- 4. download discovered ----------
const dlItems = [...discovered.entries()].map(([url, file]) => ({ url, file }));
const dlResults = await runPool(dlItems, async (j) => {
  if (existsSync(j.file)) {
    const { stat } = await import("node:fs/promises");
    const s = await stat(j.file);
    if (s.size > 0) return { ok: true, url: j.url, cached: true, bytes: s.size };
  }
  return { ...(await fetchTo(j.url, j.file)), url: j.url, file: j.file };
}, 6);
const dlFail = dlResults.filter(r => !r.ok);
console.log(`[mirror] assets downloaded ok ${dlResults.length - dlFail.length}/${dlResults.length}`);
if (dlFail.length) console.log("FAILED ASSETS:", JSON.stringify(dlFail.slice(0, 40), null, 2));

// ---------- 5. write manifest ----------
const manifest = {
  routeCount: routePaths.length,
  pages: pageResults,
  misc,
  discovered: [...discovered.entries()].map(([url, file]) => ({ url, file })),
  downloaded: dlResults.map(r => ({ url: r.url, file: r.file, ok: r.ok, bytes: r.bytes, cached: !!r.cached })),
};
await writeFile(path.join(META, "mirror-manifest.json"), JSON.stringify(manifest, null, 2));
console.log("[mirror] manifest written to research/meta/mirror-manifest.json");
