// Verify the installed brand film plays on the site and capture the film section.
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const BROWSER = "C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe";
const profile = mkdtempSync(path.join(tmpdir(), "filmcheck-"));
const child = spawn(BROWSER, ["--headless=new", "--disable-gpu", "--no-first-run", "--disable-extensions",
  "--autoplay-policy=no-user-gesture-required", "--window-size=1440,900",
  `--user-data-dir=${profile}`, "--remote-debugging-port=0", "about:blank"], { stdio: ["ignore", "pipe", "pipe"] });
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
await cdp.send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false }, sessionId);
await cdp.send("Page.navigate", { url: "http://127.0.0.1:8788/" }, sessionId);
await sleep(4500);
const ev = async (expr) => (await cdp.send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true }, sessionId)).result?.value;

const info = await ev(`(async () => {
  const v = [...document.querySelectorAll("video")].find(x => (x.currentSrc || x.src || "").includes("brand-film"));
  if (!v) return { error: "no brand film video element", videos: [...document.querySelectorAll("video")].map(x => x.currentSrc || x.src) };
  v.scrollIntoView({ block: "center" });
  await new Promise(r => setTimeout(r, 800));
  try { v.muted = true; await v.play(); } catch (e) {}
  await new Promise(r => setTimeout(r, 1200));
  return { currentSrc: v.currentSrc, duration: v.duration, videoWidth: v.videoWidth, videoHeight: v.videoHeight,
    readyState: v.readyState, paused: v.paused, currentTime: v.currentTime, poster: v.poster, error: v.error && v.error.code };
})()`);
console.log(JSON.stringify(info, null, 2));
const shot = await cdp.send("Page.captureScreenshot", { format: "jpeg", quality: 90 }, sessionId);
writeFileSync("research/video-en/site-film-section.jpg", Buffer.from(shot.data, "base64"));
cdp.close(); child.kill();
try { rmSync(profile, { recursive: true, force: true }); } catch {}
