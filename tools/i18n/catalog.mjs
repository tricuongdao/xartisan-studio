// Build the translation catalog: every visible Vietnamese string in JS bundles and HTML shells.
// Usage: node tools/i18n/catalog.mjs
import { readFile, readdir, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import * as acorn from "acorn";
import { parse } from "parse5";

const SITE = path.resolve("site");
const ASSETS = path.join(SITE, "assets");
const OUT = path.resolve("research/i18n");
const VI = /[àáảãạăằắẳẵặâầấẩẫậđêềếểễệôồốổỗộơờớởỡợưừứửữựìíỉĩịòóỏõọùúủũụỳýỷỹỵ]/i;
const SKIP_TAGS = new Set(["script", "style", "template", "code", "pre"]);

// Shader source and other code blocks can contain Vietnamese developer comments.
// Translating those strings would delete the code itself, so never touch them.
function looksLikeCode(t) {
  if (/#define|uniform\s+\w|precision\s+highp|varying\s+\w|gl_FragColor|gl_Position|vec[234]\s+\w|smoothstep\(/.test(t)) return true;
  if (t.length > 400) {
    const vi = (t.match(/[àáảãạăằắẳẵặâầấẩẫậđêềếểễệôồốổỗộơờớởỡợưừứửữựìíỉĩịòóỏõọùúủũụỳýỷỹỵ]/gi) || []).length;
    if (vi / t.length < 0.01) return true;
  }
  return false;
}

const js = [];
const html = [];

/* ---------------- JS ---------------- */
for (const file of (await readdir(ASSETS)).filter((f) => f.endsWith(".js")).sort()) {
  const src = await readFile(path.join(ASSETS, file), "utf8");
  const tk = acorn.tokenizer(src, { ecmaVersion: "latest", sourceType: "module", allowHashBang: true });
  while (true) {
    let tok;
    try { tok = tk.getToken(); } catch (e) { console.error(`[catalog] tokenize ${file}: ${e.message}`); break; }
    if (tok.type.label === "eof") break;
    const isStr = tok.type.label === "string";
    const isTmpl = tok.type.label === "template";
    if (!isStr && !isTmpl) continue;
    const val = typeof tok.value === "string" ? tok.value : src.slice(tok.start, tok.end);
    if (!VI.test(val)) continue;
    if (looksLikeCode(val)) continue;
    js.push({
      file, start: tok.start, end: tok.end,
      kind: isStr ? "string" : "template",
      quote: isStr ? src[tok.start] : "`",
      text: val,
    });
  }
}

/* ---------------- HTML ---------------- */
async function walkHtml() {
  const dirs = [SITE];
  const files = [];
  while (dirs.length) {
    const d = dirs.pop();
    for (const e of await readdir(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) dirs.push(p);
      else if (e.name.endsWith(".html")) files.push(p);
    }
  }
  return files.sort();
}

const ATTRS = new Set(["alt", "title", "aria-label", "aria-valuetext", "placeholder", "content"]);
for (const abs of await walkHtml()) {
  const rel = path.relative(SITE, abs).replaceAll("\\", "/");
  const src = await readFile(abs, "utf8");
  const doc = parse(src, { sourceCodeLocationInfo: true, scriptingEnabled: false });
  const stack = [doc];
  while (stack.length) {
    const node = stack.pop();
    if (node.tagName && SKIP_TAGS.has(node.tagName)) continue;
    if (node.nodeName === "#text" && node.value && VI.test(node.value)) {
      const loc = node.sourceCodeLocation;
      if (loc) {
        const raw = src.slice(loc.startOffset, loc.endOffset);
        html.push({ file: rel, start: loc.startOffset, end: loc.endOffset, kind: "text", text: node.value, raw });
      }
    }
    if (node.tagName && node.attrs) {
      for (const a of node.attrs) {
        if (!ATTRS.has(a.name) || !VI.test(a.value)) continue;
        // meta content is the main case; skip non-visible content attributes
        if (a.name === "content" && node.tagName !== "meta") continue;
        const loc = node.sourceCodeLocation?.attrs?.[a.name];
        if (!loc) continue;
        const tagRaw = src.slice(loc.startOffset, loc.endOffset);
        const eq = tagRaw.indexOf("=");
        if (eq < 0) continue;
        const q = tagRaw[eq + 1];
        if (q !== '"' && q !== "'") continue;
        const valStart = loc.startOffset + eq + 2;
        html.push({ file: rel, start: valStart, end: valStart + a.value.length, kind: "attr", attr: a.name, text: a.value, tag: node.tagName });
      }
    }
    if (node.childNodes) for (const c of node.childNodes) stack.push(c);
    if (node.content && node.content.childNodes) for (const c of node.content.childNodes) stack.push(c);
  }
}

/* ---------------- unique ---------------- */
const uniq = new Map();
for (const e of js.concat(html)) {
  const t = e.text;
  if (!uniq.has(t)) uniq.set(t, { text: t, count: 0, js: 0, html: 0 });
  const u = uniq.get(t);
  u.count++;
  e.kind === "text" || e.kind === "attr" ? u.html++ : u.js++;
}
const unique = [...uniq.values()].sort((a, b) => b.count - a.count);

await mkdir(OUT, { recursive: true });
await writeFile(path.join(OUT, "catalog.json"), JSON.stringify({ js, html, unique }, null, 1));
const stats = {
  jsEntries: js.length, htmlEntries: html.length, unique: unique.length,
  uniqueChars: unique.reduce((n, u) => n + u.text.length, 0),
  jsUnique: unique.filter((u) => u.js).length, htmlOnly: unique.filter((u) => !u.js).length,
};
console.log(JSON.stringify(stats, null, 2));
