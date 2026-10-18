// Full-site runtime crawl: console errors, failed requests, leftover Vietnamese, text overflow.
// Usage: node tools/i18n/crawl.mjs <baseUrl> <routesFile> <outJson>
import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const [baseUrl, routesFile, outJson] = process.argv.slice(2);
if (!baseUrl || !routesFile || !outJson) {
  console.error("usage: node tools/i18n/crawl.mjs <baseUrl> <routesFile> <outJson>");
  process.exit(1);
}
const BROWSER = process.env.CRAWL_BROWSER || "C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe";
const routes = readFileSync(routesFile, "utf8").split(/\r?\n/).map((s) => s.trim()).filter((l) => l && !l.startsWith("#"));
const profile = mkdtempSync(path.join(tmpdir(), "crawl-profile-"));

const child = spawn(BROWSER, [
  "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
  "--disable-extensions", "--mute-audio", "--force-device-scale-factor=1",
  "--window-size=1440,900", `--user-data-dir=${profile}`,
  "--remote-debugging-port=0", "about:blank",
], { stdio: ["ignore", "pipe", "pipe"] });

const wsUrl = await new Promise((resolve, reject) => {
  let buf = "";
  const t = setTimeout(() => reject(new Error("no DevTools endpoint in 25s")), 25000);
  child.stderr.on("data", (d) => {
    buf += d.toString();
    const m = /DevTools listening on (ws:\/\/[^\s]+)/.exec(buf);
    if (m) { clearTimeout(t); resolve(m[1]); }
  });
  child.on("exit", (c) => reject(new Error("browser exited " + c)));
});

class CDP {
  constructor(ws) { this.ws = ws; this.id = 0; this.pending = new Map(); this.listeners = []; }
  static async connect(url) {
    const ws = new WebSocket(url);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error("ws error")); });
    const c = new CDP(ws);
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && c.pending.has(msg.id)) {
        const { resolve, reject } = c.pending.get(msg.id);
        c.pending.delete(msg.id);
        msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
      } else if (msg.method) for (const l of c.listeners) l(msg);
    };
    return c;
  }
  send(method, params = {}, sessionId) {
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
  }
  on(fn) { this.listeners.push(fn); }
  close() { try { this.ws.close(); } catch {} }
}

const cdp = await CDP.connect(wsUrl);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const EVAL = `(() => {
  const VI = /[àáảãạăằắẳẵặâầấẩẫậđêềếểễệôồốổỗộơờớởỡợưừứửữựìíỉĩịòóỏõọùúủũụỳýỷỹỵ]/i;
  const text = document.body ? document.body.innerText : "";
  const attrs = [];
  for (const el of document.querySelectorAll("[alt],[aria-label],[title],[placeholder]")) {
    for (const a of ["alt", "aria-label", "title", "placeholder"]) {
      const v = el.getAttribute(a);
      if (v) attrs.push(v);
    }
  }
  const all = text + "\\n" + attrs.join("\\n") + "\\n" + document.title;
  const ASCII_VI = ["Xem ", "Trang ", "MST", "doanh thu", "tuyen dung", "KPI doanh thu"];
  const asciiHits = [];
  for (const line of all.split("\\n")) {
    if (ASCII_VI.some((w) => line.includes(w)) && asciiHits.length < 12) asciiHits.push(line.trim().slice(0, 160));
  }
  const BRAND_BAD = ["XimiTech", "ximitech.vn", "4101691382", "088 888 9805", "0888889805", "doximitech", "Zalo", "zalo.me"];
  const brandHits = [];
  for (const line of all.split("\\n")) {
    if (BRAND_BAD.some((w) => line.includes(w)) && brandHits.length < 12) brandHits.push(line.trim().slice(0, 160));
  }
  const hits = [];
  let count = 0;
  for (const line of all.split("\\n")) {
    if (VI.test(line)) {
      count += (line.match(/[àáảãạăằắẳẵặâầấẩẫậđêềếểễệôồốổỗộơờớởỡợưừứửữựìíỉĩịòóỏõọùúủũụỳýỷỹỵ]/gi) || []).length;
      if (hits.length < 15) hits.push(line.trim().slice(0, 180));
    }
  }
  const overflow = [];
  for (const el of document.querySelectorAll("h1,h2,h3,h4,h5,p,li,button,a,span")) {
    if (!el.offsetParent || el.clientWidth === 0) continue;
    const cs = getComputedStyle(el);
    if (cs.overflowX !== "visible" || cs.textOverflow === "ellipsis") continue;
    if (el.scrollWidth > el.clientWidth + 3 && el.clientWidth < el.parentElement.clientWidth + 3) {
      overflow.push({ tag: el.tagName, cls: (el.className || "").toString().slice(0, 60), sw: el.scrollWidth, cw: el.clientWidth, text: (el.textContent || "").trim().slice(0, 80) });
      if (overflow.length >= 8) break;
    }
  }
  const brokenImgs = [...document.images].filter((i) => i.offsetParent && i.complete && i.naturalWidth === 0).map((i) => i.currentSrc || i.src).slice(0, 8);
  return { title: document.title, viCount: count, viSamples: hits, asciiHits, brandHits, overflow, brokenImgs, docH: document.documentElement.scrollHeight, h1: (document.querySelector("h1")?.innerText || "").slice(0, 160) };
})()`;

const results = [];
for (const route of routes) {
  const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
  const errors = [], failed = [], statuses = [];
  const listener = (msg) => {
    if (msg.sessionId !== sessionId) return;
    if (msg.method === "Runtime.exceptionThrown") {
      const d = msg.params.exceptionDetails;
      errors.push("exception: " + (d.exception?.description || d.text || "").split("\n")[0].slice(0, 200));
    }
    if (msg.method === "Runtime.consoleAPICalled" && msg.params.type === "error") {
      errors.push("console: " + msg.params.args.map((a) => a.value ?? a.description ?? "").join(" ").slice(0, 200));
    }
    if (msg.method === "Network.loadingFailed") {
      failed.push(`${msg.params.type} ${msg.params.errorText} ${msg.params.requestId}`);
    }
    if (msg.method === "Network.responseReceived") {
      const r = msg.params.response;
      if (r.status >= 400) statuses.push(`${r.status} ${r.url.slice(-100)}`);
    }
  };
  cdp.on(listener);
  try {
    await cdp.send("Page.enable", {}, sessionId);
    await cdp.send("Runtime.enable", {}, sessionId);
    await cdp.send("Network.enable", {}, sessionId);
    await cdp.send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false }, sessionId);
    await cdp.send("Page.navigate", { url: baseUrl + route }, sessionId);
    await sleep(3200);
    // wait out the route loader (force-completes at 20s on error; cap at 9s here)
    for (let i = 0; i < 9; i++) {
      const r = await cdp.send("Runtime.evaluate", {
        expression: `![...document.querySelectorAll('.page-loader')].some(e => { const s = getComputedStyle(e); return s.display !== 'none' && s.visibility !== 'hidden' && Number(s.opacity) > 0.01; })`,
        returnByValue: true,
      }, sessionId);
      if (r.result?.value === true) break;
      await sleep(1000);
    }
    await sleep(1200);
    const ev = await cdp.send("Runtime.evaluate", { expression: EVAL, returnByValue: true }, sessionId);
    const value = ev.result?.value || {};
    results.push({ route, ...value, errors: [...new Set(errors)].slice(0, 10), failed: failed.slice(0, 10), http4xx: statuses.slice(0, 10) });
    console.log(`${route}  vi=${value.viCount ?? "?"}  brand=${value.brandHits?.length ?? "?"}  err=${errors.length}  failed=${failed.length}  h=${value.docH ?? "?"}`);
  } catch (e) {
    results.push({ route, error: String(e).slice(0, 200) });
    console.log(`${route} ERROR ${String(e).slice(0, 120)}`);
  } finally {
    cdp.listeners = cdp.listeners.filter((l) => l !== listener);
    await cdp.send("Target.closeTarget", { targetId }).catch(() => {});
  }
}

mkdirSync(path.dirname(outJson), { recursive: true });
writeFileSync(outJson, JSON.stringify(results, null, 2));
console.log(`\nwrote ${outJson}: ${results.length} routes`);
cdp.close();
child.kill();
await sleep(300);
try { rmSync(profile, { recursive: true, force: true }); } catch {}
