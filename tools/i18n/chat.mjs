// Exercise the client-side chatbot in English and print the reply.
// Usage: node tools/i18n/chat.mjs <baseUrl> "<question>"
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const [baseUrl, question] = process.argv.slice(2);
const BROWSER = "C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe";
const profile = mkdtempSync(path.join(tmpdir(), "chat-profile-"));
const child = spawn(BROWSER, ["--headless=new", "--disable-gpu", "--no-first-run", "--disable-extensions", "--mute-audio",
  "--window-size=1440,900", `--user-data-dir=${profile}`, "--remote-debugging-port=0", "about:blank"], { stdio: ["ignore", "pipe", "pipe"] });
const wsUrl = await new Promise((resolve, reject) => {
  let buf = ""; const t = setTimeout(() => reject(new Error("no devtools")), 25000);
  child.stderr.on("data", (d) => { buf += d.toString(); const m = /DevTools listening on (ws:\/\/[^\s]+)/.exec(buf); if (m) { clearTimeout(t); resolve(m[1]); } });
});
class CDP {
  constructor(ws) { this.ws = ws; this.id = 0; this.pending = new Map(); }
  static async connect(url) { const ws = new WebSocket(url); await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
    const c = new CDP(ws); ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && c.pending.has(m.id)) { const p = c.pending.get(m.id); c.pending.delete(m.id); m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result); } }; return c; }
  send(method, params = {}, sessionId) { const id = ++this.id; this.ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) })); return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject })); }
}
const cdp = await CDP.connect(wsUrl);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" });
const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
await cdp.send("Page.enable", {}, sessionId);
await cdp.send("Runtime.enable", {}, sessionId);
await cdp.send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false }, sessionId);
await cdp.send("Page.navigate", { url: baseUrl + "/" }, sessionId);
await sleep(4000);
const ev = async (expr, awaitPromise = false) => (await cdp.send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise }, sessionId)).result?.value;

// the assistant panel is mounted on load; find its textarea and scope everything to that panel
const PANEL = `(() => { const ta = [...document.querySelectorAll("textarea")].find(e => e.offsetParent); if (!ta) return null; return ta.closest("[class*=fixed],[role=dialog],[class*=sheet],[class*=drawer]") || ta.parentElement.parentElement; })()`;
console.log("panel:", await ev(`${PANEL} ? "found" : "missing"`));
console.log("panel before:\n" + String(await ev(`(() => { const p = ${PANEL}; return p ? p.innerText.slice(-600) : "(none)"; })()`)));
console.log("send:", await ev(`(() => {
  const ta = [...document.querySelectorAll("textarea")].find(e => e.offsetParent);
  if (!ta) return "no input";
  const panel = ta.closest("[class*=fixed],[role=dialog],[class*=sheet],[class*=drawer]") || ta.parentElement.parentElement;
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set;
  setter.call(ta, ${JSON.stringify(question)});
  ta.dispatchEvent(new Event("input", { bubbles: true }));
  const btn = [...panel.querySelectorAll("button")].find(b => b.type === "submit" || /send|gửi/i.test((b.getAttribute("aria-label")||b.textContent||"")));
  if (btn) { btn.click(); return "clicked"; }
  ta.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", keyCode: 13, bubbles: true }));
  return "enter";
})()`));
await sleep(5000);
const out = await ev(`(() => { const p = ${PANEL}; return p ? p.innerText : "(panel closed)"; })()`);
console.log("\n--- conversation ---\n" + String(out).slice(-2000));
cdp.close(); child.kill();
try { rmSync(profile, { recursive: true, force: true }); } catch {}
