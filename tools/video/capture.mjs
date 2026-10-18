// Capture 1920x1080 stills of the translated site in dark theme for the English film edit.
// Usage: node tools/video/capture.mjs
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const BROWSER = "C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe";
const OUT = path.resolve("research/video-en/stills");
mkdirSync(OUT, { recursive: true });
const BASE = "http://127.0.0.1:8788";
const W = 1920, H = 1080;

const profile = mkdtempSync(path.join(tmpdir(), "cap-profile-"));
const child = spawn(BROWSER, ["--headless=new", "--disable-gpu", "--no-first-run", "--default-browser-check",
  "--disable-extensions", "--mute-audio", "--force-device-scale-factor=1", "--hide-scrollbars",
  `--window-size=${W},${H}`, `--user-data-dir=${profile}`, "--remote-debugging-port=0", "about:blank"], { stdio: ["ignore", "pipe", "pipe"] });
const wsUrl = await new Promise((resolve, reject) => {
  let buf = ""; const t = setTimeout(() => reject(new Error("no devtools")), 25000);
  child.stderr.on("data", (d) => { buf += d.toString(); const m = /DevTools listening on (ws:\/\/[^\s]+)/.exec(buf); if (m) { clearTimeout(t); resolve(m[1]); } });
});
class CDP {
  constructor(ws) { this.ws = ws; this.id = 0; this.pending = new Map(); }
  static async connect(u) { const ws = new WebSocket(u); await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
    const c = new CDP(ws); ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && c.pending.has(m.id)) { const p = c.pending.get(m.id); c.pending.delete(m.id); m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result); } }; return c; }
  send(method, params = {}, sessionId) { const id = ++this.id; this.ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) })); return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject })); }
  close() { try { this.ws.close(); } catch {} }
}
const cdp = await CDP.connect(wsUrl);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" });
const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
await cdp.send("Page.enable", {}, sessionId);
await cdp.send("Runtime.enable", {}, sessionId);
await cdp.send("Emulation.setDeviceMetricsOverride", { width: W, height: H, deviceScaleFactor: 1, mobile: false }, sessionId);
await cdp.send("Page.addScriptToEvaluateOnNewDocument", { source: `localStorage.setItem("ximitech-ui-theme","dark");` }, sessionId);

const shots = [
  ["hero", "/", 0, null],
  ["design", "/thiet-ke-website", 0, null],
  ["services", "/thiet-ke-website", 1500, null],
  ["projects", "/du-an", 350, null],
  ["pricing", "/bang-gia-thiet-ke-website", 800, null],
  ["ops", "/", 0, "#van-hanh"],
  ["profile", "/ho-so-nang-luc", 900, null],
  ["contact", "/lien-he", 200, null],
  ["process", "/quy-trinh-thiet-ke-website", 400, null],
];
for (const [name, route, y, selector] of shots) {
  await cdp.send("Page.navigate", { url: BASE + route }, sessionId);
  await sleep(4200);
  for (let i = 0; i < 20; i++) {
    const r = await cdp.send("Runtime.evaluate", { expression: "(() => { const l = document.querySelector('.page-loader'); if (!l) return true; const s = getComputedStyle(l); return s.display==='none'||Number(s.opacity)===0; })()", returnByValue: true }, sessionId);
    if (r.result?.value === true) break;
    await sleep(700);
  }
  await sleep(1200);
  // hide floating site chrome so the footage shows the design, not the widget layer
  await cdp.send("Runtime.evaluate", {
    expression: `(() => {
      const style = document.createElement("style");
      style.textContent = '[class*=cursor]{display:none!important} [class*=Cursor]{display:none!important}';
      document.head.appendChild(style);
      for (const el of document.querySelectorAll("body *")) {
        const cs = getComputedStyle(el);
        if (cs.position !== "fixed" && cs.position !== "absolute") continue;
        const txt = (el.innerText || "").trim();
        const r = el.getBoundingClientRect();
        if (r.width < 520 && /Tap to enable 3D sound|Use headphones|Open AI assistant|AI assistant/i.test(txt)) el.style.display = "none";
        if (r.width > 0 && r.width <= 96 && r.height <= 96 && r.bottom > innerHeight * 0.7 && r.right > innerWidth * 0.7) el.style.display = "none";
      }
      return true;
    })()`, returnByValue: true,
  }, sessionId);
  await sleep(400);
  if (selector) {
    await cdp.send("Runtime.evaluate", { expression: `(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (el) el.scrollIntoView({ block: "center" }); return !!el; })()`, returnByValue: true }, sessionId);
    await sleep(1800);
  }
  if (y) { await cdp.send("Runtime.evaluate", { expression: `window.scrollTo(0, ${y})`, returnByValue: true }, sessionId); await sleep(1400); }
  const shot = await cdp.send("Page.captureScreenshot", { format: "jpeg", quality: 92 }, sessionId);
  writeFileSync(path.join(OUT, `${name}.jpg`), Buffer.from(shot.data, "base64"));
  console.log(name, route, y, "ok");
}
cdp.close(); child.kill();
try { rmSync(profile, { recursive: true, force: true }); } catch {}
