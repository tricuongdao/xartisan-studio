// Diagnose a page in headless browser: failed requests, console errors, DOM stats.
// Usage: node tools/qa/diag.mjs <url> [--dump-selectors]
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const [url] = process.argv.slice(2);
if (!url) { console.error("usage: node tools/qa/diag.mjs <url>"); process.exit(1); }
const BROWSER = process.env.SHOOT_BROWSER || "C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe";
const profile = mkdtempSync(path.join(tmpdir(), "diag-profile-"));

const child = spawn(BROWSER, [
  "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
  "--disable-extensions", "--mute-audio", "--force-device-scale-factor=1",
  "--window-size=1440,900", `--user-data-dir=${profile}`, "--remote-debugging-port=0", "about:blank",
], { stdio: ["ignore", "pipe", "pipe"] });

const wsUrl = await new Promise((resolve, reject) => {
  let buf = "";
  const t = setTimeout(() => reject(new Error("no endpoint")), 25000);
  child.stderr.on("data", d => {
    buf += d.toString();
    const m = /DevTools listening on (ws:\/\/[^\s]+)/.exec(buf);
    if (m) { clearTimeout(t); resolve(m[1]); }
  });
});

const ws = new WebSocket(wsUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error("ws")); });
let id = 0; const pending = new Map(); const events = [];
ws.onmessage = ev => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
  } else if (msg.method) events.push(msg);
};
const send = (method, params = {}, sessionId) => {
  const i = ++id;
  const p = { id: i, method, params };
  if (sessionId) p.sessionId = sessionId;
  ws.send(JSON.stringify(p));
  return new Promise((resolve, reject) => pending.set(i, { resolve, reject }));
};
const sleep = ms => new Promise(r => setTimeout(r, ms));

const { targetId } = await send("Target.createTarget", { url: "about:blank" });
const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
await send("Page.enable", {}, sessionId);
await send("Runtime.enable", {}, sessionId);
await send("Network.enable", {}, sessionId);
await send("Log.enable", {}, sessionId);
await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false }, sessionId);
await send("Page.navigate", { url }, sessionId);
await sleep(6000);
// scroll sweep then settle
await send("Runtime.evaluate", {
  expression: `(async () => { const H = document.documentElement.scrollHeight;
    for (let y = 0; y <= H; y += Math.round(innerHeight*0.8)) { window.scrollTo(0, y); await new Promise(r=>setTimeout(r,80)); }
    window.scrollTo(0,0); await new Promise(r=>setTimeout(r,400)); return H; })()`,
  awaitPromise: true, returnByValue: true,
}, sessionId);
await sleep(2500);

const ev = events.filter(e => e.sessionId === sessionId);
const failed = ev.filter(e => e.method === "Network.loadingFailed" && !e.params.canceled)
  .map(e => ({ err: e.params.errorText, type: e.params.type }));
const responses = ev.filter(e => e.method === "Network.responseReceived");
const bad = responses.filter(e => e.params.response.status >= 400)
  .map(e => ({ status: e.params.response.status, url: e.params.response.url }));
const consoleErrs = ev.filter(e => e.method === "Runtime.consoleAPICalled" && ["error", "warning"].includes(e.params.type))
  .map(e => ({ type: e.params.type, text: (e.params.args || []).map(a => (a.value ?? a.description ?? "")).join(" ").slice(0, 300) }));
const exceptions = ev.filter(e => e.method === "Runtime.exceptionThrown")
  .map(e => ({ text: (e.params.exceptionDetails?.exception?.description || e.params.exceptionDetails?.text || "").slice(0, 400) }));

const stats = await send("Runtime.evaluate", {
  expression: `(() => {
    const all = [...document.querySelectorAll('main *')];
    const invisible = all.filter(e => { const s = getComputedStyle(e); return s.opacity === '0' && e.offsetHeight > 40; });
    return {
      title: document.title, docH: document.documentElement.scrollHeight,
      totalReqs: ${responses.length}, mainText: (document.querySelector('main')||{}).innerText ? document.querySelector('main').innerText.length : 0,
      invisibleCount: invisible.length,
      invisibleSample: invisible.slice(0, 6).map(e => (e.className || e.tagName).toString().slice(0, 60)),
      imgStats: [...document.querySelectorAll('img')].map(i => i.currentSrc || i.src).filter(Boolean).length + '/' + document.querySelectorAll('img').length,
      brokenImgs: [...document.querySelectorAll('img')].filter(i => i.complete && i.naturalWidth === 0 && i.src).map(i => i.src).slice(0, 8),
    };
  })()`, returnByValue: true,
}, sessionId);

console.log(JSON.stringify({
  url,
  stats: stats.result.value,
  failedCount: failed.length, failed: failed.slice(0, 15),
  badResponses: bad.slice(0, 20),
  consoleErrors: consoleErrs.slice(0, 12),
  exceptions: exceptions.slice(0, 6),
}, null, 2));

await send("Target.closeTarget", { targetId }).catch(() => {});
ws.close(); child.kill();
await sleep(300);
try { rmSync(profile, { recursive: true, force: true }); } catch {}
