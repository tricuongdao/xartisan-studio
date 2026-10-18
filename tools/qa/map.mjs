// Print the DOM layout map of a page at a given viewport (headless CDP).
// Usage: node tools/qa/map.mjs <url> [width] [height]
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const [url, w = "1440", h = "900"] = process.argv.slice(2);
if (!url) { console.error("usage: node tools/qa/map.mjs <url> [width] [height]"); process.exit(1); }
const W = Number(w), H = Number(h);
const BROWSER = process.env.SHOOT_BROWSER || "C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe";
const profile = mkdtempSync(path.join(tmpdir(), "map-profile-"));
const child = spawn(BROWSER, [
  "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
  "--disable-extensions", "--mute-audio", "--force-device-scale-factor=1",
  `--window-size=${W},${H}`, `--user-data-dir=${profile}`, "--remote-debugging-port=0", "about:blank",
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
let id = 0; const pending = new Map(); const listeners = [];
ws.onmessage = ev => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
  } else listeners.forEach(l => l(msg));
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
await send("Emulation.setDeviceMetricsOverride", { width: W, height: H, deviceScaleFactor: 1, mobile: W < 700 }, sessionId);
await send("Page.navigate", { url }, sessionId);
await sleep(5500);
for (let i = 0; i < 40; i++) {
  const r = await send("Runtime.evaluate", {
    expression: "(() => { const l = document.querySelector('.page-loader'); if (!l) return true; const s = getComputedStyle(l); return s.display==='none'||Number(s.opacity)===0; })()",
    returnByValue: true,
  }, sessionId);
  if (r.result?.value === true) break;
  await sleep(800);
}
await sleep(Number(process.env.MAP_SETTLE_MS || 0));

const MAP = `(() => {
  const main = document.querySelector('main') || document.querySelector('#root');
  const out = [];
  const walk = (el, depth, path) => {
    if (depth > 2) return;
    const r = el.getBoundingClientRect();
    if (r.height < 8) return;
    out.push({ d: depth, path, tag: el.tagName.toLowerCase(), cls: String(el.className).slice(0, 66), top: Math.round(r.top + scrollY), h: Math.round(r.height) });
    [...el.children].forEach((c, i) => walk(c, depth + 1, path + '.' + i));
  };
  walk(main, 0, 'm');
  return { docH: document.documentElement.scrollHeight, nodes: out };
})()`;
const map = await send("Runtime.evaluate", { expression: MAP, returnByValue: true }, sessionId);
const { docH, nodes } = map.result.value;
console.log(`docH=${docH}  nodes=${nodes.length}`);
for (const n of nodes) console.log(`${'  '.repeat(n.d)}[${n.path}] h=${n.h} top=${n.top} ${n.tag}.${n.cls}`);

await send("Target.closeTarget", { targetId }).catch(() => {});
ws.close(); child.kill();
await sleep(300);
try { rmSync(profile, { recursive: true, force: true }); } catch {}
