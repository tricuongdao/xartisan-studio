// Apply the translation cache + overrides to site/ (regenerated from the pristine backup).
// Usage: node tools/i18n/apply.mjs [--no-restore]
import { readFile, writeFile, cp, rm, readdir, copyFile, rename } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(".");
const SITE = path.join(ROOT, "site");
const BACKUP = path.join(ROOT, "research/i18n/backup/site-original");
const CAT = path.join(ROOT, "research/i18n/catalog.json");
const CACHE = path.join(ROOT, "research/i18n/cache.json");
const OVERRIDES = path.join(ROOT, "research/i18n/overrides.json");
const noRestore = process.argv.includes("--no-restore");

const catalog = JSON.parse(await readFile(CAT, "utf8"));
const cache = JSON.parse(await readFile(CACHE, "utf8"));
let overrides = {};
try { overrides = JSON.parse(await readFile(OVERRIDES, "utf8")); } catch {}
let ascii = {};
try { ascii = JSON.parse(await readFile(path.join(ROOT, "research/i18n/ascii.json"), "utf8")); } catch {}
const dict = { ...cache, ...overrides };

// ---------- text normalization ----------
function clean(s) {
  const lead = /^\s*/.exec(s)[0];
  const trail = /\s*$/.exec(s)[0];
  let core = s.slice(lead.length, s.length - trail.length);
  core = core
    .replace(/\u2014/g, ",")          // no em dashes in the English copy
    .replace(/\u2013/g, "-")
    .replace(/,\s*,/g, ",")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/[ \t]{2,}/g, " ");
  return lead + core + trail;
}

const missing = new Set();
function tr(text) {
  const price = /^(\d{1,3}(?:\.\d{3})+)đ$/.exec(text);
  if (price) return price[1].replace(/\./g, ",") + " VND";
  if (!(text in dict)) { missing.add(text); return text; }
  return clean(fixTerms(dict[text], text));
}

// Repair recurring machine-translation term errors (property/asset, brand case).
function fixTerms(s, src) {
  let out = s;
  if (!/sở hữu trí tuệ|tính chất/i.test(src)) {
    out = out
      .replace(/\bProperties\b/g, "Assets").replace(/\bproperties\b/g, "assets")
      .replace(/\bProperty\b/g, "Asset").replace(/\bproperty\b/g, "asset");
  }
  out = out.replace(/\bximitech\b(?!\.)/gi, "XimiTech");
  if (/sàn/i.test(src)) {
    out = out.replace(/\bexchanges\b/gi, "marketplaces").replace(/\bexchange\b/gi, "marketplace");
  }
  return out;
}

function escJs(s, quote) {
  return s
    .replace(/\\/g, "\\\\")
    .replace(new RegExp(quote === "`" ? "`" : quote.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"), "\\" + quote)
    .replace(/\r/g, "\\r").replace(/\n/g, "\\n")
    .replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029")
    .replace(/<\/script/gi, "<\\/script")
    .replace(/\$\{/g, "\\${");
}
function escHtmlText(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function escHtmlAttr(s) {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ---------- restore pristine tree ----------
if (!noRestore) {
  await rm(SITE, { recursive: true, force: true });
  await cp(BACKUP, SITE, { recursive: true });
  console.log("restored site/ from backup");
}

// ---------- JS ----------
const jsByFile = new Map();
for (const e of catalog.js) {
  if (!jsByFile.has(e.file)) jsByFile.set(e.file, []);
  jsByFile.get(e.file).push(e);
}
let jsApplied = 0;
for (const [file, entries] of jsByFile) {
  const abs = path.join(SITE, "assets", file);
  let src = await readFile(abs, "utf8");
  entries.sort((a, b) => b.start - a.start);
  for (const e of entries) {
    const out = tr(e.text);
    if (out === e.text) continue;
    const raw = e.kind === "string"
      ? e.quote + escJs(out, e.quote) + e.quote
      : escJs(out, "`");
    src = src.slice(0, e.start) + raw + src.slice(e.end);
    jsApplied++;
  }
  // locale-dependent formatting (dates, numbers) and JSON-LD language tags
  src = src
    .replace(/inLanguage:"vi-VN"/g, 'inLanguage:"en"')
    .replace(/inLanguage:'vi-VN'/g, "inLanguage:'en'");
  await writeFile(abs, src);
}
// Second pass: chunks with no catalog entries still format dates/numbers with a vi-VN locale.
for (const file of (await readdir(path.join(SITE, "assets"))).filter((f) => f.endsWith(".js"))) {
  const abs = path.join(SITE, "assets", file);
  let src = await readFile(abs, "utf8");
  const before = src;
  src = src
    .replace(/inLanguage:"vi-VN"/g, 'inLanguage:"en"')
    .replace(/inLanguage:'vi-VN'/g, "inLanguage:'en'")
    .replace(/"vi-VN"/g, '"en-US"')
    .replace(/'vi-VN'/g, "'en-US'")
    .replace(/brand-film-(16x9|9x16)\.(mp4|jpg)(?!\?v=)/g, "brand-film-$1.$2?v=en1");
  for (const [from, to] of Object.entries(ascii)) src = src.split(from).join(to);
  if (src !== before) await writeFile(abs, src);
}
console.log(`JS: ${jsApplied} string replacements in ${jsByFile.size} files`);

// ---------- HTML ----------
const htmlByFile = new Map();
for (const e of catalog.html) {
  if (!htmlByFile.has(e.file)) htmlByFile.set(e.file, []);
  htmlByFile.get(e.file).push(e);
}
let htmlApplied = 0;
for (const [file, entries] of htmlByFile) {
  const abs = path.join(SITE, file);
  let src = await readFile(abs, "utf8");
  entries.sort((a, b) => b.start - a.start);
  for (const e of entries) {
    if (e.kind === "text") {
      const out = tr(e.text);
      if (out === e.text) continue;
      // preserve the original leading/trailing whitespace of the text node
      const lead = /^\s*/.exec(e.raw)[0];
      const trail = /\s*$/.exec(e.raw)[0];
      src = src.slice(0, e.start) + lead + escHtmlText(out.trim().replace(/\s+/g, " ")) + trail + src.slice(e.end);
    } else {
      const out = tr(e.text);
      if (out === e.text) continue;
      const q = src[e.start - 1];
      const val = q === "'" ? out.replace(/&/g, "&amp;").replace(/'/g, "&#39;").replace(/</g, "&lt;") : escHtmlAttr(out);
      src = src.slice(0, e.start) + val + src.slice(e.end);
    }
    htmlApplied++;
  }
  // locale/head normalization
  src = src
    .replace(/<html lang="vi"/g, '<html lang="en"')
    .replace(/hreflang="vi"/g, 'hreflang="en"')
    .replace(/<meta name="language" content="Vietnamese" \/>/g, '<meta name="language" content="English" />')
    .replace(/content="vi_VN"/g, 'content="en_US"')
    .replace(/"availableLanguage":\[[^\]]*\]/g, '"availableLanguage":["English"]')
    .replace(/"addressCountry":"VN"/g, '"addressCountry":"VN"');
  for (const [from, to] of Object.entries(ascii)) src = src.split(from).join(to);
  await writeFile(abs, src);
}
console.log(`HTML: ${htmlApplied} replacements in ${htmlByFile.size} files`);

// Two project shells ship malformed meta descriptions (raw quotes inside content="..."),
// so the parser-based pass could not translate them. Replace those meta lines wholesale.
const HEAD_FIX = {
  "du-an/farmstay-viet-nam/index.html": "Official Vietnam website of Korean cosmetics brand Farmstay, built around its Smart Naturalism positioning: Tea Tree Biome, Collagen, Hyaluronic Acid, Retinol and Black Snail & Peptide9 lines, with a direct link to the retail counter.",
  "du-an/md-decor-pro/index.html": "Bilingual Vietnamese-English website for MD Decor Pro in Da Nang, The art of finishing: travertine, marble, concrete, metal and Venetian plaster effects for homes, shops, offices and restaurants.",
};
for (const [file, desc] of Object.entries(HEAD_FIX)) {
  const abs = path.join(SITE, file);
  let src = await readFile(abs, "utf8");
  src = src.replace(/^(\s*<meta (?:name="(?:description|twitter:description)"|property="og:description") content=")(.*)("\s*\/?>\s*)$/gm,
    (m, a, b, c) => a + desc.replace(/&/g, "&amp;").replace(/"/g, "&quot;") + c);
  await writeFile(abs, src);
}

// ---------- JSON-LD ----------
const LD_KEYS = new Set(["name", "legalName", "description", "slogan", "jobTitle", "streetAddress", "addressLocality", "addressRegion", "alternateName"]);
const VI_RE = /[àáảãạăằắẳẵặâầấẩẫậđêềếểễệôồốổỗộơờớởỡợưừứửữựìíỉĩịòóỏõọùúủũụỳýỷỹỵ]/i;
const ADDRESS = {
  "Tổ 2, Khu phố 12": "Group 2, Quarter 12",
  "Phường Quy Nhơn Bắc": "Quy Nhon Bac Ward",
  "Gia Lai": "Gia Lai Province",
  "Việt Nam": "Vietnam", "Úc": "Australia", "Hoa Kỳ": "United States", "Canada": "Canada",
};
function localizeLd(node, key) {
  if (Array.isArray(node)) return node.map((n) => localizeLd(n, key));
  if (node && typeof node === "object") {
    const out = {};
    for (const [k, v] of Object.entries(node)) out[k] = localizeLd(v, k);
    return out;
  }
  if (typeof node === "string" && VI_RE.test(node)) {
    if (ADDRESS[node]) return ADDRESS[node];
    if (key === "keywords") {
      return node.split(",").map((part) => {
        const t = part.trim();
        return t in dict ? clean(fixTerms(dict[t], t)) : t;
      }).join(", ");
    }
    if (node in dict) return clean(fixTerms(dict[node], node));
  }
  return node;
}
let ldCount = 0;
for (const file of [...htmlByFile.keys(), ...(await listHtml()).filter((f) => !htmlByFile.has(f))]) {
  const abs = path.join(SITE, file);
  let src = await readFile(abs, "utf8");
  let changed = false;
  src = src.replace(/(<script type="application\/ld\+json">)([\s\S]*?)(<\/script>)/g, (m, a, body, c) => {
    try {
      const data = JSON.parse(body);
      const out = JSON.stringify(localizeLd(data, null));
      if (out !== body) changed = true;
      ldCount++;
      return a + out + c;
    } catch { return m; }
  });
  if (changed) await writeFile(abs, src);
}
console.log(`JSON-LD: ${ldCount} blocks scanned`);

async function listHtml() {
  const { readdir } = await import("node:fs/promises");
  const out = [];
  const walk = async (dir) => {
    for (const e of await readdir(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) await walk(p);
      else if (e.name.endsWith(".html")) out.push(path.relative(SITE, p).replaceAll("\\", "/"));
    }
  };
  await walk(SITE);
  return out;
}

if (missing.size) {
  console.log(`\nMISSING TRANSLATIONS: ${missing.size}`);
  for (const m of [...missing].slice(0, 12)) console.log("  " + JSON.stringify(m).slice(0, 120));
}
// Structural edits: the brand film section is disabled on request (component returns null).
for (const [file, from, to] of [
  ["index-DAfw2Y79.js",
    "wd=({topBorder:e=!0,roomierHeading:n=!1})=>{",
    "wd=({topBorder:e=!0,roomierHeading:n=!1})=>{return null;"],
  ["index-DAfw2Y79.js",
    "yd=()=>{const e=Zt(),",
    "yd=()=>{return null;const e=Zt(),"],
]) {
  const abs = path.join(SITE, "assets", file);
  let src = await readFile(abs, "utf8");
  if (src.includes(from)) {
    await writeFile(abs, src.replace(from, to));
    console.log(`structural: film section disabled in ${file}`);
  } else {
    console.log(`structural: pattern not found in ${file}`);
  }
}

// The disabled film section must not ship its media either.
for (const f of ["brand-film-16x9.mp4", "brand-film-9x16.mp4", "brand-film-16x9.jpg", "brand-film-9x16.jpg"]) {
  await rm(path.join(SITE, "uploads/ximitech/video/v1/film", f), { force: true });
}

// ---------- rebrand ----------
// Applied after translation, before asset versioning. Everything is regenerated from the
// pristine backup, so these rules are the single source of truth for the Xartisan Studio brand.
const BRAND_RULES = [
  ["Legal information", "Studio information"],
  // asset paths (renamed on disk before this runs)
  ["uploads/ximitech", "uploads/xartisan"],
  ["/uploads/ximitech/", "/uploads/xartisan/"],
  ["/kho-giao-dien/v1/", "/kho-giao-dien/v2/"],
  ["su-menh-tam-nhin-ximitech-website-la-tai-san", "su-menh-tam-nhin-xartisan-studio-website-la-tai-san"],
  ["ximitech-profile-cover.webp", "xartisan-profile-cover.webp"],
  ["ximitech-logo-light.webp", "xartisan-logo-light.webp"],
  ["ximitech-logo.webp", "xartisan-logo.webp"],
  ["ximitech-mark.webp", "xartisan-mark.webp"],
  ["zalo-icon.png", "whatsapp-icon.png"],
  ["ximitech-logo-3d.glb", "xartisan-logo-3d.glb"],
  // local state keys and chatbot keyword
  ["ximitech:sound-hint", "xartisan:sound-hint"],
  ["ximitech:sound", "xartisan:sound"],
  ["ximitech-ui-theme", "xartisan-ui-theme"],
  ["keywords:[\"ximitech\"", "keywords:[\"xartisan\""],
  // legal name variants first, then the bare brand token
  ["Công ty TNHH Giải pháp số XimiTech", "Xartisan Studio"],
  ["XimiTech Digital Solutions Company Limited", "Xartisan Studio"],
  ["XIMITECH DIGITAL SOLUTIONS CO., LTD", "XARTISAN STUDIO"],
  ["XIMITECH CO., LTD", "XARTISAN STUDIO"],
  ["XimiTech Digital Solutions", "Xartisan Studio"],
  // contact
  ["ximitech1309@gmail.com", "hello@xartisan.studio"],
  ["ximitech.vn", "xartisan.studio"],
  ["+84888889805", "+61435878929"],
  ["088 888 9805", "0435 878 929"],
  ["0888889805", "61435878929"],
  ["tiktok.com/@doximitech", "tiktok.com/@xartisanstudio"],
  ["@doximitech", "@xartisanstudio"],
  ["doximitech", "xartisanstudio"],
  ["instagram.com/ximitech_vn", "instagram.com/xartisanstudio"],
  ["@ximitech_vn", "@xartisanstudio"],
  ["zalo.me", "wa.me"],
  ["Zalo", "WhatsApp"],
  // legal / tax removal
  [" · Tax code 4101691382", ""],
  [" · Tax ID 4101691382", ""],
  ["Tax code 4101691382", ""],
  ["Tax ID 4101691382", ""],
  ["4101691382", ""],
  // address
  ["Group 2, Quarter 12, Quy Nhon Bac Ward, Gia Lai Province, Vietnam", "Da Nang, Vietnam"],
  ["Quy Nhon Bac, Gia Lai", "Da Nang"],
  ["Quy Nhon Bac Ward", "Da Nang"],
  ["Gia Lai Province", "Da Nang"],
  // brand
  ["XimiTech", "Xartisan Studio"],
  ["XIMITECH", "XARTISAN STUDIO"],
];

function rebrand(src) {
  let s = src;

  // data-object and JSX surgery first
  s = s.replace(
    'zu=[{icon:Yc,label:"Legal entity",value:Dt.legalName},{icon:Uc,label:"Tax code",value:`${Dt.taxCode} · ${Dt.businessStatus}`},{icon:vr,label:"Headquarters · service",value:`${Dt.shortAddress} · nationwide`}]',
    'zu=[{icon:Yc,label:"Legal entity",value:Dt.legalName},{icon:vr,label:"Headquarters",value:Dt.shortAddress}]'
  );
  s = s.replace('["© 2026 ",Dt.legalName," · Tax ID ",Dt.taxCode]', '["© 2026 ",Dt.legalName]');
  s = s.replace(
    '[[T,"Zalo",c.phone],[S,"Hotline",c.phone],[ie,"Email",c.email],[re,"Tax code",c.taxCode],[he,"Address",c.shortAddress]]',
    '[[S,"Hotline",c.phone],[ie,"Email",c.email],[he,"Address",c.shortAddress]]'
  );
  s = s.replace(
    'bank:{name:"Techcombank",fullName:"Vietnam Technological and Commercial Joint Stock Bank (Techcombank)",accountNumber:"130988888",accountName:"XIMITECH CO., LTD"}',
    'bank:{name:"",fullName:"",accountNumber:"",accountName:""}'
  );
  s = s.replace(
    'founderAliases:["XimiTech Degree","Tran Thanh Do XimiTech","Thanh Do"]',
    'founderAliases:["Xartisan Studio","Tran Thanh Do","Thanh Do"]'
  );
  s = s.replace(
    /jg=`[^`]*\$\{Dt\.taxCode\}[^`]*`/,
    'jg="Xartisan Studio is an independent design and development studio. Registration and banking details are shared on request."'
  );
  s = s.replace(/"taxID":"[^"]*",?/g, "");
  s = s.replace(/taxProfileUrl:"[^"]*"/g, 'taxProfileUrl:""');
  s = s.replace(/"address":\{"@type":"PostalAddress"[^}]*\}/g,
    '"address":{"@type":"PostalAddress","addressLocality":"Da Nang","addressCountry":"VN"}');
  s = s.replace(/ · Tax (?:code|ID) ·/g, " ·");
  // Chatbot: no old bank account or tax code can survive in any answer.
  s = s.replace(
    /TRANSFER INFORMATION[\s\S]{0,600}?before starting\./,
    "PAYMENT INFORMATION\\\\n- Payment and bank details are shared on request after the project scope is confirmed.\\\\n- When customers ask how to pay or transfer: explain that details are sent privately, remind them to confirm via WhatsApp 0435 878 929, and note that the content should include the phone number or project name. Usually a 30-50% deposit is required before starting."
  );
  s = s.replace(
    "Yes, **'s transfer information${h.brandName}**:\\n- **Bank:** ${h.bank.name}\\n- **Account number:** ${h.bank.accountNumber}\\n- **Account owner:** ${h.bank.accountName}\\n\\n",
    "Yes, payment details are shared on request. Message us on WhatsApp and we will send the invoice and bank details for your project.\\n\\n"
  );
  s = s.replace("- Legal representative · Tax code: **${h.taxCode}**\\n", "");
  s = s.replace("- Legal entity: ${h.legalName} · Tax ID ${h.taxCode}\\n", "- Studio: ${h.legalName}\\n");
  s = s.replace("- MST: ${h.taxCode}\\n", "");
  // About page: drop the industry sentence appended to the studio description.
  s = s.replace('children:[o," Main industry: ",a.mainBusinessDetail,"."]', "children:[o]");
  // JSON-LD: collapse the duplicate alternate name left by the rebrand.
  s = s.replace(/"alternateName":\["XARTISAN STUDIO","XARTISAN STUDIO"\]/g, '"alternateName":["XARTISAN STUDIO"]');

  for (const [from, to] of BRAND_RULES) s = s.split(from).join(to);

  // Replacing a bare brand token can turn JSX object keys or handles into invalid syntax.
  s = s.replace(/@Xartisan Studio-thietkewebsite/g, "@xartisanstudio");
  s = s.replace(/([{,])(Xartisan Studio):/g, '$1"Xartisan Studio":');
  // ZaloPay is a third-party payment brand in the chatbot's industry examples.
  s = s.replace('"WhatsAppPay",url:"https://zalopay.vn/"', '"ZaloPay",url:"https://zalopay.vn/"');
  // alternateName is deduped after the legal-name replacements above.
  s = s.replace(/"alternateName":\["XARTISAN STUDIO","XARTISAN STUDIO"\]/g, '"alternateName":["XARTISAN STUDIO"]');
  // The giant footer wordmark is sized to the letter count; "XARTISAN STUDIO" overflows.
  s = s.replace('const e="XARTISAN STUDIO".split("")', 'const e="XARTISAN".split("")');

  // Header uses the horizontal lockup; the footer keeps the square one.
  s = s.replace(
    'src:"/xartisan-logo-light.webp",alt:"Xartisan Studio Logo",width:"256",height:"256"',
    'src:"/xartisan-logo-header-light.webp",alt:"Xartisan Studio Logo",width:"720",height:"220"'
  );
  s = s.replace(
    'src:"/xartisan-logo.webp",alt:"Xartisan Studio Logo",width:"256",height:"256"',
    'src:"/xartisan-logo-header.webp",alt:"Xartisan Studio Logo",width:"720",height:"220"'
  );
  s = s.replace('${g?"h-12 md:h-16":"h-16 md:h-20 lg:h-24"}', '${g?"h-12 md:h-14":"h-14 md:h-16 lg:h-16"}');
  s = s.replace('${g?"h-10 md:h-12":"h-12 md:h-14 lg:h-16"}', '${g?"h-12 md:h-14":"h-14 md:h-16 lg:h-16"}');


  // tidy separators left by removed legal fields
  s = s.replace(/\s*·\s*·/g, " · ").replace(/ · (?=["<])/g, " ");
  return s;
}

async function rebrandTree(dir) {
  let changed = 0;
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "uploads" || e.name === "fonts") continue;
      changed += await rebrandTree(p);
      continue;
    }
    if (!/\.(js|html|xml|txt|json|css)$/.test(e.name)) continue;
    const src = await readFile(p, "utf8");
    const out = rebrand(src);
    if (out !== src) { await writeFile(p, out); changed++; }
  }
  return changed;
}
// Rename brand paths on disk now that the translation passes have written the HTML.
await rename(path.join(SITE, "uploads", "ximitech"), path.join(SITE, "uploads", "xartisan")).catch(() => {});
await rename(
  path.join(SITE, "uploads", "xartisan", "kho-giao-dien", "v1"),
  path.join(SITE, "uploads", "xartisan", "kho-giao-dien", "v2")
).catch(() => {});
await rename(
  path.join(SITE, "uploads", "xartisan", "company-profile", "v1", "ximitech-profile-cover.webp"),
  path.join(SITE, "uploads", "xartisan", "company-profile", "v1", "xartisan-profile-cover.webp")
).catch(() => {});
await rename(
  path.join(SITE, "blog", "su-menh-tam-nhin-ximitech-website-la-tai-san"),
  path.join(SITE, "blog", "su-menh-tam-nhin-xartisan-studio-website-la-tai-san")
).catch(() => {});

// Design-library mockups carry a baked-in "XimiTech.vn" browser chip; use the re-lettered set.
try {
  const MOCK = path.join(ROOT, "tools", "brand", "mockups");
  const mockFiles = await readdir(MOCK);
  for (const f of mockFiles) {
    await copyFile(path.join(MOCK, f), path.join(SITE, "uploads", "xartisan", "kho-giao-dien", "v2", f));
  }
  console.log(`mockups: ${mockFiles.length} watermarks replaced`);
} catch {
  console.log("mockups: none found");
}

console.log(`rebrand: ${await rebrandTree(SITE)} files updated`);

// Brand images are authored outside the mirror; install them after the restore.
const BRAND_DIR = path.join(ROOT, "tools", "brand", "assets");
try {
  const brandFiles = await readdir(BRAND_DIR);
  for (const f of brandFiles) await copyFile(path.join(BRAND_DIR, f), path.join(SITE, f));
  for (const old of ["ximitech-logo.webp", "ximitech-logo-light.webp", "ximitech-mark.webp", "zalo-icon.png"]) {
    await rm(path.join(SITE, old), { force: true });
  }
  console.log(`brand assets: ${brandFiles.length} installed`);
} catch {
  console.log("brand assets: none found (tools/brand/assets)");
}

// The pre-hydration loader ships an inline base64 lockup in every HTML shell.
try {
  const loaderB64 = (await readFile(path.join(BRAND_DIR, "loader-logo.png"))).toString("base64");
  let inlined = 0;
  for (const rel of await listHtml()) {
    const abs = path.join(SITE, rel);
    const src = await readFile(abs, "utf8");
    const out = src.replace(/(<img class="pl-mark" src="data:image\/png;base64,)[^"]+/g, `$1${loaderB64}`);
    if (out !== src) { await writeFile(abs, out); inlined++; }
  }
  console.log(`loader: inlined in ${inlined} HTML files`);
} catch (e) {
  console.log("loader: inline replacement skipped", e.message);
}

// Cache-bust: the origin's bundles are served immutable, so translated assets need new URLs.
await import("./version-assets.mjs");
console.log("\ndone.");
