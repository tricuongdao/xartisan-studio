// Pixel-diff two shot dirs by matching filenames. Usage: node tools/qa/diff2.mjs <liveDir> <cloneDir> <outDir>
import { readFile, writeFile, readdir, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { at } from "../lib/paths.mjs";

const require2 = createRequire(import.meta.url);
const nm = at("tools", "qa", "vendor", "node_modules");
const { PNG } = require2(path.join(nm, "pngjs"));
const pixelmatch = (await import("file://" + path.join(nm, "pixelmatch/index.js"))).default;

const [LIVE, CLONE, OUT] = process.argv.slice(2);
if (!LIVE || !CLONE || !OUT) { console.error("usage: node tools/qa/diff2.mjs <liveDir> <cloneDir> <outDir>"); process.exit(1); }
await mkdir(OUT, { recursive: true });

const files = (await readdir(CLONE)).filter(f => f.endsWith(".png") && !f.startsWith("_"));
const results = [];
for (const f of files.sort()) {
  const a = path.join(LIVE, f), b = path.join(CLONE, f);
  if (!existsSync(a)) { results.push({ slug: f, error: "no live counterpart" }); continue; }
  try {
    const imgA = PNG.sync.read(await readFile(a));
    const imgB = PNG.sync.read(await readFile(b));
    if (imgA.width !== imgB.width || imgA.height !== imgB.height) {
      results.push({ slug: f, sizeMismatch: `${imgA.width}x${imgA.height} vs ${imgB.width}x${imgB.height}` });
      console.log(`${f}: SIZE MISMATCH ${imgA.width}x${imgA.height} vs ${imgB.width}x${imgB.height}`);
      continue;
    }
    const diff = new PNG({ width: imgA.width, height: imgA.height });
    const n = pixelmatch(imgA.data, imgB.data, diff.data, imgA.width, imgA.height, { threshold: 0.1 });
    const pct = (n / (imgA.width * imgA.height)) * 100;
    await writeFile(path.join(OUT, f.replace(/\.png$/, ".diff.png")), PNG.sync.write(diff));
    results.push({ slug: f, diffPixels: n, pct: +pct.toFixed(3), size: `${imgA.width}x${imgA.height}` });
    console.log(`${f}: ${pct.toFixed(3)}% (${n} px)`);
  } catch (e) {
    results.push({ slug: f, error: String(e).slice(0, 120) });
    console.log(`${f}: ERROR ${String(e).slice(0, 120)}`);
  }
}
await writeFile(path.join(OUT, "_summary.json"), JSON.stringify(results.sort((x, y) => (y.pct || 0) - (x.pct || 0)), null, 2));
console.log("written " + path.join(OUT, "_summary.json"));
