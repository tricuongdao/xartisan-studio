// Cache-bust the translated build: append a content hash to every asset URL so browsers
// that cached the origin's immutable bundles must fetch the new ones.
// Usage: node tools/i18n/version-assets.mjs
import { readFile, writeFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";

const SITE = path.resolve("site");
const ASSETS = path.join(SITE, "assets");
const files = (await readdir(ASSETS)).filter((f) => f.endsWith(".js") || f.endsWith(".css")).sort();

const h = createHash("sha256");
// Bump this whenever brand images change: the JS hash must change so cached bundles
// that still point at old image URLs are refetched.
h.update("xartisan-brand-3");
for (const f of files) {
  // strip any previous cache-buster so re-running is stable
  h.update(f).update((await readFile(path.join(ASSETS, f), "utf8")).replace(/\?v=[0-9a-f]{8}/g, ""));
}
const ver = h.digest("hex").slice(0, 8);
console.log(`asset version: ${ver} (${files.length} files)`);

async function listHtml() {
  const out = [];
  const walk = async (dir) => {
    for (const e of await readdir(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) await walk(p);
      else if (e.name.endsWith(".html")) out.push(p);
    }
  };
  await walk(SITE);
  return out;
}

// 1) HTML: /assets/<name> -> /assets/<name>?v=<ver>
let htmlFiles = 0, htmlRefs = 0;
for (const abs of await listHtml()) {
  let src = await readFile(abs, "utf8");
  const before = src;
  src = src.replace(/\/assets\/([\w.-]+\.(?:js|css))(?!\?)/g, (m, f) => {
    htmlRefs++;
    return `/assets/${f}?v=${ver}`;
  });
  if (src !== before) { await writeFile(abs, src); htmlFiles++; }
}
console.log(`HTML: ${htmlRefs} asset URLs versioned in ${htmlFiles} files`);

// 2) JS: relative import specifiers ./<name> -> ./<name>?v=<ver>
let jsFiles = 0, jsRefs = 0;
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
for (const f of files.filter((x) => x.endsWith(".js"))) {
  const abs = path.join(ASSETS, f);
  let src = await readFile(abs, "utf8");
  const before = src;
  for (const target of files.filter((x) => x.endsWith(".js"))) {
    const re = new RegExp(`\\./${esc(target)}(?!\\?)`, "g");
    src = src.replace(re, () => { jsRefs++; return `./${target}?v=${ver}`; });
  }
  if (src !== before) { await writeFile(abs, src); jsFiles++; }
}
console.log(`JS: ${jsRefs} import specifiers versioned in ${jsFiles} files`);

// 3) Brand images: content-hash so a cached old logo cannot survive a rebrand.
const brandImages = [
  "xartisan-logo.webp", "xartisan-logo-light.webp", "xartisan-mark.webp",
  "xartisan-logo-header.webp", "xartisan-logo-header-light.webp",
  "loader-logo.png", "whatsapp-icon.png", "OG.png", "favicon.ico",
  "logo.png", "logo192.png", "logo512.png", "apple-touch-icon.png",
];
const fileHash = async (name) => {
  const buf = await readFile(path.join(SITE, name));
  return createHash("sha256").update(buf).digest("hex").slice(0, 8);
};
let imgRefs = 0, imgFiles = 0;
const targets = [...(await listHtml()), ...files.filter((x) => x.endsWith(".js")).map((f) => path.join(ASSETS, f))];
for (const abs of targets) {
  let src = await readFile(abs, "utf8");
  const before = src;
  for (const name of brandImages) {
    const v = await fileHash(name);
    const re = new RegExp(`/${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?!\\?)`, "g");
    src = src.replace(re, () => { imgRefs++; return `/${name}?v=${v}`; });
  }
  if (src !== before) { await writeFile(abs, src); imgFiles++; }
}
console.log(`images: ${imgRefs} brand URLs versioned in ${imgFiles} files`);

// 4) Uploaded media: one shared build hash so freshly re-lettered mockups cannot be cached.
const uploadRe = /\/uploads\/[A-Za-z0-9._~%\-/]+\.(?:webp|jpe?g|png|gif|svg|mp4|webm)(?!\?)/g;
let upRefs = 0, upFiles = 0;
for (const abs of targets) {
  const src = await readFile(abs, "utf8");
  const out = src.replace(uploadRe, (m) => { upRefs++; return `${m}?v=${ver}`; });
  if (out !== src) { await writeFile(abs, out); upFiles++; }
}
console.log(`uploads: ${upRefs} media URLs versioned in ${upFiles} files`);
