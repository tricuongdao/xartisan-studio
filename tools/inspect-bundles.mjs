// Inspect mirrored bundle refs
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { UPSTREAM } from "./lib/paths.mjs";

const ASSETS = path.join(UPSTREAM, "assets");
const files = (await readdir(ASSETS)).filter(f => f.endsWith(".js") || f.endsWith(".css"));
const r2 = new Set();
const uploads = new Set();
for (const f of files) {
  const t = await readFile(path.join(ASSETS, f), "utf8");
  for (const m of t.matchAll(/pub-[0-9a-f]+\.r2\.dev\/[A-Za-z0-9._~!$&'()*+,;=:@%\-\/]+/g)) r2.add(m[0]);
  for (const m of t.matchAll(/\/uploads\/[A-Za-z0-9._\/-]+/g)) uploads.add(m[0]);
  for (const m of t.matchAll(/\/assets\/[A-Za-z0-9._-]+\.(?:png|jpe?g|webp|avif|gif|svg|ico|woff2?)/g)) r2.add("ASSET:" + m[0]);
}
console.log("--- r2.dev refs ---", r2.size);
for (const u of [...r2].sort()) console.log(u);
console.log("--- /uploads/ refs ---", uploads.size);
for (const u of [...uploads].sort()) console.log(u);
