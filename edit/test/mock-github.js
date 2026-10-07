/* In-memory GitHub API mock for the edit-mode E2E test (Playwright route handler). */
"use strict";
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

function blobSha(text) {
  const b = Buffer.isBuffer(text) ? text : Buffer.from(text, "utf8");
  return crypto.createHash("sha1").update(`blob ${b.length}\0`).update(b).digest("hex");
}
function asUtf8(v) { return Buffer.isBuffer(v) ? v.toString("utf8") : v; }


class MockGitHub {
  constructor({ repo, root, tokens, overrides, scopes, noRepo, noPush }) {
    this.repo = repo; this.root = root; this.tokens = tokens; // token -> login
    this.scopes = scopes || {}; this.noRepo = noRepo || []; this.noPush = noPush || []; // per-token behaviour
    this.overrides = overrides || {};                            // path -> text (main)
    this.branches = { main: { files: {} } };                     // branch -> { files: path->text }
    this.log = []; this.pulls = []; this.hooks = {}; this.n = 1;
    this.blobs = {}; this.trees = {}; this.commits = {};
    this.heads = { main: this._newCommit("main", null) };
  }
  _newCommit(branch, parent) { const sha = crypto.randomBytes(20).toString("hex"); this.commits[sha] = { branch, parent, files: Object.assign({}, (parent && this.commits[parent].files) || {}) }; return sha; }
  file(p, branch = "main") {
    const c = this.commits[this.heads[branch] || branch];
    if (c && p in c.files) return c.files[p];
    if (p in this.overrides) return this.overrides[p];
    const abs = path.join(this.root, p);
    if (!(fs.existsSync(abs) && fs.statSync(abs).isFile())) return null;
    // Text for source/json; Buffer for images (detected by extension).
    if (/\.(png|jpe?g|gif|webp|avif)$/i.test(p)) return fs.readFileSync(abs);
    return fs.readFileSync(abs, "utf8");
  }
  setUpstream(p, text) { const parent = this.heads.main; const s = this._newCommit("main", parent); this.commits[s].files[p] = text; this.heads.main = s; }
  async handle(route) {
    const req = route.request();
    const url = new URL(req.url());
    const method = req.method();
    const auth = (req.headers()["authorization"] || "").replace(/^Bearer /, "");
    const login = this.tokens[auth];
    const body = req.postData() ? JSON.parse(req.postData()) : null;
    const entry = { method, path: url.pathname + url.search, body, login };
    this.log.push(entry);
    const headers = { "access-control-allow-origin": "*", "access-control-expose-headers": "ETag, Link, Location, X-OAuth-Scopes, X-Accepted-OAuth-Scopes" };
    if (auth.startsWith("ghp_")) headers["x-oauth-scopes"] = auth in this.scopes ? this.scopes[auth] : "public_repo";
    const json = (status, data) => route.fulfill({ status, headers, contentType: "application/json; charset=utf-8", body: JSON.stringify(data) });
    if (!login) return json(401, { message: "Bad credentials" });
    const R = "/repos/" + this.repo;
    const p = url.pathname;
    if (p === "/user") return json(200, { login });
    if (p === R) {
      if (this.noRepo.includes(auth)) return json(404, { message: "Not Found" });
      return json(200, { full_name: this.repo, permissions: { pull: true, push: !this.noPush.includes(auth), admin: false } });
    }
    if (this.hooks.before) { const r = this.hooks.before(entry); if (r) return json(r.status, r.data); }
    let m;
    if ((m = p.match(new RegExp("^" + R + "/contents/(.+)$")))) {
      const fp = decodeURIComponent(m[1]);
      if (method === "GET") {
        const ref = url.searchParams.get("ref") || "main";
        const text = this.file(fp, ref);
        if (text == null) return json(404, { message: "Not Found" });
        const buf = Buffer.isBuffer(text) ? text : Buffer.from(text, "utf8");
        return json(200, { type: "file", path: fp, sha: blobSha(text), encoding: "base64", content: buf.toString("base64"), size: buf.length });
      }
      if (method === "PUT") {
        const branch = body.branch || "main";
        const cur = this.file(fp, branch);
        if (cur != null && body.sha !== blobSha(cur)) return json(409, { message: `${fp} does not match ${body.sha}` });
        const raw = Buffer.from(body.content, "base64");
        const text = /\.(png|jpe?g|gif|webp|avif)$/i.test(fp) ? raw : raw.toString("utf8");
        const s = this._newCommit(branch, this.heads[branch]); this.commits[s].files[fp] = text; this.heads[branch] = s;
        entry.written = { path: fp, text: asUtf8(text), branch, message: body.message, binary: Buffer.isBuffer(text) };
        return json(200, { content: { path: fp, sha: blobSha(text) }, commit: { sha: s, html_url: `https://github.com/${this.repo}/commit/${s}` } });
      }
    }
    if ((m = p.match(new RegExp("^" + R + "/git/ref/heads/(.+)$")))) {
      const b = decodeURIComponent(m[1]);
      return this.heads[b] ? json(200, { object: { sha: this.heads[b] } }) : json(404, { message: "Not Found" });
    }
    if (p === R + "/git/refs" && method === "POST") {
      const b = body.ref.replace(/^refs\/heads\//, "");
      if (this.heads[b]) return json(422, { message: "Reference already exists" });
      this.heads[b] = body.sha; return json(201, { ref: body.ref, object: { sha: body.sha } });
    }
    if ((m = p.match(new RegExp("^" + R + "/git/commits/([0-9a-f]+)$")))) return json(200, { sha: m[1], tree: { sha: "tree-of-" + m[1] } });
    if (p === R + "/git/blobs" && method === "POST") { const sha = crypto.randomBytes(20).toString("hex"); this.blobs[sha] = Buffer.from(body.content, "base64"); return json(201, { sha }); }
    if (p === R + "/git/trees" && method === "POST") { const sha = crypto.randomBytes(20).toString("hex"); this.trees[sha] = { base: body.base_tree, entries: body.tree }; return json(201, { sha }); }
    if (p === R + "/git/commits" && method === "POST") {
      const sha = crypto.randomBytes(20).toString("hex");
      this.commits[sha] = { branch: null, parent: body.parents[0], files: Object.assign({}, this.commits[body.parents[0]].files), message: body.message };
      for (const e of this.trees[body.tree].entries) this.commits[sha].files[e.path] = this.blobs[e.sha];
      return json(201, { sha, html_url: `https://github.com/${this.repo}/commit/${sha}` });
    }
    if ((m = p.match(new RegExp("^" + R + "/git/refs/heads/(.+)$"))) && method === "PATCH") {
      const b = decodeURIComponent(m[1]);
      if (this.commits[body.sha].parent !== this.heads[b]) return json(422, { message: "Update is not a fast forward" });
      this.heads[b] = body.sha; entry.committed = { message: this.commits[body.sha].message, paths: Object.keys(this.commits[body.sha].files) };
      return json(200, { object: { sha: body.sha } });
    }
    if (p === R + "/pulls" && method === "POST") {
      const pr = { number: this.n++, html_url: `https://github.com/${this.repo}/pull/${this.n - 1}`, head: body.head, base: body.base, title: body.title, by: login };
      this.pulls.push(pr); return json(201, pr);
    }
    return json(404, { message: "mock: unhandled " + method + " " + p });
  }
}
module.exports = { MockGitHub, blobSha };
