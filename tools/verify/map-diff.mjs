// Compare two section maps produced by tools/qa/map.mjs (same viewport).
// Usage: node tools/verify/map-diff.mjs live.txt clone.txt
import { readFile } from "node:fs/promises";

const parse = (txt) => {
  const lines = txt.split(/\r?\n/);
  const docH = Number((/docH=(\d+)/.exec(txt) || [])[1] || 0);
  const nodes = [];
  for (const line of lines) {
    const m = /^(\s*)\[([\w.]+)\]\s+h=(\d+)\s+top=(-?\d+)\s+(\w+)\.(.*)$/.exec(line);
    if (m) nodes.push({ depth: m[1].length / 2, path: m[2], h: Number(m[3]), top: Number(m[4]), tag: m[5], cls: m[6] });
  }
  return { docH, nodes };
};

const [a, b] = await Promise.all([readFile(process.argv[2], "utf8"), readFile(process.argv[3], "utf8")]);
const A = parse(a), B = parse(b);
const byPathB = new Map(B.nodes.map((n) => [n.path, n]));
let matched = 0, missing = [], hDeltas = [], topDeltas = [];
for (const n of A.nodes) {
  const o = byPathB.get(n.path);
  if (!o) { missing.push(n.path); continue; }
  matched++;
  if (Math.abs(n.top) > 20) topDeltas.push({ path: n.path, live: n.top, clone: o.top, d: o.top - n.top });
  if (n.h > 40) hDeltas.push({ path: n.path, live: n.h, clone: o.h, pct: ((o.h - n.h) / n.h) * 100 });
}
const worstH = [...hDeltas].sort((x, y) => Math.abs(y.pct) - Math.abs(x.pct)).slice(0, 8);
const worstT = [...topDeltas].sort((x, y) => Math.abs(y.d) - Math.abs(x.d)).slice(0, 8);
console.log(`docH live=${A.docH} clone=${B.docH} delta=${B.docH - A.docH} (${(((B.docH - A.docH) / A.docH) * 100).toFixed(2)}%)`);
console.log(`nodes live=${A.nodes.length} clone=${B.nodes.length} matched=${matched} missing=${missing.length ? missing.join(",") : "none"}`);
console.log(`sections with |height delta| > 6%: ${hDeltas.filter((x) => Math.abs(x.pct) > 6).length} / ${hDeltas.length}`);
for (const x of worstH) console.log(`  H ${x.path} live=${x.live} clone=${x.clone} ${x.pct.toFixed(1)}%`);
console.log(`sections with |top delta| > 40px: ${topDeltas.filter((x) => Math.abs(x.d) > 40).length}`);
for (const x of worstT) console.log(`  T ${x.path} live=${x.live} clone=${x.clone} d=${x.d}`);
