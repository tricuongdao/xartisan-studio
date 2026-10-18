// Extract structured content data from the beautified bundles into data/*.json
// Usage: node tools/build/extract-data.mjs
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { RESEARCH, at } from "../lib/paths.mjs";

const B = path.join(RESEARCH, "beautified");
const META = at("research", "meta");
const OUT = at("data");
await mkdir(OUT, { recursive: true });

// --- helper: extract a balanced JSON-ish literal starting at index of `start` ---
function extractLiteral(text, startIdx) {
  const openIdx = text.indexOf("[", startIdx);
  if (openIdx < 0) throw new Error("no array start");
  let depth = 0, i = openIdx, inStr = null, esc = false;
  for (; i < text.length; i++) {
    const c = text[i];
    if (inStr) {
      if (esc) { esc = false; continue; }
      if (c === "\\") { esc = true; continue; }
      if (c === inStr) inStr = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") { inStr = c; continue; }
    if (c === "[" || c === "{") depth++;
    if (c === "]" || c === "}") { depth--; if (depth === 0) { i++; break; } }
  }
  return text.slice(openIdx, i);
}

const evalLiteral = (lit) => new Function("return (" + lit + ");")();

// --- posts ---
const postsSrc = await readFile(path.join(B, "blogPosts-BytO_tYi.js"), "utf8");
const postsLit = extractLiteral(postsSrc, 0);
const posts = evalLiteral(postsLit);
console.log(`[data] posts: ${posts.length}`);
await writeFile(path.join(OUT, "posts.json"), JSON.stringify(posts, null, 2));
await writeFile(path.join(OUT, "posts.ts"), `// Auto-extracted from the site's compiled bundle (blogPosts chunk). Content is verbatim.
export const posts = ${postsLit} as const;
`);

// --- projects: find array with slug+title+image entries in Projects chunk or index bundle ---
const candidates = [
  ["Projects-C0kpfK7V.js", ["du-an"]],
  ["index-DAfw2Y79.js", ["du-an", "projects"]],
];
let projects = null;
for (const [file, _] of candidates) {
  const t = await readFile(path.join(B, file), "utf8");
  // look for the R2 projects base then the data array near it
  const idx = t.search(/uploads\/ximitech\/projects/);
  if (idx < 0) continue;
  // search around for an array of objects containing "slug:" and "image:"
  const re = /\bslug:\s*"/g;
  let m, trial = null;
  while ((m = re.exec(t))) {
    const objStart = t.lastIndexOf("{", m.index);
    const arrStart = t.lastIndexOf("[", objStart);
    if (arrStart < 0) continue;
    const lit = extractLiteral(t, arrStart === -1 ? objStart : arrStart);
    try {
      const v = evalLiteral(lit);
      if (Array.isArray(v) && v.length >= 20 && v[0] && typeof v[0] === "object" && ("slug" in v[0] || "title" in v[0])) { trial = v; break; }
    } catch {}
  }
  if (trial) { projects = trial; console.log(`[data] projects found in ${file}: ${trial.length}`); break; }
}
if (projects) { await writeFile(path.join(OUT, "projects.json"), JSON.stringify(projects, null, 2)); }
else {
  // fallback: derive slug list from sitemap so downstream tooling still has an index
  const sitemap = await readFile(path.join(META, "sitemap.xml"), "utf8");
  const slugs = [...sitemap.matchAll(/<loc>https:\/\/ximitech\.vn\/du-an\/([^<]+)<\/loc>/g)].map(m => m[1]);
  await writeFile(path.join(OUT, "project-slugs.json"), JSON.stringify(slugs, null, 2));
  console.log(`[data] projects array not located; wrote ${slugs.length} slugs instead`);
}

// --- brand/company block from main bundle ---
const main = await readFile(path.join(B, "index-DAfw2Y79.js"), "utf8");
const bi = main.indexOf("leadingSince");
if (bi > 0) {
  const objStart = main.lastIndexOf("{", bi);
  const lit = extractLiteral(main, objStart);
  try {
    const brand = evalLiteral(lit);
    await writeFile(path.join(OUT, "brand.json"), JSON.stringify(brand, null, 2));
    console.log("[data] brand block extracted");
  } catch (e) { console.log("[data] brand parse failed:", String(e).slice(0, 80)); }
}
console.log("[data] done -> data/");
