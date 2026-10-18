// Deterministic frame renderer for the English film timeline.
// Usage: node tools/video/render.mjs <layout 16|9> <outDir> <width> <height> [seconds] [fps]
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const [layout = "16", outDir, w = "1920", h = "1080", secs = "66.47", fpsA = "30", startA = "0"] = process.argv.slice(2);
const W = Number(w), H = Number(h), FPS = Number(fpsA), DUR = Number(secs), START = Number(startA);
if (!outDir) { console.error("usage: node tools/video/render.mjs <16|9> <outDir> <w> <h> [secs] [fps]"); process.exit(1); }
mkdirSync(outDir, { recursive: true });

const BROWSER = "C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe";
const FILE = "file:///C:/Projects/ximitech-clone/research/video-en/film.html?layout=" + layout;
const profile = mkdtempSync(path.join(tmpdir(), "render-profile-"));
const child = spawn(BROWSER, ["--headless=new", "--disable-gpu", "--no-first-run", "--disable-extensions", "--mute-audio",
  "--allow-file-access-from-files", "--hide-scrollbars", "--force-device-scale-factor=1",
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
await cdp.send("Page.navigate", { url: FILE }, sessionId);
for (let i = 0; i < 120; i++) {
  const r = await cdp.send("Runtime.evaluate", { expression: "window.__ready === true", returnByValue: true }, sessionId);
  if (r.result?.value === true) break;
  await sleep(250);
}
await cdp.send("Runtime.evaluate", { expression: "document.fonts.ready.then(() => true)", awaitPromise: true, returnByValue: true }, sessionId);
await sleep(600);

const total = Math.floor(DUR * FPS);
const first = Math.floor(START * FPS);
const t0 = Date.now();
for (let i = first; i < total; i++) {
  const t = i / FPS;
  await cdp.send("Runtime.evaluate", { expression: `window.renderAt(${t.toFixed(4)})`, returnByValue: true }, sessionId);
  if (i === first && process.env.DEBUG) {
    const dbg = await cdp.send("Runtime.evaluate", { expression: `[...document.querySelectorAll(".layer")].map(e => e.id + ":" + getComputedStyle(e).opacity).join(" ")`, returnByValue: true }, sessionId);
    console.log("opacities", dbg.result.value);
  }
  const shot = await cdp.send("Page.captureScreenshot", { format: "jpeg", quality: 92 }, sessionId);
  writeFileSync(path.join(outDir, `${String(i).padStart(5, "0")}.jpg`), Buffer.from(shot.data, "base64"));
  if (i % 150 === 0) {
    const el = (Date.now() - t0) / 1000;
    console.log(`${layout}: ${i}/${total} frames  ${el.toFixed(0)}s elapsed  eta ${(el / (i + 1) * (total - i - 1)).toFixed(0)}s`);
  }
}
console.log(`${layout}: done ${total} frames in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
cdp.close(); child.kill();
try { rmSync(profile, { recursive: true, force: true }); } catch {}
