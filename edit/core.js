/* Elorae edit mode: shared config, session storage and GitHub API helpers.
   The ONLY credential is the editor's own fine-grained token, pasted by them and kept in
   their browser (sessionStorage, or localStorage if they tick "remember"). It is sent
   only to api.github.com. Nothing secret is stored in the repository. */
(function () {
  "use strict";
  if (window.EloraeEdit) return;
  var REPO = "195142095142091920/elorae";
  var BRANCH = "main";
  var API = "https://api.github.com";
  var KEY = "elorae-edit-session";

  function siteRoot() {
    var s = document.querySelector('script[src*="edit/edit.js"]') || document.querySelector('script[src*="edit/core.js"]');
    var u = s ? new URL(s.getAttribute("src"), location.href) : new URL(location.href);
    return new URL("../", u).href; // edit/edit.js -> site root
  }
  var ROOT = siteRoot();

  function pagePath() {
    var rootPath = new URL(ROOT).pathname;
    var p = location.pathname;
    if (p.indexOf(rootPath) === 0) p = p.slice(rootPath.length);
    p = decodeURIComponent(p);
    if (p === "" || /\/$/.test(p)) p += "index.html";
    else if (!/\.[a-z0-9]+$/i.test(p)) p += ".html"; // pretty URL /journal -> journal.html
    return p;
  }

  var session = {
    get: function () {
      var raw = null;
      try { raw = sessionStorage.getItem(KEY) || localStorage.getItem(KEY); } catch (e) {}
      if (!raw) return null;
      try { var s = JSON.parse(raw); return s && s.token && s.login ? s : null; } catch (e) { return null; }
    },
    set: function (s) {
      var raw = JSON.stringify(s);
      try {
        sessionStorage.setItem(KEY, raw);
        if (s.remember) localStorage.setItem(KEY, raw); else localStorage.removeItem(KEY);
      } catch (e) {}
    },
    clear: function () {
      try { sessionStorage.removeItem(KEY); localStorage.removeItem(KEY); } catch (e) {}
    }
  };

  function ApiError(status, message, data) {
    var e = new Error(message || ("GitHub API error " + status));
    e.status = status; e.data = data; return e;
  }

  function api(path, opts) {
    opts = opts || {};
    var s = opts.token ? { token: opts.token } : session.get();
    var headers = { "Accept": opts.accept || "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" };
    if (s && s.token) headers.Authorization = "Bearer " + s.token;
    if (opts.body !== undefined) headers["Content-Type"] = "application/json";
    return fetch(API + path, {
      method: opts.method || "GET",
      headers: headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      cache: "no-store"
    }).then(function (r) {
      var ct = r.headers.get("content-type") || "";
      var p = /json/.test(ct) ? r.json() : r.text();
      return p.then(function (data) {
        if (!r.ok) throw ApiError(r.status, (data && data.message) || r.statusText, data);
        if (opts.withHeaders) return { data: data, scopes: r.headers.get("x-oauth-scopes") };
        return data;
      }, function () {
        if (!r.ok) throw ApiError(r.status, r.statusText);
        return null;
      });
    });
  }

  function enc(path) { return path.split("/").map(encodeURIComponent).join("/"); }
  function repoPath(p) { return "/repos/" + REPO + p; }

  function b64EncodeUtf8(str) {
    var bytes = new TextEncoder().encode(str), s = "";
    for (var i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s);
  }
  function b64EncodeBytes(u8) {
    var s = "";
    for (var i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
    return btoa(s);
  }
  function b64DecodeUtf8(b64) {
    var s = atob(String(b64).replace(/\s+/g, "")), u = new Uint8Array(s.length);
    for (var i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
    return new TextDecoder().decode(u);
  }

  // Current file at ref -> { sha, text }. Falls back to the raw media type for files > 1 MB.
  function getFile(path, ref) {
    var url = repoPath("/contents/" + enc(path) + "?ref=" + encodeURIComponent(ref || BRANCH));
    return api(url).then(function (d) {
      if (!d || Array.isArray(d) || d.type !== "file") throw ApiError(404, "Not a file: " + path);
      if (d.content && d.encoding === "base64") return { sha: d.sha, text: b64DecodeUtf8(d.content) };
      return api(url, { accept: "application/vnd.github.raw+json" }).then(function (t) { return { sha: d.sha, text: String(t) }; });
    });
  }

  function putFile(path, text, sha, message, branch) {
    var body = { message: message, content: b64EncodeUtf8(text), branch: branch || BRANCH };
    if (sha) body.sha = sha;
    return api(repoPath("/contents/" + enc(path)), { method: "PUT", body: body });
  }

  function headSha(branch) {
    return api(repoPath("/git/ref/heads/" + enc(branch || BRANCH))).then(function (d) { return d.object.sha; });
  }

  // One atomic commit with several files (non-forced ref update => detects concurrent pushes).
  // files: [{ path, text }]
  function commitFiles(files, message, branch) {
    branch = branch || BRANCH;
    var parent, baseTree;
    return headSha(branch).then(function (sha) {
      parent = sha;
      return api(repoPath("/git/commits/" + sha));
    }).then(function (c) {
      baseTree = c.tree.sha;
      return Promise.all(files.map(function (f) {
        var content = f.binary ? (f.contentBase64 || b64EncodeBytes(f.bytes)) : b64EncodeUtf8(f.text);
        return api(repoPath("/git/blobs"), { method: "POST", body: { content: content, encoding: "base64" } })
          .then(function (b) { return { path: f.path, mode: "100644", type: "blob", sha: b.sha }; });
      }));
    }).then(function (tree) {
      return api(repoPath("/git/trees"), { method: "POST", body: { base_tree: baseTree, tree: tree } });
    }).then(function (t) {
      return api(repoPath("/git/commits"), { method: "POST", body: { message: message, tree: t.sha, parents: [parent] } });
    }).then(function (commit) {
      return api(repoPath("/git/refs/heads/" + enc(branch)), { method: "PATCH", body: { sha: commit.sha, force: false } })
        .then(function () { return commit; });
    });
  }

  function loadJSON(path) {
    // Prefer the authoritative copy on GitHub (fresh); fall back to the deployed copy.
    var s = session.get();
    var viaApi = s ? getFile(path).then(function (f) { return JSON.parse(f.text); }) : Promise.reject(new Error("no session"));
    return viaApi.catch(function () {
      return fetch(ROOT + path + "?t=" + Date.now(), { cache: "no-store" }).then(function (r) {
        if (!r.ok) throw new Error("Could not load " + path);
        return r.json();
      });
    });
  }

  function loadScript(src) {
    return new Promise(function (res, rej) {
      var el = document.createElement("script");
      el.src = src; el.onload = res; el.onerror = function () { rej(new Error("load " + src)); };
      document.head.appendChild(el);
    });
  }

  // Token kinds by prefix (GitHub's documented token formats).
  function tokenKind(t) {
    t = String(t || "");
    if (/^github_pat_/.test(t)) return "fine-grained";
    if (/^ghp_/.test(t)) return "classic";
    if (/^gho_/.test(t)) return "oauth";
    if (/^(ghu|ghs)_/.test(t)) return "app";
    return "unknown";
  }
  var owner = REPO.split("/")[0];
  // Pre-filled "new token" pages. Classic: description + scopes are pre-filled (GitHub doesn't
  // pre-fill the expiry). Fine-grained (owner only; see SIGNIN-UX.md): name, description, owner,
  // expiry and permissions are pre-filled; the repository must still be picked by hand.
  var TOKEN_LINKS = {
    classic: "https://github.com/settings/tokens/new?description=" + encodeURIComponent("Elorae edit mode") + "&scopes=public_repo",
    fineGrained: "https://github.com/settings/personal-access-tokens/new?name=" + encodeURIComponent("Elorae edit mode") +
      "&description=" + encodeURIComponent("Edit pages of elorae.world in the browser (" + REPO + ")") +
      "&target_name=" + encodeURIComponent(owner) + "&expires_in=90&contents=write&pull_requests=write",
    invitations: "https://github.com/" + REPO + "/invitations",
    tokens: "https://github.com/settings/tokens"
  };

  window.EloraeEdit = {
    tokenKind: tokenKind, TOKEN_LINKS: TOKEN_LINKS, OWNER: owner,
    REPO: REPO, BRANCH: BRANCH, API: API, ROOT: ROOT,
    pagePath: pagePath, session: session, api: api, repoPath: repoPath,
    getFile: getFile, putFile: putFile, headSha: headSha, commitFiles: commitFiles, loadJSON: loadJSON, loadScript: loadScript,
    b64EncodeUtf8: b64EncodeUtf8, b64EncodeBytes: b64EncodeBytes, b64DecodeUtf8: b64DecodeUtf8,
    sealWho: function () { try { return localStorage.getItem("elorae-seal") || ""; } catch (e) { return ""; } }
  };
})();
