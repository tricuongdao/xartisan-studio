// Headless full-page shooter (CDP over WebSocket, no external deps).
// Usage: node tools/qa/shoot.mjs <baseUrl> <routesFile> <outDir> <width> <height> [slugSuffix]
// Routes file: one path per line (e.g. /blog/page/2). Captures settled full-page PNGs.
import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const [baseUrl, routesFile, outDir, wArg, hArg, suffixArg] = process.argv.slice(2);
if (!baseUrl || !routesFile || !outDir) {
  console.error("usage: node tools/qa/shoot.mjs <baseUrl> <routesFile> <outDir> <width> <height> [slugSuffix]");
  process.exit(1);
}
const WIDTH = Number(wArg || 1440);
const HEIGHT = Number(hArg || 900);
const SUFFIX = suffixArg || "";
const MOBILE = WIDTH < 700;
// SHOOT_OFFSETS="0,3000,6600" switches to viewport mode: capture the viewport at
// each scroll offset (real-user view; deterministic for scroll-linked pinned pages).
const OFFSETS = process.env.SHOOT_OFFSETS ? process.env.SHOOT_OFFSETS.split(",").map(Number) : null;

const BROWSER = process.env.SHOOT_BROWSER || "C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe";
const routes = readFileSync(routesFile, "utf8").split(/\r?\n/).map(s => s.trim()).filter(l => l && !l.startsWith("#"));
mkdirSync(outDir, { recursive: true });
const profile = mkdtempSync(path.join(tmpdir(), "shoot-profile-"));

const child = spawn(BROWSER, [
  "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
  "--disable-extensions", "--mute-audio", "--force-device-scale-factor=1",
  `--window-size=${WIDTH},${HEIGHT}`, `--user-data-dir=${profile}`,
  "--remote-debugging-port=0", "about:blank",
], { stdio: ["ignore", "pipe", "pipe"] });

const wsUrl = await new Promise((resolve, reject) => {
  let buf = "";
  const t = setTimeout(() => reject(new Error("no DevTools endpoint in 25s")), 25000);
  child.stderr.on("data", d => {
    buf += d.toString();
    const m = /DevTools listening on (ws:\/\/[^\s]+)/.exec(buf);
    if (m) { clearTimeout(t); resolve(m[1]); }
  });
  child.on("exit", c => reject(new Error("browser exited " + c)));
});

class CDP {
  constructor(ws) { this.ws = ws; this.id = 0; this.pending = new Map(); this.listeners = []; }
  static async connect(url) {
    const ws = new WebSocket(url);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = e => rej(new Error("ws error")); });
    const c = new CDP(ws);
    ws.onmessage = ev => {
      const msg = JSON.parse(ev.data);
      if (msg.id && c.pending.has(msg.id)) {
        const { resolve, reject } = c.pending.get(msg.id);
        c.pending.delete(msg.id);
        msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
      } else if (msg.method) {
        for (const l of c.listeners) l(msg);
      }
    };
    return c;
  }
  send(method, params = {}, sessionId) {
    const id = ++this.id;
    const payload = { id, method, params };
    if (sessionId) payload.sessionId = sessionId;
    this.ws.send(JSON.stringify(payload));
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
  }
  waitEvent(method, sessionId, timeoutMs = 30000) {
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error("timeout waiting " + method)), timeoutMs);
      const l = msg => {
        if (msg.method === method && (!sessionId || msg.sessionId === sessionId)) {
          clearTimeout(t);
          this.listeners = this.listeners.filter(x => x !== l);
          resolve(msg.params);
        }
      };
      this.listeners.push(l);
    });
  }
  close() { try { this.ws.close(); } catch {} }
}

const cdp = await CDP.connect(wsUrl);
const sleep = ms => new Promise(r => setTimeout(r, ms));

const results = [];
for (const route of routes) {
  const slug = route.replace(/^\//, "").replace(/[\/?=&]+/g, "-").replace(/-+$/, "") || "root";
  const out = path.join(outDir, `${slug}${SUFFIX}-${WIDTH}-full.png`);
  const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
  try {
    await cdp.send("Page.enable", {}, sessionId);
    await cdp.send("Runtime.enable", {}, sessionId);
    await cdp.send("Emulation.setDeviceMetricsOverride",
      { width: WIDTH, height: HEIGHT, deviceScaleFactor: 1, mobile: MOBILE }, sessionId);
    const loaded = cdp.waitEvent("Page.loadEventFired", sessionId, 45000);
    await cdp.send("Page.navigate", { url: baseUrl + route }, sessionId);
    await loaded.catch(() => {});
    await sleep(1800);
    // wait for the intro/page loader to be gone (element removed or fully hidden)
    const loaderGone = `(() => {
      const els = [...document.querySelectorAll('.page-loader, [class*="page-loader"]')];
      if (!els.length) return true;
      return els.every(e => { const s = getComputedStyle(e);
        return s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) === 0; });
    })()`;
    let loaderWaited = 0;
    for (let i = 0; i < 75; i++) {
      const r = await cdp.send("Runtime.evaluate", { expression: loaderGone, returnByValue: true }, sessionId);
      if (r.result && r.result.value === true) break;
      loaderWaited += 0.8;
      await sleep(800);
    }
    // Viewport mode: capture at fixed scroll offsets (skips full-page capture)
    if (OFFSETS) {
      for (const y of OFFSETS) {
        await cdp.send("Runtime.evaluate", { expression: `window.scrollTo(0,${y})`, returnByValue: true }, sessionId);
        await sleep(Number(process.env.SHOOT_SETTLE_MS || 1500));
        const vp = await cdp.send("Page.captureScreenshot", { format: "png" }, sessionId);
        const vbuf = Buffer.from(vp.data, "base64");
        const vout = path.join(outDir, `${slug}-y${y}-vp.png`);
        writeFileSync(vout, vbuf);
        console.log(`${route} y=${y} -> ${path.basename(vout)} (${(vbuf.length / 1024).toFixed(0)} KB)`);
        results.push({ route, y, file: vout, bytes: vbuf.length });
      }
      continue;
    }
    // scroll sweep to trigger all reveal animations, then return to top
    // (SHOOT_NOSWEEP=1 skips the sweep: for scroll-linked pinned pages, a fresh
    //  scroll-0 state is more deterministic than a swept one)
    if (!process.env.SHOOT_NOSWEEP) {
      await cdp.send("Runtime.evaluate", {
        expression: `(async () => {
          const H = document.documentElement.scrollHeight;
          const step = Math.max(400, Math.round(innerHeight * 0.8));
          for (let y = 0; y <= H; y += step) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 80)); }
          window.scrollTo(0, 0);
          await new Promise(r => setTimeout(r, 500));
          return document.documentElement.scrollHeight;
        })()`,
        awaitPromise: true, returnByValue: true,
      }, sessionId);
    }
    await sleep(1300);
    const loaderStill = await cdp.send("Runtime.evaluate", { expression: loaderGone, returnByValue: true }, sessionId);
    const docH = await cdp.send("Runtime.evaluate",
      { expression: "document.documentElement.scrollHeight", returnByValue: true }, sessionId);
    const shot = await cdp.send("Page.captureScreenshot",
      { format: "png", captureBeyondViewport: true }, sessionId);
    const buf = Buffer.from(shot.data, "base64");
    writeFileSync(out, buf);
    const warn = loaderStill.result?.value === true ? "" : " [LOADER-STILL-UP]";
    results.push({ route, file: out, bytes: buf.length, docH: docH.result.value, loaderWaitS: loaderWaited, loaderUpAtCapture: loaderStill.result?.value !== true });
    console.log(`${route} -> ${path.basename(out)} (${(buf.length / 1024).toFixed(0)} KB, docH=${docH.result.value}, loaderWait=${loaderWaited}s)${warn}`);
  } catch (e) {
    results.push({ route, error: String(e).slice(0, 140) });
    console.log(`${route} ERROR: ${String(e).slice(0, 140)}`);
  } finally {
    await cdp.send("Target.closeTarget", { targetId }).catch(() => {});
  }
}

writeFileSync(path.join(outDir, `_shoot-report${SUFFIX}-${WIDTH}.json`), JSON.stringify(results, null, 2));
cdp.close();
child.kill();
await sleep(400);
try { rmSync(profile, { recursive: true, force: true }); } catch {}
console.log(`done: ${results.filter(r => r.file).length}/${routes.length} captured`);
