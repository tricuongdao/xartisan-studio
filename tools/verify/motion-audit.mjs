// Motion audit for a page: animation element inventory + proof that reveals/marquees actually run.
// Usage: node tools/verify/motion-audit.mjs <url> [width] [height]
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const [url, w = "1440", h = "900"] = process.argv.slice(2);
const W = Number(w), H = Number(h);
const BROWSER = process.env.SHOOT_BROWSER || "C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe";
const profile = mkdtempSync(path.join(tmpdir(), "motion-profile-"));
const child = spawn(BROWSER, ["--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
  "--disable-extensions", "--mute-audio", "--force-device-scale-factor=1",
  `--window-size=${W},${H}`, `--user-data-dir=${profile}`, "--remote-debugging-port=0", "about:blank"], { stdio: ["ignore", "pipe", "pipe"] });
const wsUrl = await new Promise((resolve, reject) => {
  let buf = ""; const t = setTimeout(() => reject(new Error("no endpoint")), 25000);
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
await cdp.send("Emulation.setDeviceMetricsOverride", { width: W, height: H, deviceScaleFactor: 1, mobile: W < 700 }, sessionId);
await cdp.send("Page.navigate", { url }, sessionId);
await sleep(5000);
for (let i = 0; i < 30; i++) {
  const r = await cdp.send("Runtime.evaluate", { expression: "(() => { const l = document.querySelector('.page-loader'); if (!l) return true; const s = getComputedStyle(l); return s.display==='none'||Number(s.opacity)===0; })()", returnByValue: true }, sessionId);
  if (r.result?.value === true) break;
  await sleep(800);
}
await sleep(1200);
const ev = async (expr) => (await cdp.send("Runtime.evaluate", { expression: expr, returnByValue: true }, sessionId)).result?.value;

const inventory = await ev(`(() => {
  const q = (s) => document.querySelectorAll(s).length;
  const anim = [...document.querySelectorAll("*")].filter(e => {
    const s = getComputedStyle(e);
    return s.animationName !== "none" || (s.transitionProperty !== "all" && s.transitionDuration !== "0s" && false);
  }).length;
  const sections = [...document.querySelectorAll("main section")];
  return {
    docH: document.documentElement.scrollHeight,
    motion: q("[data-motion]"),
    scroll: q("[data-scroll]"),
    cue: q("[data-cue]"),
    splitMasks: q(".split-mask"),
    splitWords: q(".split-word"),
    marqueeClass: q("[class*=marquee]"),
    canvas: q("canvas"),
    video: q("video"),
    tallSections: sections.filter(s => s.getBoundingClientRect().height > innerHeight * 1.8).length,
    sections: sections.length,
    cssAnimations: anim,
    lenisHtml: document.documentElement.className.includes("lenis"),
    reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
    scrollHeightNow: document.body.scrollHeight
  };
})()`);

// reveal liveness: scroll to the first N [data-motion] cards and watch opacity/transform settle
const reveal = await ev(`(() => [...document.querySelectorAll("[data-motion]")].filter(e => e.getBoundingClientRect().height > 20).slice(0, 6).map((e, i) => ({ i, op: getComputedStyle(e).opacity, tf: getComputedStyle(e).transform })) )()`);
let revealChanged = 0;
for (let i = 0; i < reveal.length; i++) {
  await ev(`(() => { const e = [...document.querySelectorAll("[data-motion]")].filter(x => x.getBoundingClientRect().height > 20)[${i}]; if (e) e.scrollIntoView({block:"center"}); })()`);
  await sleep(900);
  const after = await ev(`(() => { const e = [...document.querySelectorAll("[data-motion]")].filter(x => x.getBoundingClientRect().height > 20)[${i}]; if (!e) return null; const s = getComputedStyle(e); return { op: s.opacity, tf: s.transform }; })()`);
  if (after && (after.op !== reveal[i].op || after.tf !== reveal[i].tf)) revealChanged++;
}
// marquee liveness (transform changes over 600ms)
await ev(`window.scrollTo(0, document.documentElement.scrollHeight * 0.45)`);
await sleep(800);
const m1 = await ev(`(() => [...document.querySelectorAll("[class*=marquee], [data-scroll]")].slice(0,5).map(e => getComputedStyle(e).transform))()`);
await sleep(700);
const m2 = await ev(`(() => [...document.querySelectorAll("[class*=marquee], [data-scroll]")].slice(0,5).map(e => getComputedStyle(e).transform))()`);
const moving = (m1 || []).filter((v, i) => v !== (m2 || [])[i]).length;

console.log(JSON.stringify({ url, viewport: `${W}x${H}`, inventory, revealSamples: reveal.length, revealChanged, movingSamples: moving }, null, 2));
cdp.close(); child.kill();
try { rmSync(profile, { recursive: true, force: true }); } catch {}
