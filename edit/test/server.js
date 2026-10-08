/* Static server for the E2E tests: serves THIS checkout on a fresh port (never a
   stale server left on 8123 from another worktree). If BASE is set, it is verified
   to serve this checkout (same bytes for edit/editor.js) before any test runs. */
"use strict";
const http = require("http");
const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "../..");
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "application/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".txt": "text/plain; charset=utf-8", ".woff2": "font/woff2" };

function startServer() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
      let abs = path.join(ROOT, p);
      if (!abs.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
      try {
        if (fs.statSync(abs).isDirectory()) {
          if (!p.endsWith("/")) { res.writeHead(301, { Location: p + "/" }); return res.end(); }
          abs = path.join(abs, "index.html");
        }
        const body = fs.readFileSync(abs);
        res.writeHead(200, { "Content-Type": TYPES[path.extname(abs).toLowerCase()] || "application/octet-stream", "Cache-Control": "no-store" });
        res.end(body);
      } catch (e) {
        res.writeHead(404, { "Content-Type": "text/plain" }); res.end("not found");
      }
    });
    srv.listen(0, "127.0.0.1", () => resolve({ base: "http://127.0.0.1:" + srv.address().port + "/", close: () => srv.close() }));
  });
}
function get(url) {
  return new Promise((resolve) => {
    http.get(url, (res) => { const b = []; res.on("data", (c) => b.push(c)); res.on("end", () => resolve({ status: res.statusCode, body: Buffer.concat(b) })); })
      .on("error", () => resolve({ status: 0, body: Buffer.alloc(0) }));
  });
}
async function serverForTests() {
  if (process.env.BASE) {
    const base = process.env.BASE.replace(/\/?$/, "/");
    const r = await get(base + "edit/editor.js");
    if (r.status !== 200 || !r.body.equals(fs.readFileSync(path.join(ROOT, "edit/editor.js")))) {
      throw new Error("BASE " + base + " does not serve this checkout (" + ROOT + "). Unset BASE to use a fresh server.");
    }
    return { base, close: () => {} };
  }
  return startServer();
}
module.exports = { serverForTests, ROOT };
