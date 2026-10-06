/* Elorae edit mode: sign-in panel, EDIT glyph, in-place editing and save.
   Loaded on demand by edit/edit.js (never for anonymous visitors). */
(function () {
  "use strict";
  var E = window.EloraeEdit, P = window.EloraeEditPerms, M = window.EloraeSrcMap;
  if (!E || !P || !M || window.EloraeEditor) return;

  var X_SVG = '<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M1.5 1.5L12.5 12.5M12.5 1.5L1.5 12.5" fill="none" stroke="#f3eee6" stroke-width="1" stroke-linecap="round" vector-effect="non-scaling-stroke"/></svg>';
  var PATH = E.pagePath();
  var state = { profiles: null, profile: null, editing: false, base: null, records: [], busy: false };

  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function el(tag, attrs, html) {
    var n = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    if (html != null) n.innerHTML = html;
    return n;
  }

  /* ---------------- Sign-in panel ---------------- */
  function panel() {
    var p = $("ee-panel");
    if (p) return p;
    p = el("div", { id: "ee-panel", hidden: "" });
    p.innerHTML =
      '<div class="ee-scrim" data-ee-close="1"></div>' +
      '<div class="ee-box" role="dialog" aria-modal="true" aria-label="Edit sign in">' +
      '<button type="button" class="ee-close" data-ee-close="1" aria-label="Close">' + X_SVG + '</button>' +
      '<div class="ee-body" id="ee-body"></div></div>';
    document.body.appendChild(p);
    p.addEventListener("click", function (e) {
      if (e.target.closest && e.target.closest("[data-ee-close]")) closePanel();
    });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !p.hidden) closePanel(); });
    return p;
  }
  function closePanel() {
    var p = $("ee-panel");
    if (p) p.hidden = true;
    if (location.hash === "#edit") history.replaceState(null, "", location.pathname + location.search);
  }
  function openPanel() {
    var p = panel();
    renderPanel();
    p.hidden = false;
    var t = $("ee-token");
    if (t) setTimeout(function () { t.focus(); }, 30);
  }
  function permSummary(pr) {
    if (!pr) return "";
    if (P.isAdmin(pr)) return (pr.title || "Admin") + " · whole site";
    var l = P.permList(pr);
    return l.length ? "Can edit: " + l.join(", ") : "View only";
  }
  function renderPanel(msg) {
    var b = $("ee-body"); if (!b) return;
    var s = E.session.get();
    if (s) {
      var pr = state.profile;
      var here = pr && P.canEdit(pr, PATH) ? "You can edit this page." : "You can't edit this page.";
      b.innerHTML =
        '<p class="ee-k">Edit</p>' +
        '<p class="ee-who">' + esc((pr && pr.name) || s.login) + ' <span>@' + esc(s.login) + '</span></p>' +
        '<p class="ee-note">' + esc(permSummary(pr)) + (pr ? ' · saves ' + (P.saveMode(pr) === "direct" ? "straight to the site" : "as a pull request") : "") + '</p>' +
        '<p class="ee-note">' + esc(here) + '</p>' +
        (msg ? '<p class="ee-err">' + esc(msg) + '</p>' : '') +
        '<div class="ee-row">' +
        (pr && P.isAdmin(pr) ? '<a class="ee-btn" href="' + esc(E.ROOT + "edit/dashboard.html") + '">Dashboard</a>' : '') +
        '<button type="button" class="ee-btn" id="ee-signout">Sign out</button></div>';
      $("ee-signout").onclick = function () { E.session.clear(); state.profile = null; cancelEdit(); glyph(); renderPanel(); notify(); };
      return;
    }
    b.innerHTML =
      '<p class="ee-k">Edit</p>' +
      '<form id="ee-form" autocomplete="off">' +
      '<input id="ee-token" type="password" placeholder="GitHub token" spellcheck="false" autocomplete="off" aria-label="GitHub fine-grained token">' +
      '<label class="ee-check"><input type="checkbox" id="ee-remember"> Remember on this device</label>' +
      '<div class="ee-row"><button type="submit" class="ee-btn">Sign in</button></div>' +
      '<p class="ee-err" id="ee-err"' + (msg ? '' : ' hidden') + '>' + esc(msg || "") + '</p>' +
      '<p class="ee-note">Your own fine-grained token, this repository only, Contents: read and write. It stays in this browser and is sent only to GitHub. <a href="https://github.com/' + E.REPO + '/blob/main/edit/README.md" target="_blank" rel="noopener">How</a></p>' +
      '</form>';
    $("ee-form").onsubmit = function (e) {
      e.preventDefault();
      signIn($("ee-token").value.trim(), $("ee-remember").checked);
    };
  }
  function showErr(m) { var x = $("ee-err"); if (x) { x.textContent = m; x.hidden = false; } else renderPanel(m); }

  function signIn(token, remember) {
    if (!token) return showErr("Paste your token.");
    var login;
    showErr("Checking…");
    E.api("/user", { token: token }).then(function (u) {
      login = u.login;
      return E.api(E.repoPath(""), { token: token });
    }).then(function (repo) {
      if (!repo.permissions || !repo.permissions.push) throw new Error("This token can read but not write " + E.REPO + ". Give it Contents: read and write.");
      return E.getFileWith(token, "edit/profiles.json");
    }).then(function (f) {
      var doc = JSON.parse(f.text);
      var pr = P.profileFor(doc, login);
      if (!pr) throw new Error("@" + login + " has no edit profile yet. Ask the site owner to add you to edit/profiles.json.");
      state.profiles = doc; state.profile = pr;
      E.session.set({ token: token, login: login, remember: !!remember, person: pr.person || "", role: pr.role || "" });
      notify();
      renderPanel(); glyph();
    }).catch(function (err) {
      showErr(err.status === 401 ? "GitHub rejected that token (expired or mistyped)." : (err.message || "Sign-in failed."));
    });
  }
  function notify() { try { window.dispatchEvent(new Event("elorae-edit-session")); } catch (e) {} }

  E.getFileWith = function (token, path) {
    // Uses the candidate token for this one call without persisting it.
    return E.api(E.repoPath("/contents/" + path + "?ref=" + E.BRANCH), { token: token }).then(function (d) {
      return { sha: d.sha, text: E.b64DecodeUtf8(d.content) };
    });
  };

  /* ---------------- EDIT glyph ---------------- */
  function liveBlocks() { return M.collectBlocks(document.body, M.DOM).filter(function (n) { return !n.closest("#ee-panel,#ee-bar"); }); }
  function glyph() {
    var g = $("ee-glyph");
    var ok = !!(E.session.get() && state.profile && P.canEdit(state.profile, PATH) && liveBlocks().length);
    if (!ok) { if (g) g.remove(); return; }
    if (g) return;
    g = el("button", { id: "ee-glyph", type: "button", "aria-label": "Edit this page" }, "Edit");
    g.onclick = function () { if (!state.editing) startEdit(); };
    document.body.appendChild(g);
  }

  /* ---------------- Edit mode ---------------- */
  function bar(html, cls) {
    var b = $("ee-bar");
    if (!b) { b = el("div", { id: "ee-bar", role: "region", "aria-label": "Edit mode" }); document.body.appendChild(b); }
    b.className = cls || "";
    b.innerHTML = html;
    return b;
  }
  function closeBar() { var b = $("ee-bar"); if (b) b.remove(); }
  function canon(html) { var t = document.createElement("template"); t.innerHTML = html; return t.innerHTML; }
  function textOf(html) { var t = document.createElement("template"); t.innerHTML = html; return norm(t.content.textContent); }
  function norm(s) { return String(s || "").replace(/\s+/g, " ").trim(); }

  function startEdit() {
    if (state.editing || state.busy) return;
    if (!P.canEdit(state.profile, PATH)) return;
    state.busy = true;
    bar('<span class="ee-msg">Loading the page source…</span>');
    E.getFile(PATH).then(function (f) {
      var src = M.sourceBlocks(f.text), live = liveBlocks();
      var recs = [];
      for (var i = 0; i < src.length && i < live.length; i++) {
        var n = live[i], s = src[i];
        if (n.tagName.toLowerCase() !== s.tag) continue;
        if (textOf(s.inner) !== norm(n.textContent)) continue; // page scripts changed it; don't touch
        var orig = n.innerHTML, c = canon(s.inner);
        if (orig !== c) n.innerHTML = c;
        recs.push({ el: n, idx: i, src: s, original: orig, start: n.innerHTML });
      }
      if (!recs.length) throw new Error("Nothing on this page could be matched to its source safely.");
      state.base = { sha: f.sha, text: f.text, blocks: src };
      state.records = recs;
      recs.forEach(function (r) {
        r.el.setAttribute("contenteditable", "true");
        r.el.setAttribute("spellcheck", "true");
        r.el.classList.add("ee-editable");
      });
      document.documentElement.classList.add("ee-editing");
      document.addEventListener("keydown", onKey, true);
      document.addEventListener("paste", onPaste, true);
      document.addEventListener("click", onClick, true);
      state.editing = true;
      editBar();
    }).catch(function (err) {
      bar('<span class="ee-msg ee-bad">' + esc(err.message || "Could not start editing.") + '</span><button type="button" class="ee-btn" id="ee-x">Close</button>');
      $("ee-x").onclick = closeBar;
    }).then(function () { state.busy = false; });
  }
  function editBar(msg, cls) {
    var mode = P.saveMode(state.profile) === "direct" ? "Saves to the live site" : "Saves as a pull request";
    bar('<span class="ee-msg">' + esc(msg || ("Editing · " + mode)) + '</span>' +
      '<button type="button" class="ee-btn" id="ee-cancel">Cancel</button>' +
      '<button type="button" class="ee-btn ee-primary" id="ee-save">Save</button>', cls);
    $("ee-save").onclick = save;
    $("ee-cancel").onclick = function () { cancelEdit(); closeBar(); };
  }
  function onKey(e) {
    if (!e.target.closest || !e.target.closest(".ee-editable")) return;
    if (e.key === "Enter") { e.preventDefault(); document.execCommand("insertLineBreak"); }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") { e.preventDefault(); save(); }
  }
  function onPaste(e) {
    if (!e.target.closest || !e.target.closest(".ee-editable")) return;
    e.preventDefault();
    var t = (e.clipboardData || window.clipboardData).getData("text/plain");
    document.execCommand("insertText", false, t);
  }
  function onClick(e) {
    var a = e.target.closest && e.target.closest(".ee-editable a");
    if (a) e.preventDefault(); // editing a link's text shouldn't navigate
  }
  function stopEditing() {
    state.records.forEach(function (r) {
      r.el.removeAttribute("contenteditable"); r.el.removeAttribute("spellcheck"); r.el.classList.remove("ee-editable");
    });
    document.documentElement.classList.remove("ee-editing");
    document.removeEventListener("keydown", onKey, true);
    document.removeEventListener("paste", onPaste, true);
    document.removeEventListener("click", onClick, true);
    state.editing = false;
  }
  function cancelEdit() {
    if (!state.editing) return;
    state.records.forEach(function (r) { r.el.innerHTML = r.original; });
    stopEditing();
    state.records = [];
  }

  /* ---------------- Sanitizer ---------------- */
  var INLINE = { a: 1, em: 1, strong: 1, i: 1, b: 1, u: 1, s: 1, sub: 1, sup: 1, small: 1, span: 1, code: 1, cite: 1, q: 1, abbr: 1 };
  var DROP = { script: 1, style: 1, iframe: 1, object: 1, embed: 1, svg: 1, math: 1, template: 1, noscript: 1, link: 1, meta: 1, img: 1, video: 1, audio: 1, canvas: 1, form: 1, input: 1, button: 1, select: 1, textarea: 1, frame: 1, frameset: 1, base: 1 };
  var NESTS = { blockquote: 1, li: 1, dd: 1, td: 1, th: 1 };
  function safeHref(h) {
    var v = String(h || "").replace(/[\u0000-\u001F\u007F\s]+/g, "");
    if (/^[a-z][a-z0-9+.-]*:/i.test(v) && !/^(https?|mailto):/i.test(v)) return null;
    return String(h).trim();
  }
  function sanitize(node, blockTag, originalCanon) {
    var out = document.createElement("div");
    function copyAttrs(from, to, tag) {
      var c = from.getAttribute("class");
      if (c && /^[\w\- ]+$/.test(c)) to.setAttribute("class", c);
      if (tag === "a") {
        var h = safeHref(from.getAttribute("href"));
        if (h != null) to.setAttribute("href", h);
        if (from.getAttribute("target") === "_blank") { to.setAttribute("target", "_blank"); to.setAttribute("rel", "noopener"); }
      }
      if ((tag === "a" || tag === "abbr") && from.getAttribute("title")) to.setAttribute("title", from.getAttribute("title"));
    }
    function walk(src, dst) {
      Array.prototype.forEach.call(src.childNodes, function (ch) {
        if (ch.nodeType === 3) { dst.appendChild(document.createTextNode(ch.nodeValue)); return; }
        if (ch.nodeType !== 1) return; // comments etc. dropped
        var tag = ch.tagName.toLowerCase();
        if (DROP[tag]) return;
        if (tag === "br") { dst.appendChild(document.createElement("br")); return; }
        if (INLINE[tag]) { var n = document.createElement(tag); copyAttrs(ch, n, tag); walk(ch, n); dst.appendChild(n); return; }
        if ((tag === "p" || tag === "blockquote") && NESTS[blockTag]) { var b = document.createElement(tag); copyAttrs(ch, b, tag); walk(ch, b); dst.appendChild(b); return; }
        // any other block (div from Enter, p inside p, etc.): unwrap onto a new line
        if (dst.childNodes.length && /^(div|p|blockquote|li|h[1-6]|section|article|ul|ol|dl|dt|dd|figure|figcaption|pre|table|tr|td|th)$/.test(tag)) dst.appendChild(document.createElement("br"));
        walk(ch, dst);
      });
    }
    walk(node, out);
    while (out.lastChild && out.lastChild.nodeName === "BR" && !/<br>$/.test(originalCanon || "")) out.removeChild(out.lastChild);
    var html = out.innerHTML;
    if (!/&nbsp;/.test(originalCanon || "")) html = html.replace(/&nbsp;/g, " ");
    return html;
  }

  // Keep the source's own character references (e.g. &#x27; &ldquo;) in an edited block, so the
  // diff shows only what the editor actually typed.
  function preserveEntities(html, rawInner) {
    var map = {}, any = false, t = document.createElement("textarea");
    String(rawInner).replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z][a-z0-9]*);/gi, function (ent) {
      t.innerHTML = ent; var ch = t.value;
      if (ch.length === 1 || (ch.length === 2 && /[\ud800-\udbff]/.test(ch))) {
        if (!/[&<>\u00a0"]/.test(ch) && !(ch in map)) { map[ch] = ent; any = true; }
      }
      return ent;
    });
    if (!any) return html;
    return html.split(/(<[^>]*>)/).map(function (part) {
      if (part.charAt(0) === "<") return part;
      var out = "";
      for (var i = 0; i < part.length; i++) {
        var c = part.charAt(i);
        if (/[\ud800-\udbff]/.test(c) && i + 1 < part.length) { var pair = c + part.charAt(i + 1); if (map[pair]) { out += map[pair]; i++; continue; } }
        out += map[c] || c;
      }
      return out;
    }).join("");
  }

  /* ---------------- Save ---------------- */
  function conflictMsg() {
    return "Someone else changed this part of the page since you started. Nothing was saved. Copy your text, reload, and apply it again.";
  }
  function slug(s) { return String(s).toLowerCase().replace(/\.html$/, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40); }
  function stamp() { var d = new Date(); return d.toISOString().replace(/[-:T]/g, "").slice(0, 14); }

  function buildOutput(latest) {
    var changed = state.records.filter(function (r) { return r.el.innerHTML !== r.start; });
    if (!changed.length) return { none: true };
    var blocks = state.base.blocks;
    if (latest.sha !== state.base.sha) {
      var nb = M.sourceBlocks(latest.text);
      if (nb.length !== blocks.length) return { conflict: true };
      for (var i = 0; i < changed.length; i++) if (nb[changed[i].idx].inner !== changed[i].src.inner) return { conflict: true };
      blocks = nb;
    }
    var edits = changed.map(function (r) {
      var b = blocks[r.idx];
      return { start: b.start, end: b.end, html: preserveEntities(sanitize(r.el, r.src.tag, canon(r.src.inner)), b.inner), idx: r.idx };
    });
    var out = M.splice(latest.text, edits);
    // Self-check: same block structure, untouched blocks byte-identical.
    var after = M.sourceBlocks(out);
    if (after.length !== blocks.length) throw new Error("Safety check failed (the edit would change the page structure). Nothing was saved.");
    var touched = {}; edits.forEach(function (e) { touched[e.idx] = e.html; });
    for (var k = 0; k < after.length; k++) {
      if (k in touched) { if (after[k].inner !== touched[k]) throw new Error("Safety check failed. Nothing was saved."); }
      else if (after[k].inner !== blocks[k].inner) throw new Error("Safety check failed. Nothing was saved.");
    }
    return { out: out, edits: edits, changed: changed };
  }

  function save() {
    if (!state.editing || state.busy) return;
    state.busy = true;
    var pr = state.profile, mode = P.saveMode(pr);
    var msg = "Edit " + PATH + " via edit mode [edit-mode]";
    var s = E.session.get();
    editBar("Saving…", "ee-busy");
    var latestRef, branch;
    var p = mode === "direct"
      ? E.getFile(PATH, E.BRANCH)
      : E.headSha(E.BRANCH).then(function (sha) { latestRef = sha; return E.getFile(PATH, sha); });
    p.then(function (latest) {
      var r = buildOutput(latest);
      if (r.none) { editBar("No changes to save."); return null; }
      if (r.conflict) { var e = new Error(conflictMsg()); e.conflict = true; throw e; }
      if (mode === "direct") {
        return E.putFile(PATH, r.out, latest.sha, msg, E.BRANCH).then(function (res) { return { res: res, r: r }; });
      }
      branch = "edit/" + slug(s.login) + "/" + slug(PATH) + "-" + stamp();
      return E.api(E.repoPath("/git/refs"), { method: "POST", body: { ref: "refs/heads/" + branch, sha: latestRef } })
        .then(function () { return E.putFile(PATH, r.out, latest.sha, msg, branch); })
        .then(function (res) {
          return E.api(E.repoPath("/pulls"), { method: "POST", body: {
            title: "Edit " + PATH + " via edit mode",
            head: branch, base: E.BRANCH,
            body: "Proposed in edit mode by @" + s.login + ".\n\nOnly the edited text regions of `" + PATH + "` changed. The edit-guard check verifies the author is allowed to edit this path.\n\n[edit-mode]"
          } }).then(function (pull) { return { res: res, r: r, pull: pull }; }, function (err) { return { res: res, r: r, pullErr: err }; });
        });
    }).then(function (done) {
      if (!done) return;
      var commitUrl = done.res && done.res.commit && done.res.commit.html_url;
      if (mode === "direct") {
        state.base = { sha: done.res.content.sha, text: done.r.out, blocks: M.sourceBlocks(done.r.out) };
      }
      state.records.forEach(function (rec) { rec.original = rec.el.innerHTML; });
      stopEditing();
      var html;
      if (mode === "direct") {
        html = '<span class="ee-msg ee-good">Saved. Live in about 1–2 minutes while GitHub Pages rebuilds.' + (commitUrl ? ' <a href="' + esc(commitUrl) + '" target="_blank" rel="noopener">Commit</a>' : '') + '</span>';
      } else if (done.pull) {
        html = '<span class="ee-msg ee-good">Proposed as pull request #' + esc(done.pull.number) + '. Live about 1–2 minutes after it is merged. <a href="' + esc(done.pull.html_url) + '" target="_blank" rel="noopener">Open</a></span>';
      } else {
        html = '<span class="ee-msg ee-good">Saved to branch ' + esc(branch) + '. Opening the pull request failed (' + esc(done.pullErr && done.pullErr.message) + '). <a href="https://github.com/' + E.REPO + '/compare/' + E.BRANCH + '...' + encodeURIComponent(branch) + '" target="_blank" rel="noopener">Open one</a></span>';
      }
      bar(html + '<button type="button" class="ee-btn" id="ee-x">Close</button>', "ee-done");
      $("ee-x").onclick = closeBar;
    }).catch(function (err) {
      var m;
      if (err.conflict || err.status === 409 || (err.status === 422 && /sha|match/i.test(err.message))) m = conflictMsg();
      else if (err.status === 401) m = "Your token was rejected (expired?). Sign in again with #edit. Nothing was saved.";
      else if (err.status === 403 || err.status === 404) m = "GitHub refused the save (" + err.status + "): the token may lack Contents write access" + (mode === "pr" ? " or Pull requests access" : "") + ". Nothing was saved.";
      else m = err.message || "Save failed. Nothing was saved.";
      editBar(m, "ee-bad-bar");
    }).then(function () { state.busy = false; });
  }

  /* ---------------- Init ---------------- */
  function loadProfile() {
    var s = E.session.get();
    if (!s) return Promise.resolve(null);
    return E.getFile("edit/profiles.json").then(function (f) {
      state.profiles = JSON.parse(f.text);
      state.profile = P.profileFor(state.profiles, s.login);
      return state.profile;
    }).catch(function (err) {
      if (err.status === 401) { E.session.clear(); notify(); }
      return null;
    });
  }
  function onHash() { if (location.hash === "#edit") openPanel(); }
  window.addEventListener("hashchange", onHash);
  loadProfile().then(function () {
    glyph();
    onHash();
  });

  window.EloraeEditor = { sanitize: sanitize, preserveEntities: preserveEntities, state: state, startEdit: startEdit, save: save, cancel: cancelEdit, path: PATH, openPanel: openPanel };
})();
