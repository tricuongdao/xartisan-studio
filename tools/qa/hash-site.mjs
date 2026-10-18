// Hash the served site tree (byte manifest + aggregate hash) to prove no changes.
// Usage: node tools/qa/hash-site.mjs [outFile]
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, writeFileSync, statSync } from "node:fs";
import path from "node:path";
import { ROOT, SITE } from "../lib/paths.mjs";

const outFile = process.argv[2] || path.join(ROOT, "research/meta/site-hash-before.txt");
const files = [];
(function walk(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (statSync(p).isFile()) files.push(p);
  }
})(SITE);
files.sort();
const lines = files.map(f => {
  const rel = path.relative(SITE, f).split(path.sep).join("/");
  const hash = createHash("sha256").update(readFileSync(f)).digest("hex");
  return `${hash}  ${rel}`;
});
const treeHash = createHash("sha256").update(lines.join("\n")).digest("hex");
writeFileSync(outFile, lines.join("\n") + "\n");
console.log(JSON.stringify({ files: files.length, treeHash, manifest: path.relative(ROOT, outFile).split(path.sep).join("/") }, null, 2));
