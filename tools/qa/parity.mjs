// Live vs clone parity check: HTTP status + document title + key title markers per path.
// Usage: node tools/qa/parity.mjs [pathsFile]
// Default paths: the parity probe list below.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { RESEARCH } from "../lib/paths.mjs";

const LIVE = "https://ximitech.vn";
const CLONE = "http://127.0.0.1:8788";

const DEFAULT_PATHS = [
  "/",
  "/thiet-ke-website",
  "/thiet-ke-website/",
  "/dich-vu",
  "/dich-vu/",
  "/dich-vu-seo-website",
  "/bang-gia-thiet-ke-website",
  "/bao-hanh-bao-tri-website",
  "/blog",
  "/blog/page/2",
  "/blog/page/3",
  "/blog/page/1",
  "/blog/page/4",
  "/blog/landing-page-la-gi",
  "/blog/nope-slug-xyz",
  "/du-an",
  "/du-an/woodland",
  "/du-an/nope-xyz",
  "/gioi-thieu",
  "/ho-so-nang-luc",
  "/lap-trinh-web-app",
  "/lien-he",
  "/quy-trinh-thiet-ke-website",
  "/thiet-ke-landing-page",
  "/thiet-ke-website-ban-hang",
  "/thiet-ke-website-doanh-nghiep",
  "/tim-kiem",
  "/tim-kiem?q=seo",
  "/tuyen-dung",
  "/privacy-policy",
  "/terms",
  "/lab",
  "/khong-ton-tai-xyz",
  "/nope.png",
  "/assets/nope.js",
  "/index.html",
];

const paths = process.argv[2]
  ? (await readFile(process.argv[2], "utf8")).split(/\r?\n/).filter(Boolean)
  : DEFAULT_PATHS;

async function probe(base, p) {
  try {
    const r = await fetch(base + p, { redirect: "manual" });
    const ct = (r.headers.get("content-type") || "").split(";")[0];
    let title = "";
    if (ct.includes("html")) {
      const t = await r.text();
      title = (/<title>([^<]*)<\/title>/.exec(t) || [])[1] || "";
    } else {
      await r.arrayBuffer();
    }
    return { status: r.status, loc: r.headers.get("location") || "", ct, title };
  } catch (e) {
    return { status: 0, err: String(e).slice(0, 80) };
  }
}

let same = 0, diff = 0;
const rows = [];
for (const p of paths) {
  const [live, clone] = await Promise.all([probe(LIVE, p), probe(CLONE, p)]);
  const ok = live.status === clone.status && (live.loc === clone.loc) && live.title === clone.title;
  if (ok) same++; else diff++;
  rows.push({ path: p, ok, live, clone });
  const mark = ok ? "OK  " : "DIFF";
  console.log(`${mark} ${p}`);
  if (!ok) {
    console.log(`     live : ${live.status} ${live.loc} | ${live.title.slice(0, 70)}`);
    console.log(`     clone: ${clone.status} ${clone.loc} | ${clone.title.slice(0, 70)}`);
  }
}
console.log(`\n${same}/${rows.length} paths match (status + redirect + title)`);
await mkdir(path.join(RESEARCH, "reports"), { recursive: true });
await writeFile(path.join(RESEARCH, "reports", "parity.json"), JSON.stringify({ same, diff, rows }, null, 2));
console.log("written research/reports/parity.json");
