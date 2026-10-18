// One-off UI probe on the clone: chatbot open/reply + theme toggle + search.
// Usage: node tools/qa/probe-ui.mjs <baseUrl>
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { RESEARCH } from "../lib/paths.mjs";

const base = process.argv[2] || "http://127.0.0.1:8788";
const BROWSER = process.env.SHOOT_BROWSER || "C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe";
const profile = mkdtempSync(path.join(tmpdir(), "probe-profile-"));
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
let id = 0; const pending = new Map();
ws.onmessage = ev => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
  }
};
const send = (method, params = {}, sessionId) => {
  const i = ++id; const p = { id: i, method, params };
  if (sessionId) p.sessionId = sessionId;
  ws.send(JSON.stringify(p));
  return new Promise((resolve, reject) => pending.set(i, { resolve, reject }));
};
const sleep = ms => new Promise(r => setTimeout(r, ms));
const { targetId } = await send("Target.createTarget", { url: "about:blank" });
const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
await send("Page.enable", {}, sessionId);
await send("Runtime.enable", {}, sessionId);
await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false }, sessionId);
await send("Page.navigate", { url: base + "/" }, sessionId);
await sleep(4000);
for (let i = 0; i < 40; i++) {
  const r = await send("Runtime.evaluate", {
    expression: "(() => { const l = document.querySelector('.page-loader'); if (!l) return true; const s = getComputedStyle(l); return s.display==='none'||Number(s.opacity)===0; })()",
    returnByValue: true,
  }, sessionId);
  if (r.result?.value === true) break;
  await sleep(800);
}
const ev = async (expr, awaitPromise = false) => (await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise }, sessionId)).result?.value;

// 1. inventory interactive elements
console.log("fixed elements:", await ev(`(() => [...document.querySelectorAll('body > * , body button, body a')].filter(e=>{const s=getComputedStyle(e);return s.position==='fixed' && e.offsetHeight>0;}).map(e=>({tag:e.tagName, txt:(e.textContent||'').trim().slice(0,40), cls:String(e.className).slice(0,70)})).slice(0,10))()`));
console.log("buttons with chat-ish labels:", await ev(`(() => [...document.querySelectorAll('button')].filter(b=>/chat|tư vấn|hỏi|zalo|message/i.test((b.getAttribute('aria-label')||'')+(b.title||'')+b.className)).map(b=>({aria:b.getAttribute('aria-label'), cls:String(b.className).slice(0,60)})).slice(0,8))()`));

// 2. theme toggle: find button that flips the html class
const before = await ev("document.documentElement.className");
const toggled = await ev(`(() => {
  const cands = [...document.querySelectorAll('header button, button')].filter(b => /theme|dark|light|sáng|tối/i.test((b.getAttribute('aria-label')||'')+(b.title||'')+b.className));
  if (!cands.length) return 'no-theme-button';
  cands[0].click();
  return 'clicked:' + ((cands[0].getAttribute('aria-label')||cands[0].className) + '').slice(0, 50);
})()`);
await sleep(800);
const after = await ev("document.documentElement.className");
console.log("theme:", toggled, "| html class:", JSON.stringify(before), "->", JSON.stringify(after));
await ev(`(() => { const cands=[...document.querySelectorAll('button')].filter(b=>/theme|dark|light|sáng|tối/i.test((b.getAttribute('aria-label')||'')+(b.title||'')+b.className)); if(cands[0]) cands[0].click(); return true; })()`); // toggle back
await sleep(500);

// 3. chatbot roundtrip
console.log("inputs on page:", await ev(`(() => [...document.querySelectorAll('input, textarea')].map(i=>({tag:i.tagName, ph:i.placeholder||'', vis:i.offsetHeight>0})).slice(0,10))()`));
console.log("chat-ish buttons:", await ev(`(() => [...document.querySelectorAll('button')].filter(b=>/chat|hỏi|câu hỏi|tư vấn|trợ/i.test((b.getAttribute('aria-label')||'')+(b.textContent||'').slice(0,20))).map(b=>({aria:b.getAttribute('aria-label')||'', txt:(b.textContent||'').trim().slice(0,30), vis:b.offsetHeight>0})).slice(0,8))()`));
const opened = await ev(`(() => {
  const b = [...document.querySelectorAll('button')].find(b => /chat/i.test(b.className) || /chat|trợ lý|tư vấn/i.test(b.getAttribute('aria-label')||''));
  if (!b) return 'no-launcher';
  b.click(); return 'clicked:' + (b.getAttribute('aria-label')||b.className.slice(0,40));
})()`);
console.log("launcher:", opened);
await sleep(1200);
console.log("after open, inputs:", await ev(`(() => [...document.querySelectorAll('input, textarea')].filter(i=>i.offsetHeight>0).map(i=>({tag:i.tagName, ph:i.placeholder||''})).slice(0,6))()`));
const typed = await ev(`(() => {
  const inp = [...document.querySelectorAll('input, textarea')].find(i => i.offsetHeight > 0 && !/search|tìm/i.test(i.placeholder||''));
  if (!inp) return 'no-input';
  inp.scrollIntoView({ block: 'center' });
  const proto = inp.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
  setter.call(inp, 'Chi phí thiết kế website là bao nhiêu?');
  inp.dispatchEvent(new Event('input', { bubbles: true }));
  return 'typed';
})()`);
console.log("typing:", typed);
await sleep(400);
const sent = await ev(`(() => {
  const b = [...document.querySelectorAll('button')].find(b => /Gửi câu hỏi|gửi/i.test(b.getAttribute('aria-label')||''));
  if (!b) return 'no-send';
  b.click(); return 'sent';
})()`);
console.log("send:", sent);
await sleep(25000);
const convo = await ev(`(() => {
  const el = [...document.querySelectorAll('section,div')].filter(e => /Trợ lý XimiTech/.test(e.innerText || '') && e.innerText.length < 6000).sort((a, b) => b.innerText.length - a.innerText.length)[0];
  return el ? el.innerText.replace(/\\n+/g, ' | ').slice(0, 1200) : 'no-panel';
})()`);
console.log("chat container text:", convo);
const msgCount = await ev(`(() => {
  const ta = [...document.querySelectorAll('textarea')].find(i => /Hỏi về gói dịch vụ/i.test(i.placeholder||''));
  if (!ta) return null;
  let el = ta; for (let i = 0; i < 6 && el.parentElement; i++) el = el.parentElement;
  return { imgs: el.querySelectorAll('img').length, divs: el.querySelectorAll('div').length, bubbles: el.querySelectorAll('[class*=bubble],[class*=message]').length };
})()`);
console.log("chat container stats:", JSON.stringify(msgCount));
const shot = await send("Page.captureScreenshot", { format: "png" }, sessionId);
mkdirSync(path.join(RESEARCH, "recap"), { recursive: true });
writeFileSync(path.join(RESEARCH, "recap", "clone-chat-test.png"), Buffer.from(shot.data, "base64"));
console.log("chat screenshot saved");

await send("Target.closeTarget", { targetId }).catch(() => {});
ws.close(); child.kill();
await sleep(300);
try { rmSync(profile, { recursive: true, force: true }); } catch {}
