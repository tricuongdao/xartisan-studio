// Zero-dependency static server for the Xartisan Studio site.
// Supports clean directory URLs, plain 404 for unknown paths,
// byte-range support for media, sensible cache headers.
// Usage: node server/serve.mjs  (PORT env overrides default 8788)
import http from "node:http";
import { createReadStream } from "node:fs";
import { stat, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "site");
const PORT = Number(process.env.PORT || 8788);
const HOST = process.env.HOST || "127.0.0.1";

const legacy = JSON.parse(await readFile(path.join(ROOT, "redirects.json"), "utf8"));
const REDIRECTS = new Map(legacy.map(({ from, to }) => [from, to]));
const PREFIX_REDIRECTS = new Map([
  ["/du-an", "/projects"],
  ["/ximitech", "/xartisan"],
]);

// URL behavior:
//  - unknown paths under /blog/ and /projects/ serve the generic SPA shell with 200
//  - every other unknown path (incl. missing assets) serves the site's 404 page with status 404
const SHELL_PAGE = path.join(ROOT, "index.html");
const NOT_FOUND_PAGE = path.join(ROOT, "404", "index.html");
// Exact 301 body kept for stable redirect output.
const REDIRECT_BODY = "<html>\r\n<head><title>301 Moved Permanently</title></head>\r\n<body>\r\n<center><h1>301 Moved Permanently</h1></center>\r\n<hr><center>nginx/1.31.6</center>\r\n</body>\r\n</html>\r\n";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".ico": "image/x-icon",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".ttf": "font/ttf",
  ".map": "application/json",
  ".pdf": "application/pdf",
};

function resolveSafe(urlPath) {
  const decoded = decodeURIComponent(urlPath.split("?")[0].split("#")[0]);
  const p = path.normalize(decoded).replace(/^([/\\])+/, "");
  const abs = path.resolve(ROOT, p);
  if (!abs.startsWith(ROOT)) return null;
  return abs;
}

async function findFile(abs) {
  try {
    const s = await stat(abs);
    if (s.isFile()) return { file: abs, stat: s };
    if (s.isDirectory()) {
      const idx = path.join(abs, "index.html");
      const si = await stat(idx);
      if (si.isFile()) return { file: idx, stat: si };
    }
  } catch {}
  return null;
}

function cacheHeader(file) {
  const rel = path.relative(ROOT, file).replaceAll("\\", "/");
  if (rel.endsWith(".html") || rel.endsWith(".xml") || rel.endsWith(".txt")) return "no-cache";
  return "public, max-age=31536000, immutable";
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.writeHead(405, { "Content-Type": "text/plain; charset=utf-8" });
      return res.end("Method Not Allowed");
    }
    const urlPath = decodeURIComponent(((req.url || "/").split("?")[0]).split("#")[0]);
    const norm = urlPath.length > 1 ? urlPath.replace(/\/+$/, "") : urlPath;
    let target = REDIRECTS.get(norm);
    if (!target) {
      for (const [from, to] of PREFIX_REDIRECTS) {
        if (norm === from || norm.startsWith(from + "/")) {
          target = to + norm.slice(from.length);
          break;
        }
      }
    }
    if (target) {
      const qi = (req.url || "").indexOf("?");
      const query = qi === -1 ? "" : (req.url || "").slice(qi);
      const body = req.method === "HEAD" ? "" : REDIRECT_BODY;
      res.writeHead(301, { Location: target + query, "Content-Type": "text/html", "Content-Length": Buffer.byteLength(body), "Cache-Control": "no-cache" });
      return res.end(body);
    }
    let abs = resolveSafe(req.url || "/");
    let found = abs && await findFile(abs);
    // Trailing-slash parity: /x/ behaves like /x (dir index) — same as origin (200, no redirect)
    if (!found && abs && !abs.endsWith(path.sep) && !path.extname(abs)) {
      found = await findFile(path.join(abs, "index.html"));
      if (!found) found = await findFile(abs + ".html");
    }
    let status = 200;
    if (!found) {
      // No matching file: use the site's configured fallback.
      const hasExt = path.extname(norm) !== "";
      const nsShell = !hasExt && /^\/(blog|projects)(\/|$)/.test(norm);
      const page = nsShell ? SHELL_PAGE : NOT_FOUND_PAGE;
      try {
        const stPage = await stat(page);
        found = { file: page, stat: stPage };
        status = nsShell ? 200 : 404;
      } catch {
        res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        return res.end("Not Found");
      }
    }
    const { file, stat: st } = found;
    const ext = path.extname(file).toLowerCase();
    const type = MIME[ext] || "application/octet-stream";
    const headers = {
      "Content-Type": type,
      "Accept-Ranges": "bytes",
      "Cache-Control": cacheHeader(file),
      "Last-Modified": st.mtime.toUTCString(),
      "ETag": `"${st.size.toString(16)}-${st.mtimeMs.toString(16)}"`,
    };
    // Conditional GET
    if (req.headers["if-none-match"] === headers["ETag"]) {
      res.writeHead(304, headers);
      return res.end();
    }
    // Range support (single range)
    const range = req.headers.range;
    if (range && /^bytes=\d*-\d*$/.test(range)) {
      const [startS, endS] = range.replace("bytes=", "").split("-");
      let start = startS ? parseInt(startS, 10) : st.size - parseInt(endS, 10);
      let end = endS ? parseInt(endS, 10) : st.size - 1;
      if (isNaN(start)) start = 0;
      if (isNaN(end) || end >= st.size) end = st.size - 1;
      if (start > end || start >= st.size) {
        res.writeHead(416, { ...headers, "Content-Range": `bytes */${st.size}` });
        return res.end();
      }
      headers["Content-Range"] = `bytes ${start}-${end}/${st.size}`;
      headers["Content-Length"] = end - start + 1;
      res.writeHead(206, headers);
      if (req.method === "HEAD") return res.end();
      return createReadStream(file, { start, end }).pipe(res);
    }
    headers["Content-Length"] = st.size;
    res.writeHead(status, headers);
    if (req.method === "HEAD") return res.end();
    createReadStream(file).pipe(res);
  } catch (e) {
    res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Internal error: " + e.message);
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Xartisan Studio site served at http://${HOST}:${PORT}/  (root: ${ROOT})`);
});
