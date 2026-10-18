// Parse every minified bundle after apply/rebrand. Exits non-zero on the first syntax error.
import { readdir, readFile } from "node:fs/promises";
import { parse } from "acorn";

const dir = new URL("../../site/assets/", import.meta.url);
let bad = 0;
for (const f of (await readdir(dir)).filter((f) => f.endsWith(".js"))) {
  const src = await readFile(new URL(f, dir), "utf8");
  try {
    parse(src, { ecmaVersion: "latest", sourceType: "module" });
  } catch (e) {
    bad++;
    console.log(`FAIL ${f}: ${e.message}`);
  }
}
console.log(bad ? `${bad} bundle(s) failed` : "all JS parse OK");
process.exit(bad ? 1 : 0);
