// Pixel-diff live vs clone screenshots. Usage: node tools/qa/diff-shots.mjs
import { readFile, writeFile, readdir, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { RESEARCH, at } from "../lib/paths.mjs";

const require2 = createRequire(import.meta.url);
const nm = at("tools", "qa", "vendor", "node_modules");
const { PNG } = require2(path.join(nm, "pngjs"));
const pixelmatch = (await import("file://" + path.join(nm, "pixelmatch/index.js"))).default;

const LIVE = path.join(RESEARCH, "shots");
const CLONE = path.join(RESEARCH, "cloneshots");
const OUT = path.join(RESEARCH, "diffs");
await mkdir(OUT, { recursive: true });

// clone slug -> live slug
const PAIRS = [
  ["root-1440-full", "root-1440-full"],
  ["thiet-ke-website-1440-full", "thiet-ke-website-1440-full"],
  ["bang-gia-1440-full", "bang-gia-thiet-ke-website-1440-full"],
  ["gioi-thieu-1440-full", "gioi-thieu-1440-full"],
  ["ho-so-nang-luc-1440-full", "ho-so-nang-luc-1440-full"],
  ["lien-he-1440-full", "lien-he-1440-full"],
  ["tuyen-dung-1440-full", "tuyen-dung-1440-full"],
  ["quy-trinh-1440-full", "quy-trinh-thiet-ke-website-1440-full"],
  ["bao-hanh-1440-full", "bao-hanh-bao-tri-website-1440-full"],
  ["privacy-policy-1440-full", "privacy-policy-1440-full"],
  ["terms-1440-full", "terms-1440-full"],
  ["tim-kiem-1440-full", "tim-kiem-1440-full"],
  ["tim-kiem-q-1440-full", "tim-kiem-q-1440-full"],
  ["du-an-list-1440-full", "du-an-list-1440-full"],
  ["du-an-woodland-1440-full", "du-an-woodland-1440-full"],
  ["du-an-vinhomes-1440-full", "du-an-vinhomes-1440-full"],
  ["blog-list-1440-full", "blog-list-1440-full"],
  ["blog-page2-1440-full", "blog-page2-1440-full"],
  ["blogpost-landing-1440-full", "blogpost-landing-1440-full"],
  ["blogpost-ngansach-1440-full", "blogpost-ngansach-1440-full"],
];

const results = [];
const rng = process.argv.slice(2).map(Number);
const from = rng[0] ?? 0;
const to = rng[1] ?? PAIRS.length;
for (const [cloneSlug, liveSlug] of PAIRS.slice(from, to)) {
  const a = path.join(LIVE, liveSlug + ".png");
  const b = path.join(CLONE, cloneSlug + ".png");
  if (!existsSync(a) || !existsSync(b)) { results.push({ slug: liveSlug, error: "missing file" }); continue; }
  try {
    const imgA = PNG.sync.read(await readFile(a));
    const imgB = PNG.sync.read(await readFile(b));
    if (imgA.width !== imgB.width || imgA.height !== imgB.height) {
      results.push({ slug: liveSlug, sizeMismatch: `${imgA.width}x${imgA.height} vs ${imgB.width}x${imgB.height}` });
      console.log(`${liveSlug}: SIZE MISMATCH ${imgA.width}x${imgA.height} vs ${imgB.width}x${imgB.height}`);
      continue;
    }
    const diff = new PNG({ width: imgA.width, height: imgA.height });
    const n = pixelmatch(imgA.data, imgB.data, diff.data, imgA.width, imgA.height, { threshold: 0.1 });
    const pct = (n / (imgA.width * imgA.height)) * 100;
    await writeFile(path.join(OUT, liveSlug + ".diff.png"), PNG.sync.write(diff));
    results.push({ slug: liveSlug, diffPixels: n, pct: +pct.toFixed(3), size: `${imgA.width}x${imgA.height}` });
    console.log(`${liveSlug}: ${pct.toFixed(3)}% differing (${n} px) of ${imgA.width}x${imgA.height}`);
  } catch (e) {
    results.push({ slug: liveSlug, error: String(e).slice(0, 120) });
    console.log(`${liveSlug}: ERROR ${String(e).slice(0, 120)}`);
  }
}
await writeFile(path.join(OUT, "_summary.json"), JSON.stringify(results, null, 2));
