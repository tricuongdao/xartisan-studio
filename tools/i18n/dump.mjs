// Dump rendered copy for review: headings, controls, and body text.
// Usage: node tools/i18n/dump.mjs <baseUrl> <route...>
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const [baseUrl, ...routes] = process.argv.slice(2);
const BROWSER = "C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe";
const profile = mkdtempSync(path.join(tmpdir(), "dump-profile-"));
const child = spawn(BROWSER, [
  "--headless=new", "--disable-gpu", "--no-first-run", "--disable-extensions", "--mute-audio",
  "--window-size=1440,900", `--user-data-dir=${profile}`, "--remote-debugging-port=0", "about:blank",
], { stdio: ["ignore", "pipe", "pipe"] });
const wsUrl = await new Promise((resolve, reject) => {
  let buf = "";
  const t = setTimeout(() => reject(new Error("no devtools")), 25000);
  child.stderr.on("data", (d) => {
    buf += d.toString();
    const m = /DevTools listening on (ws:\/\/[^\s]+)/.exec(buf);
    if (m) { clearTimeout(t); resolve(m[1]); }
  });
});
class CDP {
  constructor(ws) { this.ws = ws; this.id = 0; this.pending = new Map(); }
  static async connect(url) {
    const ws = new WebSocket(url);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    const c = new CDP(ws);
    ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && c.pending.has(m.id)) { const p = c.pending.get(m.id); c.pending.delete(m.id); m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result); }
    };
    return c;
  }
  send(method, params = {}, sessionId) {
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
  }
}
const cdp = await CDP.connect(wsUrl);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

for (const route of routes) {
  const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
  await cdp.send("Page.enable", {}, sessionId);
  await cdp.send("Runtime.enable", {}, sessionId);
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false }, sessionId);
  await cdp.send("Page.navigate", { url: baseUrl + route }, sessionId);
  await sleep(3500);
  for (let i = 0; i < 9; i++) {
    const r = await cdp.send("Runtime.evaluate", {
      expression: `![...document.querySelectorAll('.page-loader')].some(e => { const s = getComputedStyle(e); return s.display !== 'none' && Number(s.opacity) > 0.01; })`,
      returnByValue: true,
    }, sessionId);
    if (r.result?.value) break;
    await sleep(1000);
  }
  const out = await cdp.send("Runtime.evaluate", {
    expression: `(() => {
      const uniq = (a) => [...new Set(a.map(s => s.replace(/\\s+/g, " ").trim()).filter(Boolean))];
      const heads = uniq([...document.querySelectorAll("h1,h2,h3,h4")].filter(e => e.offsetParent).map(e => e.innerText));
      const ctrls = uniq([...document.querySelectorAll("button,a[role=button],label[for],input[placeholder],summary")].filter(e => e.offsetParent).map(e => e.innerText || e.getAttribute("placeholder") || e.getAttribute("aria-label") || ""));
      const body = (document.body.innerText || "").replace(/\\n{2,}/g, "\\n").trim();
      return { title: document.title, heads, ctrls, body };
    })()`,
    returnByValue: true,
  }, sessionId);
  const v = out.result.value;
  console.log(`\n\n===== ${route} =====\nTITLE: ${v.title}`);
  console.log(`--- headings ---\n${v.heads.join("\n")}`);
  console.log(`--- controls ---\n${v.ctrls.join(" | ")}`);
  console.log(`--- body ---\n${v.body.slice(0, 4200)}`);
  await cdp.send("Target.closeTarget", { targetId }).catch(() => {});
  await sleep(300);
}
child.kill();
try { rmSync(profile, { recursive: true, force: true }); } catch {}
