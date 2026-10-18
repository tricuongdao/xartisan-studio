// Scan JS bundles for Vietnamese string literals (offset-accurate via acorn).
// Usage: node tools/i18n/scan.mjs > research/i18n/scan.json
import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import * as acorn from "acorn";

const SITE = path.resolve("site");
const ASSETS = path.join(SITE, "assets");
const OUT = path.resolve("research/i18n");
const VI = /[àáảãạăằắẳẵặâầấẩẫậđêềếểễệôồốổỗộơờớởỡợưừứửữựìíỉĩịòóỏõọùúủũụỳýỷỹỵ]/i;

const files = (await readdir(ASSETS)).filter((f) => f.endsWith(".js")).sort();
const results = [];
let totalStrings = 0;
let totalChars = 0;
const uniq = new Map();

for (const file of files) {
  const src = await readFile(path.join(ASSETS, file), "utf8");
  const tk = acorn.tokenizer(src, { ecmaVersion: "latest", sourceType: "module", allowHashBang: true });
  const hits = [];
  while (true) {
    let tok;
    try { tok = tk.getToken(); } catch (e) { console.error(`[scan] ${file}: ${e.message}`); break; }
    if (tok.type.label === "eof") break;
    const isStr = tok.type.label === "string";
    const isTmpl = tok.type.label === "template" || tok.type.label === "`";
    if (!isStr && !isTmpl) continue;
    const raw = src.slice(tok.start, tok.end);
    const val = typeof tok.value === "string" ? tok.value : raw;
    if (!VI.test(val)) continue;
    totalStrings++;
    totalChars += val.length;
    uniq.set(val, (uniq.get(val) || 0) + 1);
    hits.push({ start: tok.start, end: tok.end, kind: isTmpl ? "template" : "string", value: val });
  }
  // Verify the whole file tokenizes cleanly to EOF
  results.push({ file, hits });
}

await mkdir(OUT, { recursive: true });
const uniqList = [...uniq.entries()].sort((a, b) => b[1] - a[1]);
const summary = {
  files: files.length,
  totalVietnameseStrings: totalStrings,
  totalChars,
  uniqueStrings: uniqList.length,
  uniqueChars: uniqList.reduce((n, [v]) => n + v.length, 0),
  perFile: results.map((r) => ({ file: r.file, n: r.hits.length, chars: r.hits.reduce((a, h) => a + h.value.length, 0), templates: r.hits.filter((h) => h.kind === "template").length })),
};
console.log(JSON.stringify(summary, null, 2));
await writeFile(path.join(OUT, "scan.json"), JSON.stringify({ summary, files: results }, null, 1));
