// Restore leading/trailing whitespace onto cache values (fragments are concatenated at runtime).
import { readFile, writeFile } from "node:fs/promises";
const P = "research/i18n/cache.json";
const cache = JSON.parse(await readFile(P, "utf8"));
let fixed = 0;
for (const [k, v] of Object.entries(cache)) {
  const lead = /^\s*/.exec(k)[0];
  const trail = /\s*$/.exec(k)[0];
  const next = lead + String(v).trim() + trail;
  if (next !== v) { cache[k] = next; fixed++; }
}
await writeFile(P, JSON.stringify(cache, null, 0));
console.log(`normalized whitespace on ${fixed} entries`);
