// Aggregate live-vs-clone map comparisons into a summary table.
// Usage: node tools/verify/summary.mjs
import { readFile, writeFile, readdir } from "node:fs/promises";
import path from "node:path";

const DIR = "research/verify";
const parse = (txt) => {
  const docH = Number((/docH=(\d+)/.exec(txt) || [])[1] || 0);
  const nodes = [];
  for (const line of txt.split(/\r?\n/)) {
    const m = /^(\s*)\[([\w.]+)\]\s+h=(\d+)\s+top=(-?\d+)\s+(\w+)\.(.*)$/.exec(line);
    if (m) nodes.push({ path: m[2], h: Number(m[3]), top: Number(m[4]), cls: m[6] });
  }
  return { docH, nodes };
};

const files = (await readdir(DIR)).filter((f) => f.startsWith("live-") && f.endsWith(".txt"));
const rows = [];
for (const lf of files.sort()) {
  const cf = lf.replace(/^live-/, "clone-");
  let liveTxt, cloneTxt;
  try { liveTxt = await readFile(path.join(DIR, lf), "utf8"); cloneTxt = await readFile(path.join(DIR, cf), "utf8"); }
  catch { continue; }
  const A = parse(liveTxt), B = parse(cloneTxt);
  if (!A.docH || !B.docH) continue;
  const byPath = new Map(B.nodes.map((n) => [n.path, n]));
  let matched = 0, worstH = 0, worstHPath = "", maxTop = 0;
  const tops = new Map(A.nodes.map((n) => [n.path, n]));
  for (const n of A.nodes) {
    const o = byPath.get(n.path);
    if (!o) continue;
    matched++;
    if (n.h > 80 && !/absolute|fixed/.test(n.cls)) {
      const p = Math.abs((o.h - n.h) / n.h) * 100;
      if (p > worstH) { worstH = p; worstHPath = n.path; }
    }
    if (n.top > 200) maxTop = Math.max(maxTop, Math.abs(o.top - n.top));
  }
  const name = lf.replace(/^live-/, "").replace(/\.txt$/, "");
  const m = /^(.+)-(\d+)$/.exec(name);
  const slug = m ? m[1] : name;
  const vp = m ? m[2] : "?";
  const route = slug === "home" ? "/" : "/" + slug;
  rows.push({ route, viewport: vp, live: A.docH, clone: B.docH,
    deltaPct: ((B.docH - A.docH) / A.docH) * 100, nodes: `${matched}/${A.nodes.length}`, worstH, worstHPath, maxTop });
}
rows.sort((a, b) => a.viewport.localeCompare(b.viewport) || a.route.localeCompare(b.route));
let md = "| route | viewport | docH live | docH clone | delta | nodes | worst text-block height delta | max top shift |\n|---|---|---|---|---|---|---|---|\n";
for (const r of rows) {
  md += `| ${r.route} | ${r.viewport} | ${r.live} | ${r.clone} | ${r.deltaPct >= 0 ? "+" : ""}${r.deltaPct.toFixed(2)}% | ${r.nodes} | ${r.worstH.toFixed(1)}% (${r.worstHPath}) | ${r.maxTop}px |\n`;
}
await writeFile(path.join(DIR, "summary.md"), md);
await writeFile(path.join(DIR, "summary.json"), JSON.stringify(rows, null, 2));
console.log(md);
