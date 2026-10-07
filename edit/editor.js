/* Elorae edit mode: sign-in panel, EDIT glyph, in-place editing and save.
   Loaded on demand by edit/edit.js (never for anonymous visitors). */
(function () {
  "use strict";
  var E = window.EloraeEdit, P = window.EloraeEditPerms, M = window.EloraeSrcMap, Media = window.EloraeMedia,
      K = window.EloraeCrypto, V = window.EloraeVis;
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
      '<div class="ee-box" role="dialog" aria-modal="true" aria-label="Enter">' +
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
  function openPanel(msg, kind) {
    var p = panel();
    renderPanel(msg, kind);
    p.hidden = false;
    var t = $("ee-token");
    if (t) setTimeout(function () { t.focus(); }, 30);
  }
  /* Owner/reconnect: paste existing token only — no first-time "Make my token" marketing. */
  function openReconnectPanel(msg) {
    var p = panel();
    var b = $("ee-body"); if (!b) return;
    b.innerHTML =
      '<p class="ee-k">Edit</p>' +
      '<p class="ee-note ee-info" id="ee-lead">' + esc(msg || "Your GitHub link is on this account, but this browser needs the token again to edit.") + '</p>' +
      '<form id="ee-form" autocomplete="off">' +
      '<label class="ee-note" for="ee-token">Paste your existing GitHub token</label>' +
      '<input id="ee-token" type="password" placeholder="ghp_…" spellcheck="false" autocomplete="off" aria-label="GitHub token">' +
      '<div class="ee-row"><button type="submit" class="ee-btn ee-primary">Enter</button></div>' +
      '<p class="ee-err" id="ee-err" hidden></p></form>' +
      '<p class="ee-note">Same token you used when you connected. No new token needed unless GitHub revoked it. <a href="' + esc(E.TOKEN_LINKS.tokens) + '" target="_blank" rel="noopener">Your tokens</a></p>';
    $("ee-form").onsubmit = function (e) {
      e.preventDefault();
      signIn($("ee-token").value.trim(), true);
    };
    p.hidden = false;
    var t = $("ee-token");
    if (t) setTimeout(function () { t.focus(); }, 30);
  }
  function permSummary(pr) {
    if (!pr) return "";
    if (P.isAdmin(pr)) return (pr.title || "Admin") + " · whole site";
    var l = P.permList(pr), bad = P.rejectedRules ? P.rejectedRules(pr) : [];
    return (l.length ? "Can edit: " + l.join(", ") : "View only") + (bad.length ? " (ignored, players can only edit articles: " + bad.join(", ") + ")" : "");
  }
  // Exact article paths this person can edit (globs like articles/*.html are summarised).
  function myPages(pr) {
    if (!pr || P.isAdmin(pr)) return [];
    return P.permList(pr).filter(function (g) { return !/[*?]/.test(g); });
  }
  var titleCache = {};
  function pageTitle(path) {
    if (titleCache[path]) return Promise.resolve(titleCache[path]);
    return fetch(E.ROOT + path, { cache: "force-cache" }).then(function (r) { return r.ok ? r.text() : ""; }).then(function (t) {
      var m = /<title>([^<]*)<\/title>/i.exec(t || "");
      var name = m ? m[1].replace(/\s+-\s+Elorae\s*$/, "").trim() : "";
      titleCache[path] = name || path;
      return titleCache[path];
    }).catch(function () { return path; });
  }
  function fillTitles() {
    Array.prototype.forEach.call(document.querySelectorAll("#ee-body [data-ee-title]"), function (a) {
      pageTitle(a.getAttribute("data-ee-title")).then(function (t) { a.textContent = t; });
    });
  }
  function canEditSummary(pr) {
    if (!pr) return "";
    if (P.isAdmin(pr)) return '<p class="ee-note">' + esc(pr.title || "Admin") + ' · you can edit the whole site.</p>';
    var pages = myPages(pr), globs = P.permList(pr).filter(function (g) { return /[*?]/.test(g); });
    if (!pages.length && !globs.length) return '<p class="ee-note">View only. You can\'t edit pages yet.</p>';
    var list = pages.map(function (pth) {
      var here = pth === PATH;
      return '<li><a href="' + esc(E.ROOT + pth) + '" data-ee-title="' + esc(pth) + '">' + esc(pth) + '</a>' + (here ? ' <span class="ee-here">this page</span>' : '') + '</li>';
    }).join("") + globs.map(function (g) { return '<li>' + esc(g === "articles/*.html" ? "Every article" : g) + '</li>'; }).join("");
    var bad = P.rejectedRules ? P.rejectedRules(pr) : [];
    return '<p class="ee-note ee-cap">You can edit</p><ul class="ee-pages" id="ee-pages">' + list + '</ul>' +
      (bad.length ? '<p class="ee-note">Ignored, because players can only edit articles: ' + esc(bad.join(", ")) + '</p>' : '');
  }
  function onDashboardPage() {
    return /(?:^|\/)edit\/dashboard(\.html)?\/?$/.test(location.pathname);
  }
  function renderPanel(msg, kind) {
    var b = $("ee-body"); if (!b) return;
    var s = E.session.get();
    if (s) {
      var pr = state.profile;
      var canHere = pr && P.canEdit(pr, PATH);
      var onDash = onDashboardPage();
      var how = pr ? (onDash
        ? (P.isAdmin(pr) ? "Your dashboard is ready on this page." : "The dashboard is only for admins.")
        : ((canHere ? "Use the EDIT button on this page. " : "") + (P.saveMode(pr) === "direct" ? "Saves go straight to the site." : "Saves become a pull request that Devin approves before it goes live."))) : "";
      // Dashboard control is always offered to Devin on the login-success view, on every page
      // (including this dashboard page itself — then it just closes the panel).
      var dashCtl = (pr && P.isAdmin(pr))
        ? (onDash
          ? '<button type="button" class="ee-btn" id="ee-goto-dash">Dashboard</button>'
          : '<a class="ee-btn" id="ee-goto-dash" href="' + esc(E.ROOT + "edit/dashboard/") + '">Dashboard</a>')
        : '';
      b.innerHTML =
        '<p class="ee-k">Edit</p>' +
        '<p class="ee-who" id="ee-who">Signed in as ' + esc((pr && pr.name) || s.login) + ' <span>@' + esc(s.login) + '</span></p>' +
        canEditSummary(pr) +
        (how ? '<p class="ee-note">' + how + '</p>' : '') +
        (s.warn ? '<p class="ee-note ee-warn">' + esc(s.warn) + '</p>' : '') +
        (msg ? '<p class="ee-err">' + esc(msg) + '</p>' : '') +
        '<div class="ee-row">' + dashCtl +
        '<button type="button" class="ee-btn" id="ee-signout">Sign out on this device</button></div>' +
        '<p class="ee-note">' + (s.remember ? "Remembered on this device. The EDIT button appears on your pages without #edit." : "Only for this tab. You'll need to enter again after closing it.") + '</p>';
      if ($("ee-goto-dash") && onDash) $("ee-goto-dash").onclick = function () { closePanel(); };
      $("ee-signout").onclick = function () { E.session.clear(); state.profile = null; cancelEdit(); glyph(); renderPanel("Signed out. Your token is removed from this browser.", "info"); notify(); };
      fillTitles();
      return;
    }
    var L = E.TOKEN_LINKS;
    b.innerHTML =
      '<p class="ee-k">Edit</p>' +
      (msg ? '<p class="' + (kind === "info" ? "ee-note ee-info" : "ee-err") + '" id="ee-lead">' + esc(msg) + '</p>' : '') +
      '<ol class="ee-steps">' +
      '<li><a class="ee-btn ee-primary" id="ee-mint" href="' + esc(L.classic) + '" target="_blank" rel="noopener">Make my token</a><span>Opens GitHub with everything filled in. Pick an expiry (90 days is fine), leave only <b>public_repo</b> ticked, then <b>Generate token</b> and copy it.</span></li>' +
      '<li><span>Paste it here</span>' +
      '<form id="ee-form" autocomplete="off">' +
      '<input id="ee-token" type="password" placeholder="ghp_…" spellcheck="false" autocomplete="off" aria-label="GitHub token">' +
      '<label class="ee-check"><input type="checkbox" id="ee-remember" checked> Remember on this device</label>' +
      '<div class="ee-row"><button type="submit" class="ee-btn ee-primary">Enter</button></div>' +
      '<p class="ee-err" id="ee-err" hidden></p></form></li>' +
      '</ol>' +
      '<p class="ee-note">Your token stays in this browser and is only sent to GitHub. First time? Accept the collaborator invite first: <a href="' + esc(L.invitations) + '" target="_blank" rel="noopener">invitations</a>. Site owner: a <a href="' + esc(L.fineGrained) + '" target="_blank" rel="noopener">fine-grained token</a> works too. <a href="https://github.com/' + E.REPO + '/blob/main/edit/README.md" target="_blank" rel="noopener">Help</a></p>';
    $("ee-form").onsubmit = function (e) {
      e.preventDefault();
      signIn($("ee-token").value.trim(), $("ee-remember").checked);
    };
  }
  function showErr(m) { var x = $("ee-err"); if (x) { x.textContent = m; x.hidden = false; } else renderPanel(m); }

  function signIn(token, remember) {
    token = String(token || "").replace(/\s+/g, "");
    if (!token) return showErr("Paste your token.");
    var kind = E.tokenKind(token);
    if (kind === "unknown") return showErr("That doesn't look like a GitHub token. It should start with ghp_ or github_pat_.");
    var login, warn = "";
    showErr("Checking…");
    E.api("/user", { token: token, withHeaders: true }).then(function (r) {
      login = r.data.login;
      var scopes = (r.scopes || "").split(/\s*,\s*/).filter(Boolean);
      if (kind === "classic" && scopes.indexOf("repo") >= 0) warn = "This token can write to all your repositories. A token with only public_repo is enough. You can make a narrower one any time.";
      if (kind === "classic" && scopes.indexOf("repo") < 0 && scopes.indexOf("public_repo") < 0) {
        var e0 = new Error("This token is missing the public_repo permission. Make a new one with the button above."); throw e0;
      }
      return E.api(E.repoPath(""), { token: token }).catch(function (err) {
        if (err.status === 404 || err.status === 403) {
          throw new Error(kind === "fine-grained"
            ? "GitHub doesn't let fine-grained tokens edit a repository owned by another person. Use “Make my token” above (a classic token with public_repo)."
            : "This token can't reach " + E.REPO + ".");
        }
        throw err;
      });
    }).then(function (repo) {
      if (!repo.permissions || !repo.permissions.push) {
        throw new Error(kind === "fine-grained"
          ? "This fine-grained token can't write here. Players need a classic token from “Make my token”."
          : "@" + login + " isn't a collaborator on the site yet. Accept the invitation (link below) or ask Devin to send one, then enter again.");
      }
      return E.getFileWith(token, "edit/profiles.json");
    }).then(function (f) {
      var doc = JSON.parse(f.text);
      var pr = P.profileFor(doc, login);
      if (!pr) throw new Error("Signed in to GitHub as @" + login + ", but there's no edit profile for you yet. Ask Devin to add @" + login + ".");
      state.profiles = doc; state.profile = pr;
      E.session.set({ token: token, login: login, remember: !!remember, person: pr.person || "", role: pr.role || "", kind: kind, warn: warn, since: new Date().toISOString() });
      notify();
      glyph();
      if (location.hash === "#edit" && tryEnterEdit()) return;
      renderPanel();
    }).catch(function (err) {
      showErr(err.status === 401 ? "GitHub didn't accept that token. It may be mistyped, expired or deleted. Make a new one with the button above." : (err.message || "Enter failed."));
    });
  }

  // A remembered token stopped working (expired or revoked): forget it and offer a friendly re-sign-in.
  function expired() {
    var prev = E.session.get();
    if (prev && E.session.markLinked) E.session.markLinked(prev.person, prev.login);
    if (prev && prev.login && E.session.markLinked) {
      E.session.markLinked("devin", prev.login);
      E.session.markLinked("195142095142091920", prev.login);
    }
    E.session.clear(); state.profile = null; notify(); glyph();
    var b = bar('<span class="ee-msg">Edit needs your GitHub token in this browser again.</span>' +
      '<button type="button" class="ee-btn" id="ee-x">Not now</button><button type="button" class="ee-btn ee-primary" id="ee-resign">Enter again</button>', "ee-expired");
    $("ee-x").onclick = closeBar;
    $("ee-resign").onclick = function () {
      closeBar();
      openReconnectPanel("Paste the GitHub token you already made for Elorae — not a new first-time setup.");
    };
  }
  function notify() { try { window.dispatchEvent(new Event("elorae-edit-session")); } catch (e) {} }

  E.getFileWith = function (token, path) {
    // Uses the candidate token for this one call without persisting it.
    return E.api(E.repoPath("/contents/" + path + "?ref=" + E.BRANCH), { token: token }).then(function (d) {
      return { sha: d.sha, text: E.b64DecodeUtf8(d.content) };
    });
  };

  /* ---------------- EDIT glyph ---------------- */
  // Article hero name (h1) + epithet: admin-only. Players keep body-only editing.
  function titleOpts() { return { includeTitles: !!(state.profile && P.isAdmin(state.profile)) }; }
  function liveBlocks() {
    return M.collectBlocks(document.body, M.DOM, titleOpts()).filter(function (n) {
      return !n.closest("#ee-panel,#ee-bar");
    });
  }
  // Legend Keeper-style page surface: one continuous contenteditable main.
  function findLiveMain() {
    var mains = document.querySelectorAll("main.art-body, main.read");
    for (var i = 0; i < mains.length; i++) {
      if (!mains[i].closest("#ee-panel,#ee-bar")) return mains[i];
    }
    return null;
  }
  function sourceMainRange(src) {
    var root = M.parse(src);
    function walk(n) {
      var kids = n.children || [];
      for (var i = 0; i < kids.length; i++) {
        var c = kids[i];
        var cls = c.classes || [];
        if (c.tag === "main" && (cls.indexOf("art-body") >= 0 || cls.indexOf("read") >= 0)) {
          return { start: c.openEnd, end: c.closeStart, tagStart: c.start, tagEnd: c.end, classes: cls.slice(), attrs: c.attrs || {} };
        }
        var d = walk(c);
        if (d) return d;
      }
      return null;
    }
    return walk(root);
  }
  var PAGE_LOCK_SEL = ".art-hero, #related, .art-swap, script, style, nav, aside, .toc, #section-bar, canvas, iframe, form, button";
  function isIndexOrganizePage() {
    var Org = window.EloraeIndexOrg;
    return !!(Org && Org.isIndexPage && Org.isIndexPage() && state.profile && P.isAdmin(state.profile) && P.canEdit(state.profile, PATH));
  }
  function glyph() {
    var g = $("ee-glyph");
    var Org = window.EloraeIndexOrg;
    if (Org && state.profile) Org.setProfile(state.profile);
    var textOk = !!(E.session.get() && state.profile && P.canEdit(state.profile, PATH) && (findLiveMain() || liveBlocks().length));
    var indexOk = !!(E.session.get() && isIndexOrganizePage());
    var ok = textOk || indexOk;
    if (!ok) { if (g) g.remove(); return; }
    if (g) return;
    g = el("button", { id: "ee-glyph", type: "button", "aria-label": "Edit this page" }, "Edit");
    g.onclick = function () {
      if (state.editing) return;
      var O = window.EloraeIndexOrg;
      if (O && O.active && O.active()) return;
      if (isIndexOrganizePage() && O && O.start) { O.start(); return; }
      startEdit();
    };
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
      var mainEl = findLiveMain();
      if (mainEl) {
        var range = sourceMainRange(f.text);
        if (!range) throw new Error("Could not find the page body in the source.");
        state.base = { sha: f.sha, text: f.text, blocks: null };
        state.records = [];
        state.page = {
          el: mainEl,
          original: mainEl.innerHTML,
          range: range,
          locks: []
        };
        mainEl.setAttribute("contenteditable", "true");
        mainEl.setAttribute("spellcheck", "true");
        mainEl.classList.add("ee-editable", "ee-page");
        Array.prototype.forEach.call(mainEl.querySelectorAll(PAGE_LOCK_SEL), function (n, i) {
          n.setAttribute("contenteditable", "false");
          n.classList.add("ee-locked");
          n.setAttribute("data-ee-lock", String(i));
          state.page.locks[i] = n.outerHTML;
        });
        document.documentElement.classList.add("ee-editing", "ee-page-editing");
        document.addEventListener("keydown", onKey, true);
        document.addEventListener("paste", onPaste, true);
        document.addEventListener("click", onClick, true);
        document.addEventListener("selectionchange", onSelChange);
        window.addEventListener("resize", positionStyleBar);
        state.editing = true;
        editBar();
        ensureStyleBar();
        return;
      }
      // Fallback: older per-block edit for pages without a main body.
      var src = M.sourceBlocks(f.text, titleOpts()), live = liveBlocks();
      var recs = [];
      for (var i = 0; i < src.length && i < live.length; i++) {
        var n = live[i], s = src[i];
        if (n.tagName.toLowerCase() !== s.tag) continue;
        if (textOf(s.inner) !== norm(n.textContent)) continue;
        var orig = n.innerHTML, c = canon(s.inner);
        if (orig !== c) n.innerHTML = c;
        recs.push({ el: n, idx: i, src: s, original: orig, start: n.innerHTML });
      }
      if (!recs.length) throw new Error("Nothing on this page could be matched to its source safely.");
      state.base = { sha: f.sha, text: f.text, blocks: src };
      state.records = recs;
      state.page = null;
      recs.forEach(function (r) {
        r.el.setAttribute("contenteditable", "true");
        r.el.setAttribute("spellcheck", "true");
        r.el.classList.add("ee-editable");
      });
      document.documentElement.classList.add("ee-editing");
      document.addEventListener("keydown", onKey, true);
      document.addEventListener("paste", onPaste, true);
      document.addEventListener("click", onClick, true);
      document.addEventListener("selectionchange", onSelChange);
      window.addEventListener("resize", positionStyleBar);
      state.editing = true;
      editBar();
      ensureStyleBar();
    }).catch(function (err) {
      bar('<span class="ee-msg ee-bad">' + esc(err.message || "Could not start editing.") + '</span><button type="button" class="ee-btn" id="ee-x">Close</button>');
      $("ee-x").onclick = closeBar;
    }).then(function () { state.busy = false; });
  }
  function editBar(msg, cls) {
    var mode = P.saveMode(state.profile) === "direct" ? "Saves to the live site" : "Saves as a pull request";
    var admin = P.isAdmin(state.profile);
    var artBtn = (admin && Media)
      ? '<button type="button" class="ee-btn" id="ee-art">Art</button>' : '';
    var shareBtn = (admin && V) ? '<button type="button" class="ee-btn" id="ee-share">Share</button>' : '';
    var ownerBtn = admin ? '<button type="button" class="ee-btn" id="ee-owner">Owner</button>' : '';
    var newBtn = admin ? '<button type="button" class="ee-btn" id="ee-newart">New article</button>' : '';
    bar('<span class="ee-msg">' + esc(msg || ("Editing · " + mode)) + '</span>' +
      artBtn + shareBtn + ownerBtn + newBtn +
      '<button type="button" class="ee-btn" id="ee-cancel">Cancel</button>' +
      '<button type="button" class="ee-btn ee-primary" id="ee-save">Save</button>', cls);
    $("ee-save").onclick = save;
    $("ee-cancel").onclick = function () { cancelEdit(); closeBar(); };
    if ($("ee-art")) $("ee-art").onclick = openArtPanel;
    if ($("ee-share")) $("ee-share").onclick = openSharePanel;
    if ($("ee-owner")) $("ee-owner").onclick = openOwnerPanel;
    if ($("ee-newart")) $("ee-newart").onclick = openNewArticle;
    ensureStyleBar();
  }

  /* ---------------- Styling toolbar (caret block) ---------------- */
  var STYLE_FONTS = [
    { id: "serif", label: "Serif", cls: "ee-serif" },
    { id: "sans", label: "Sans", cls: "ee-sans" }
  ];
  var STYLE_SIZES = [
    { id: "sm", label: "S", cls: "ee-size-sm" },
    { id: "md", label: "M", cls: "" },
    { id: "lg", label: "L", cls: "ee-size-lg" }
  ];
  var STYLE_BLOCKS = [
    { id: "p", label: "P", cls: "" },
    { id: "h2", label: "H2", cls: "ee-h2" },
    { id: "h3", label: "H3", cls: "ee-h3" },
    { id: "cap", label: "Cap", cls: "ee-caption" }
  ];
  function ensureStyleBar() {
    if (!state.editing) { removeStyleBar(); return; }
    var b = $("ee-stylebar");
    if (!b) {
      b = el("div", { id: "ee-stylebar", role: "toolbar", "aria-label": "Text style" });
      document.body.appendChild(b);
      b.addEventListener("mousedown", function (e) {
        // Keep selection in the editable when clicking toolbar.
        if (e.target.closest && e.target.closest("button,select")) e.preventDefault();
      });
    }
    b.innerHTML =
      '<select id="ee-font" aria-label="Font" title="Font">' +
        '<option value="">Font</option>' +
        '<option value="serif">Serif</option>' +
        '<option value="sans">Sans</option>' +
      '</select>' +
      '<select id="ee-size" aria-label="Size" title="Size">' +
        '<option value="">Size</option>' +
        '<option value="sm">S</option>' +
        '<option value="md">M</option>' +
        '<option value="lg">L</option>' +
      '</select>' +
      '<select id="ee-block" aria-label="Block style" title="Block">' +
        '<option value="">Block</option>' +
        '<option value="p">P</option>' +
        '<option value="h2">H2</option>' +
        '<option value="h3">H3</option>' +
        '<option value="cap">Cap</option>' +
      '</select>' +
      '<button type="button" class="ee-glyph-btn" id="ee-bold" title="Bold" aria-label="Bold"><b>B</b></button>' +
      '<button type="button" class="ee-glyph-btn" id="ee-italic" title="Italic" aria-label="Italic"><i>I</i></button>' +
      '<button type="button" class="ee-glyph-btn" id="ee-link" title="Link" aria-label="Link">↗</button>';
    $("ee-font").onchange = function () { applyFont(this.value); this.selectedIndex = 0; };
    $("ee-size").onchange = function () { applySize(this.value); this.selectedIndex = 0; };
    $("ee-block").onchange = function () { applyBlockStyle(this.value); this.selectedIndex = 0; };
    $("ee-bold").onclick = function () { document.execCommand("bold", false, null); };
    $("ee-italic").onclick = function () { document.execCommand("italic", false, null); };
    $("ee-link").onclick = function () {
      var cur = "";
      try {
        var n = window.getSelection() && window.getSelection().anchorNode;
        var a = n && (n.nodeType === 1 ? n : n.parentElement);
        a = a && a.closest && a.closest("a");
        if (a) cur = a.getAttribute("href") || "";
      } catch (e) {}
      var url = window.prompt("Link URL", cur || "https://");
      if (url == null) return;
      url = String(url).trim();
      if (!url) { document.execCommand("unlink", false, null); return; }
      var safe = safeHref(url);
      if (safe == null) { editBar("That link is not allowed.", "ee-bad-bar"); return; }
      document.execCommand("createLink", false, safe);
    };
    positionStyleBar();
  }
  function removeStyleBar() {
    var b = $("ee-stylebar");
    if (b) b.remove();
  }
  function positionStyleBar() {
    var b = $("ee-stylebar"), barEl = $("ee-bar");
    if (!b) return;
    // Sit just above the edit bar (desktop centered; phone full-width strip).
    if (barEl) {
      var r = barEl.getBoundingClientRect();
      b.style.bottom = (window.innerHeight - r.top + 8) + "px";
    } else {
      b.style.bottom = "72px";
    }
  }
  function selectionEditable() {
    var sel = window.getSelection && window.getSelection();
    if (!sel || !sel.rangeCount) return null;
    var n = sel.anchorNode;
    var el = n && (n.nodeType === 1 ? n : n.parentElement);
    if (!el || !el.closest) return null;
    var ed = el.closest(".ee-editable");
    if (!ed || isTitleField(ed)) return null;
    return ed;
  }
  function wrapSelection(className) {
    if (!selectionEditable()) return;
    var sel = window.getSelection();
    if (!sel.rangeCount) return;
    var range = sel.getRangeAt(0);
    if (range.collapsed) {
      // Apply to whole editable when nothing selected: wrap contents.
      var ed = selectionEditable();
      if (!ed) return;
      if (!className) {
        // Strip known style classes from descendants' wrappers where possible.
        Array.prototype.slice.call(ed.querySelectorAll("span.ee-serif,span.ee-sans,span.ee-size-sm,span.ee-size-md,span.ee-size-lg,span.ee-h2,span.ee-h3,span.ee-caption")).forEach(function (sp) {
          while (sp.firstChild) sp.parentNode.insertBefore(sp.firstChild, sp);
          sp.remove();
        });
        return;
      }
      document.execCommand("insertHTML", false, '<span class="' + className + '">' + ed.innerHTML + "</span>");
      return;
    }
    var frag = range.extractContents();
    var span = document.createElement("span");
    if (className) span.className = className;
    span.appendChild(frag);
    // Unwrap nested same-family spans to avoid deep stacks.
    Array.prototype.slice.call(span.querySelectorAll("span")).forEach(function (inner) {
      if (!inner.className || !/^ee-(serif|sans|size-sm|size-md|size-lg|h2|h3|caption)$/.test(inner.className)) return;
      if (className && inner.className.split(/\s+/).indexOf(className) >= 0 || true) {
        /* leave content; outer carries the new class */
      }
    });
    range.insertNode(span);
    sel.removeAllRanges();
    var next = document.createRange();
    next.selectNodeContents(span);
    sel.addRange(next);
  }
  function applyFont(id) {
    if (!id) return;
    var map = { serif: "ee-serif", sans: "ee-sans" };
    wrapSelection(map[id] || "");
  }
  function applySize(id) {
    if (!id) return;
    if (id === "md") { wrapSelection(""); return; }
    var map = { sm: "ee-size-sm", lg: "ee-size-lg" };
    wrapSelection(map[id] || "");
  }
  function applyBlockStyle(id) {
    if (!id) return;
    if (state.page) {
      if (id === "p") { document.execCommand("formatBlock", false, "p"); return; }
      if (id === "h2") { document.execCommand("formatBlock", false, "h2"); return; }
      if (id === "h3") { document.execCommand("formatBlock", false, "h3"); return; }
      if (id === "cap") { wrapSelection("ee-caption"); return; }
      return;
    }
    if (id === "p") { wrapSelection(""); return; }
    var map = { h2: "ee-h2", h3: "ee-h3", cap: "ee-caption" };
    wrapSelection(map[id] || "");
  }
  function onSelChange() {
    if (!state.editing) return;
    var b = $("ee-stylebar");
    if (!b) return;
    b.hidden = !selectionEditable();
    positionStyleBar();
  }

  function jsonDoc(o) { var c = JSON.parse(JSON.stringify(o)); delete c.__sha; return JSON.stringify(c, null, 2) + "\n"; }
  function commitMsg(files, message) {
    return E.commitFiles(files, message + " [edit-mode]", E.BRANCH);
  }
  function nameOfPerson(man, p) { return (man.people[p] && man.people[p].name) || p; }

  /* ---- Share (secret visibility) on private/secret articles ---- */
  function secretIdForPath(man, path) {
    var secrets = (man && man.secrets) || {}, id;
    for (id in secrets) if (secrets[id] && secrets[id].path === path) return id;
    return null;
  }
  function openSharePanel() {
    if (!P.isAdmin(state.profile) || !V || !K) return;
    openPanel();
    var b = $("ee-body");
    b.innerHTML = '<p class="ee-k">Share</p><p class="ee-note">Loading…</p>';
    V.manifest(true).then(function (man) {
      var id = secretIdForPath(man, PATH);
      if (!id) {
        b.innerHTML = '<p class="ee-k">Share</p><p class="ee-note">This page is not a secret in <code>visibility.json</code>. Private articles that are registered there get Everyone / per-player toggles here.</p>' +
          '<div class="ee-row"><button type="button" class="ee-btn" id="ee-share-back">Back</button></div>';
        $("ee-share-back").onclick = closePanel;
        return;
      }
      renderSharePanel(man, id);
    }).catch(function (e) {
      b.innerHTML = '<p class="ee-k">Share</p><p class="ee-err">' + esc(e.message || "Could not load visibility.") + '</p>' +
        '<div class="ee-row"><button type="button" class="ee-btn" id="ee-share-back">Back</button></div>';
      $("ee-share-back").onclick = closePanel;
    });
  }
  function renderSharePanel(man, id) {
    var sec = man.secrets[id], enc = sec.status === "encrypted";
    var unlocked = !!(V.myKey.get() && V.myKey.get().person === "devin");
    var b = $("ee-body");
    var people = Object.keys(man.people || {}).filter(function (p) { return p !== "devin"; });
    var body;
    if (!enc) {
      body = '<p class="ee-note"><b>' + esc(sec.title) + '</b> is still plaintext (hidden only by CSS). Encrypt it to use real sharing toggles.</p>' +
        (unlocked
          ? '<div class="ee-row"><button type="button" class="ee-btn ee-primary" id="ee-share-encrypt">Encrypt</button></div>'
          : '<p class="ee-note">Unlock your secrets key first (passphrase below), then Encrypt.</p>');
    } else {
      var allowed = V.allowedList(sec);
      var boxes = '<label class="ee-tog"><input type="checkbox" id="ee-vis-everyone"' + (sec.everyone ? " checked" : "") + (!unlocked ? " disabled" : "") + '> Everyone</label>' +
        people.map(function (p) {
          var noKey = !(man.people[p] && man.people[p].key);
          var on = allowed.indexOf(p) >= 0;
          return '<label class="ee-tog' + (noKey ? " ee-nokey" : "") + '"><input type="checkbox" data-vis-who="' + esc(p) + '"' +
            (on ? " checked" : "") + ((!unlocked || noKey || sec.everyone) ? " disabled" : "") + '> ' + esc(nameOfPerson(man, p)) +
            (noKey ? ' <span class="ee-sub">no key</span>' : "") + '</label>';
        }).join("");
      body = '<p class="ee-note"><b>' + esc(sec.title) + '</b> · encrypted' + (unlocked ? "" : " · unlock your key to change sharing") + '</p>' +
        '<div class="ee-togs ee-share-togs">' + boxes + '</div>';
    }
    var unlock = unlocked ? '' :
      '<form id="ee-share-unlock" autocomplete="off" style="margin-top:14px">' +
      '<input type="password" id="ee-share-pass" placeholder="Secrets passphrase" autocomplete="current-password">' +
      '<div class="ee-row"><button type="submit" class="ee-btn ee-primary">Unlock</button></div></form>';
    b.innerHTML = '<p class="ee-k">Share</p>' + body + unlock +
      '<p class="ee-err" id="ee-share-err" hidden></p>' +
      '<div class="ee-row"><button type="button" class="ee-btn" id="ee-share-back">Back</button></div>';
    $("ee-share-back").onclick = closePanel;
    if ($("ee-share-unlock")) {
      $("ee-share-unlock").onsubmit = function (e) {
        e.preventDefault();
        var pass = $("ee-share-pass").value;
        V.unlockAs(man, "devin", pass).then(function () {
          renderSharePanel(man, id);
        }).catch(function (err) {
          var x = $("ee-share-err"); x.textContent = err.message || "Unlock failed."; x.hidden = false;
        });
      };
    }
    if ($("ee-share-encrypt")) $("ee-share-encrypt").onclick = function () { encryptSecretFromEditor(man, id); };
    var ev = $("ee-vis-everyone");
    if (ev) ev.onchange = function () { toggleSecretFromEditor(man, id, "everyone", ev.checked); };
    Array.prototype.forEach.call(b.querySelectorAll("[data-vis-who]"), function (inp) {
      inp.onchange = function () { toggleSecretFromEditor(man, id, inp.getAttribute("data-vis-who"), inp.checked); };
    });
  }
  function shareBusy(msg) {
    var x = $("ee-share-err"); if (x) { x.textContent = msg || ""; x.hidden = !msg; }
  }
  function ensureEditorUnlocked() {
    var s = V.myKey.get();
    if (!s || s.person !== "devin") throw new Error("Unlock your secrets key first.");
    return V.myKey.privateKey().then(function (priv) {
      if (!priv) throw new Error("Unlock your secrets key first.");
      return priv;
    });
  }
  function inlineImagesForEncrypt(html, path) {
    var base = E.ROOT + path;
    var re = /(<img\b[^>]*?\s(?:src|data-src)=")([^"]+)(")|(\sdata-src=")([^"]+\.(?:png|jpe?g|gif|webp|avif))(")/gi;
    var urls = {};
    html.replace(re, function (m, a, u1, c, d, u2) { var u = u1 || u2; if (!/^data:/.test(u)) urls[u] = 1; return m; });
    return Promise.all(Object.keys(urls).map(function (u) {
      return fetch(new URL(u.replace(/&amp;/g, "&"), base).href).then(function (r) {
        if (!r.ok) throw new Error("Image missing: " + u);
        return r.blob();
      }).then(function (blob) {
        return new Promise(function (res) { var fr = new FileReader(); fr.onload = function () { res(fr.result); }; fr.readAsDataURL(blob); });
      }).then(function (d) { urls[u] = d; });
    })).then(function () {
      return html.replace(re, function (m, a, u1, c, d, u2, f) {
        if (u1) return a + (urls[u1] || u1) + c;
        return d + (urls[u2] || u2) + f;
      });
    });
  }
  function wrapAllKeys(man, sec, raw) {
    var keys = {};
    var list = V.allowedList(sec).filter(function (p) { return man.people[p] && man.people[p].key; });
    return Promise.all(list.map(function (p) {
      return K.wrapFor(man.people[p].key, raw).then(function (w) { keys[p] = w; });
    })).then(function () { return keys; });
  }
  function rotateSecret(man, id, sec, payload) {
    var raw = K.newContentKey();
    sec.epoch = (sec.epoch || 0) + 1;
    return K.encryptSecret(id, sec.epoch, raw, payload).then(function (file) {
      return wrapAllKeys(man, sec, raw).then(function (keys) {
        sec.keys = keys;
        sec.openKey = sec.everyone ? K.b64(raw) : null;
        return file;
      });
    });
  }
  function currentSecretPayload(man, id, sec) {
    return ensureEditorUnlocked().then(function (priv) {
      return V.contentKey(man, id, "devin", priv);
    }).then(function (raw) {
      if (!raw) throw new Error("Your key can't open " + sec.title + ".");
      return V.secretFile(id, true).then(function (f) {
        return K.decryptSecret(f, raw).then(function (p) { return { raw: raw, payload: p }; });
      });
    });
  }
  function toggleSecretFromEditor(man, id, who, on) {
    shareBusy((on ? "Sharing…" : "Hiding…"));
    var next = JSON.parse(JSON.stringify(man)), sec = next.secrets[id];
    currentSecretPayload(man, id, sec).then(function (cur) {
      // operate on next's sec but need content from current
      sec = next.secrets[id];
      var files = [];
      if (who === "everyone") {
        sec.everyone = on;
        if (on) { sec.openKey = K.b64(cur.raw); return files; }
        return rotateSecret(next, id, sec, cur.payload).then(function (f) {
          files.push({ path: "edit/secrets/" + id + ".json", text: JSON.stringify(f) + "\n" }); return files;
        });
      }
      var a = V.allowedList(sec);
      if (on) {
        if (a.indexOf(who) < 0) a.push(who);
        sec.allowed = a;
        if (!next.people[who] || !next.people[who].key) throw new Error(nameOfPerson(next, who) + " has no key yet.");
        return K.wrapFor(next.people[who].key, cur.raw).then(function (w) { sec.keys[who] = w; return files; });
      }
      sec.allowed = a.filter(function (p) { return p !== who || p === "devin"; });
      return rotateSecret(next, id, sec, cur.payload).then(function (f) {
        files.push({ path: "edit/secrets/" + id + ".json", text: JSON.stringify(f) + "\n" }); return files;
      });
    }).then(function (files) {
      files.unshift({ path: "edit/visibility.json", text: jsonDoc(next) });
      return commitMsg(files, "Visibility: " + (on ? "show " : "hide ") + id + (who === "everyone" ? " for everyone" : " for " + who) + " via edit mode");
    }).then(function () {
      shareBusy("");
      return V.manifest(true).then(function (m) { renderSharePanel(m, id); });
    }).catch(function (e) {
      shareBusy(e.message || "Failed.");
      V.manifest(true).then(function (m) { renderSharePanel(m, id); }).catch(function () {});
    });
  }
  function encryptSecretFromEditor(man, id) {
    shareBusy("Encrypting…");
    var next = JSON.parse(JSON.stringify(man)), sec = next.secrets[id];
    ensureEditorUnlocked().then(function () {
      return E.getFile(sec.path).then(function (f) { return inlineImagesForEncrypt(f.text, sec.path); });
    }).then(function (html) {
      sec.status = "encrypted"; sec.epoch = 0; sec.everyone = false;
      return rotateSecret(next, id, sec, { v: 1, path: sec.path, title: sec.title, html: html }).then(function (file) {
        return commitMsg([
          { path: "edit/visibility.json", text: jsonDoc(next) },
          { path: "edit/secrets/" + id + ".json", text: JSON.stringify(file) + "\n" }
        ], "Visibility: encrypt " + id + " via edit mode");
      });
    }).then(function () {
      shareBusy("");
      return V.manifest(true).then(function (m) { renderSharePanel(m, id); });
    }).catch(function (e) { shareBusy(e.message || "Encrypt failed."); });
  }

  /* ---- Owner (profiles.json permissions for this article) ---- */
  function openOwnerPanel() {
    if (!P.isAdmin(state.profile)) return;
    openPanel();
    var b = $("ee-body");
    b.innerHTML = '<p class="ee-k">Owner</p><p class="ee-note">Loading…</p>';
    E.getFile("edit/profiles.json").then(function (f) {
      var doc = JSON.parse(f.text);
      doc.__sha = f.sha;
      renderOwnerPanel(doc);
    }).catch(function (e) {
      b.innerHTML = '<p class="ee-k">Owner</p><p class="ee-err">' + esc(e.message || "Could not load profiles.") + '</p>' +
        '<div class="ee-row"><button type="button" class="ee-btn" id="ee-owner-back">Back</button></div>';
      $("ee-owner-back").onclick = closePanel;
    });
  }
  function playerEntries(doc) {
    var out = [], profiles = doc.profiles || {};
    Object.keys(profiles).forEach(function (login) {
      if (login.charAt(0) === "_" || login.indexOf("//") === 0) return;
      var pr = profiles[login];
      if (!pr || pr.role === "admin") return;
      out.push({ login: login, person: pr.person || "", name: pr.name || login, permissions: P.rawPermList ? P.rawPermList(pr) : [].concat(pr.permissions || []) });
    });
    return out;
  }
  function renderOwnerPanel(doc) {
    var b = $("ee-body");
    var players = playerEntries(doc);
    var current = players.filter(function (p) {
      return (p.permissions || []).indexOf(PATH) >= 0;
    }).map(function (p) { return p.person || p.login; });
    var opts = '<option value="">— none —</option>' + players.map(function (p) {
      var label = (p.name || p.person) + (String(p.login).indexOf("<") === 0 ? " (login placeholder)" : " @" + p.login);
      var sel = (p.permissions || []).indexOf(PATH) >= 0 ? " selected" : "";
      return '<option value="' + esc(p.login) + '"' + sel + '>' + esc(label) + '</option>';
    }).join("");
    b.innerHTML = '<p class="ee-k">Owner</p>' +
      '<p class="ee-note">Who may edit <code>' + esc(PATH) + '</code> (writes <code>edit/profiles.json</code>). Admin always can. Current: ' +
      (current.length ? esc(current.join(", ")) : "no player") + '.</p>' +
      '<label class="ee-note">Assign to</label>' +
      '<select id="ee-owner-select" style="width:100%;margin-top:8px;background:#0b0b0b;color:#f3eee6;border:0;border-bottom:1px solid rgba(143,138,130,.28);padding:8px 0;font:14px Helvetica,Arial,sans-serif">' + opts + '</select>' +
      '<div class="ee-row"><button type="button" class="ee-btn ee-primary" id="ee-owner-save">Save owner</button>' +
      '<button type="button" class="ee-btn" id="ee-owner-back">Back</button></div>' +
      '<p class="ee-err" id="ee-owner-err" hidden></p>';
    $("ee-owner-back").onclick = closePanel;
    $("ee-owner-save").onclick = function () { saveOwner(doc); };
  }
  function saveOwner(doc) {
    var login = ($("ee-owner-select") || {}).value || "";
    var err = $("ee-owner-err");
    function fail(m) { err.textContent = m; err.hidden = false; }
    err.hidden = true;
    var next = JSON.parse(JSON.stringify(doc)); delete next.__sha;
    var profiles = next.profiles || {};
    Object.keys(profiles).forEach(function (k) {
      if (k.charAt(0) === "_" || k.indexOf("//") === 0) return;
      var pr = profiles[k];
      if (!pr || pr.role === "admin") return;
      var perms = Array.isArray(pr.permissions) ? pr.permissions.slice() : (typeof pr.permissions === "string" ? [pr.permissions] : []);
      perms = perms.filter(function (g) { return g && g !== PATH; });
      if (k === login) perms.push(PATH);
      pr.permissions = perms;
    });
    if (login && !profiles[login]) return fail("Unknown profile.");
    commitMsg([{ path: "edit/profiles.json", text: jsonDoc(next) }], "Profiles: set owner of " + PATH + (login ? " to " + login : " to none") + " via edit mode")
      .then(function () {
        closePanel();
        editBar("Owner updated · live in about 1–2 minutes", "ee-done");
        var b = $("ee-bar");
        if (b && !b.querySelector("#ee-x")) {
          b.insertAdjacentHTML("beforeend", '<button type="button" class="ee-btn" id="ee-x">Close</button>');
          $("ee-x").onclick = closeBar;
        }
      })
      .catch(function (e) { fail(e.message || "Save failed."); });
  }


  function openArtPanel() {
    if (!P.isAdmin(state.profile) || !Media) return;
    openPanel();
    var b = $("ee-body");
    b.innerHTML = '<p class="ee-k">Art</p><p class="ee-note">Loading gallery…</p>';
    var catP = E.getFile(Media.CATALOG).then(function (f) {
      return JSON.parse(f.text);
    }, function () {
      return { version: 1, media: {} };
    });
    // Durable: always merge top-level assets/ so live site art appears without re-upload.
    var assetsP = (E.listDir ? E.listDir(Media.ASSET_DIR) : Promise.reject(new Error("no listDir"))).then(function (entries) {
      return entries.filter(function (e) { return e.type === "file"; }).map(function (e) { return e.path; });
    }, function () { return []; });
    Promise.all([catP, assetsP]).then(function (pair) {
      var cat = pair[0], paths = pair[1];
      if (paths && paths.length) {
        var seeded = Media.seedFromAssetPaths(cat, paths, { everyone: true, tags: ["site", "seed"] });
        cat = seeded.catalog;
      }
      renderGallery(cat);
    });
  }

  function gallerySrc(entry) {
    return Media.srcFromArticle(PATH, entry.path);
  }

  function renderGallery(catalog) {
    var b = $("ee-body");
    if (!b) return;
    var items = Media.listVisible(catalog, "devin", true);
    var hasHero = !!document.querySelector(".art-hero img");
    var grid = items.length
      ? '<div class="ee-gallery">' + items.map(function (m) {
          var src = gallerySrc(m);
          return '<button type="button" class="ee-gal-item" data-gal-id="' + esc(m.id) + '" title="' + esc(m.title || m.id) + '">' +
            '<img src="' + esc(src) + '" alt="">' +
            '<span>' + esc(m.title || m.id) + '</span></button>';
        }).join("") + '</div>'
      : '<p class="ee-note">Catalog is empty. Upload below, or add images from the dashboard.</p>';
    var applyHint = hasHero
      ? "Click a thumbnail to set this page's hero. Or upload a new file."
      : "Click a thumbnail to insert it at the caret (while editing), or upload a new file. This page has no art-hero — use Insert.";
    b.innerHTML =
      '<p class="ee-k">Art</p>' +
      '<p class="ee-note">' + applyHint + ' Visibility only gates the editor gallery — <code>assets/</code> URLs stay public on Pages.</p>' +
      grid +
      '<form id="ee-art-form" class="ee-gal-up">' +
      '<p class="ee-sub">Upload new</p>' +
      '<input type="file" id="ee-art-file" accept="image/png,image/jpeg,image/webp,image/gif">' +
      '<input type="text" id="ee-art-title" placeholder="Title (optional)" autocomplete="off">' +
      '<input type="text" id="ee-art-tags" placeholder="Tags (comma-separated)" autocomplete="off">' +
      '<label class="ee-check"><input type="checkbox" id="ee-art-everyone" checked> Everyone can use in the editor</label>' +
      '<div class="ee-row"><button type="submit" class="ee-btn ee-primary">' + (hasHero ? "Upload &amp; replace hero" : "Upload &amp; insert") + '</button>' +
      '<button type="button" class="ee-btn" id="ee-art-back">Back</button></div>' +
      '<p class="ee-err" id="ee-art-err" hidden></p></form>';
    $("ee-art-back").onclick = function () { closePanel(); };
    $("ee-art-form").onsubmit = function (e) {
      e.preventDefault();
      replaceHeroImage(hasHero ? "hero" : "insert");
    };
    Array.prototype.forEach.call(b.querySelectorAll("[data-gal-id]"), function (btn) {
      btn.onclick = function () {
        var id = btn.getAttribute("data-gal-id");
        var entry = catalog.media[id];
        if (!entry) return;
        if (hasHero) applyCatalogToHero(entry);
        else insertCatalogImage(entry);
      };
    });
  }

  function applyCatalogToHero(entry) {
    var hero = document.querySelector(".art-hero img");
    if (!hero) return;
    var rel = gallerySrc(entry);
    bar('<span class="ee-msg">Setting hero…</span>');
    E.getFile(PATH).then(function (page) {
      var html = page.text;
      var re = /(<section\s+class="art-hero\b[^"]*"[\s\S]*?<img\b[^>]*\ssrc=")([^"]+)(")/i;
      if (!re.test(html)) throw new Error("Could not find the hero image in the page source.");
      var nextHtml = html.replace(re, function (m, a, _old, c) { return a + rel + c; });
      if (entry.title) {
        nextHtml = nextHtml.replace(/(<section\s+class="art-hero\b[^"]*"[\s\S]*?<img\b[^>]*\salt=")([^"]*)(")/i, function (m, a, _o, c) {
          return a + String(entry.title).replace(/"/g, "") + c;
        });
      }
      return E.commitFiles([{ path: PATH, text: nextHtml }], "Media: set hero on " + PATH + " to " + entry.path + " [edit-mode]", E.BRANCH).then(function () {
        hero.src = rel;
        if (entry.title) hero.alt = entry.title;
        closePanel();
        editBar("Hero set from gallery · live in about 1–2 minutes", "ee-done");
        var b = $("ee-bar");
        if (b && !b.querySelector("#ee-x")) {
          b.insertAdjacentHTML("beforeend", '<button type="button" class="ee-btn" id="ee-x">Close</button>');
          $("ee-x").onclick = closeBar;
        }
      });
    }).catch(function (e) {
      editBar();
      openArtPanel();
      setTimeout(function () {
        var err = $("ee-art-err");
        if (err) { err.textContent = e.message || "Failed."; err.hidden = false; }
      }, 0);
    });
  }

  function insertCatalogImage(entry) {
    var rel = gallerySrc(entry);
    var imgHtml = '<img src="' + rel.replace(/"/g, "") + '" alt="' + String(entry.title || "").replace(/"/g, "") + '">';
    // Prefer caret inside an editable block; else append to first editable.
    var sel = window.getSelection && window.getSelection();
    var ok = false;
    if (sel && sel.rangeCount && state.editing) {
      var node = sel.anchorNode;
      var el = node && (node.nodeType === 1 ? node : node.parentElement);
      if (el && el.closest && el.closest(".ee-editable")) {
        document.execCommand("insertHTML", false, imgHtml);
        ok = true;
      }
    }
    if (!ok && state.editing) {
      var first = document.querySelector(".ee-editable");
      if (first) { first.insertAdjacentHTML("beforeend", imgHtml); ok = true; }
    }
    if (!ok) {
      var err = $("ee-art-err");
      if (err) { err.textContent = "Enter edit mode and place the caret where the image should go."; err.hidden = false; }
      return;
    }
    closePanel();
    editBar("Image inserted — Save to commit");
  }

  function replaceHeroImage(mode) {
    mode = mode || (document.querySelector(".art-hero img") ? "hero" : "insert");
    var file = $("ee-art-file").files[0];
    var err = $("ee-art-err");
    function fail(m) { err.textContent = m; err.hidden = false; }
    err.hidden = true;
    var title = ($("ee-art-title").value || "").trim();
    var tags = ($("ee-art-tags").value || "").split(",").map(function (t) { return t.trim(); }).filter(Boolean);
    var everyone = $("ee-art-everyone").checked;
    var hero = document.querySelector(".art-hero img");
    if (mode === "hero" && !hero) return fail("No hero image on this page.");
    bar('<span class="ee-msg">Uploading art…</span>');
    Media.validateFile(file).then(function (info) {
      return E.getFile(Media.CATALOG).then(function (f) {
        return { info: info, catalog: JSON.parse(f.text) };
      }, function () { return { info: info, catalog: { version: 1, media: {} } }; });
    }).then(function (ctx) {
      var prep = Media.prepareUpload(ctx.catalog, ctx.info, {
        title: title || ctx.info.name, tags: tags, owner: "devin", uploadedBy: "devin",
        everyone: everyone, allowed: everyone ? Media.PEOPLE.slice() : ["devin"]
      });
      var rel = Media.srcFromArticle(PATH, prep.entry.path);
      if (mode === "insert") {
        return E.commitFiles(prep.files, "Media: upload " + prep.id + " via edit gallery [edit-mode]", E.BRANCH).then(function () {
          insertCatalogImage(prep.entry);
        });
      }
      return E.getFile(PATH).then(function (page) {
        var html = page.text;
        var re = /(<section\s+class="art-hero\b[^"]*"[\s\S]*?<img\b[^>]*\ssrc=")([^"]+)(")/i;
        if (!re.test(html)) throw new Error("Could not find the hero image in the page source.");
        var nextHtml = html.replace(re, function (m, a, _old, c) { return a + rel + c; });
        if (title) nextHtml = nextHtml.replace(/(<section\s+class="art-hero\b[^"]*"[\s\S]*?<img\b[^>]*\salt=")([^"]*)(")/i, function (m, a, _o, c) { return a + title.replace(/"/g, "") + c; });
        prep.files.push({ path: PATH, text: nextHtml });
        return E.commitFiles(prep.files, "Media: replace hero on " + PATH + " with " + prep.id + " [edit-mode]", E.BRANCH).then(function () {
          hero.src = rel;
          if (title) hero.alt = title;
          closePanel();
          editBar("Hero image replaced · live in about 1–2 minutes", "ee-done");
          var b = $("ee-bar");
          if (b && !b.querySelector("#ee-x")) {
            b.insertAdjacentHTML("beforeend", '<button type="button" class="ee-btn" id="ee-x">Close</button>');
            $("ee-x").onclick = closeBar;
          }
        });
      });
    }).catch(function (e) { fail(e.message || "Upload failed."); editBar(); });
  }

  function onKey(e) {
    if (!e.target.closest || !e.target.closest(".ee-editable")) return;
    if (e.key === "Enter") {
      e.preventDefault();
      // Name/epithet stay single-line (site header).
      if (e.target.closest(".art-title")) return;
      document.execCommand("insertLineBreak");
    }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") { e.preventDefault(); save(); }
  }
  function isTitleField(el) {
    return !!(el && el.closest && el.closest(".art-title"));
  }
  function clipboardImageFiles(cd) {
    var out = [], i, f, items;
    if (!cd) return out;
    if (cd.files && cd.files.length) {
      for (i = 0; i < cd.files.length; i++) {
        f = cd.files[i];
        if (f && /^image\//.test(f.type)) out.push(f);
      }
    }
    if (!out.length && cd.items) {
      items = cd.items;
      for (i = 0; i < items.length; i++) {
        if (items[i].kind === "file" && /^image\//.test(items[i].type || "")) {
          f = items[i].getAsFile();
          if (f) out.push(f);
        }
      }
    }
    return out;
  }
  // Turn pasted Word/web HTML into leaf-block-safe markup (inline + br + img).
  function sanitizePasteHtml(html) {
    var wrap = document.createElement("div");
    wrap.innerHTML = String(html || "");
    // Drop Word cruft.
    Array.prototype.slice.call(wrap.querySelectorAll("style,meta,link")).forEach(function (n) { n.remove(); });
    function flatten(node) {
      var out = document.createElement("div");
      function walk(src, dst) {
        Array.prototype.forEach.call(src.childNodes, function (ch) {
          if (ch.nodeType === 3) { dst.appendChild(document.createTextNode(ch.nodeValue)); return; }
          if (ch.nodeType !== 1) return;
          var tag = ch.tagName.toLowerCase();
          if (DROP[tag] && tag !== "img") return;
          if (tag === "br") { dst.appendChild(document.createElement("br")); return; }
          if (tag === "img") {
            var srcAttr = safeSrc(ch.getAttribute("src") || ch.getAttribute("data-src"));
            if (!srcAttr) return;
            var im = document.createElement("img");
            im.setAttribute("src", srcAttr);
            var alt = ch.getAttribute("alt");
            if (alt) im.setAttribute("alt", alt);
            dst.appendChild(im);
            return;
          }
          if (INLINE[tag] || tag === "span") {
            var n = document.createElement(tag === "b" ? "strong" : tag === "i" ? "em" : tag);
            if (tag === "a") {
              var h = safeHref(ch.getAttribute("href"));
              if (h != null) n.setAttribute("href", h);
            }
            var cls = ch.getAttribute("class");
            if (cls && /^[\w\- ]+$/.test(cls)) n.setAttribute("class", cls);
            walk(ch, n);
            dst.appendChild(n);
            return;
          }
          if (tag === "h2" || tag === "h3") {
            var hs = document.createElement("span");
            hs.className = tag === "h2" ? "ee-h2" : "ee-h3";
            walk(ch, hs);
            if (dst.childNodes.length) dst.appendChild(document.createElement("br"));
            dst.appendChild(hs);
            dst.appendChild(document.createElement("br"));
            return;
          }
          if (tag === "blockquote") {
            var qs = document.createElement("span");
            qs.className = "ee-quote";
            walk(ch, qs);
            if (dst.childNodes.length) dst.appendChild(document.createElement("br"));
            dst.appendChild(qs);
            dst.appendChild(document.createElement("br"));
            return;
          }
          if (tag === "li") {
            if (dst.childNodes.length) dst.appendChild(document.createElement("br"));
            dst.appendChild(document.createTextNode("• "));
            walk(ch, dst);
            return;
          }
          if (tag === "p" || tag === "div" || tag === "ul" || tag === "ol" || tag === "figure" || tag === "figcaption" || /^h[1-6]$/.test(tag)) {
            if (dst.childNodes.length) dst.appendChild(document.createElement("br"));
            if (tag === "figcaption") {
              var cap = document.createElement("span");
              cap.className = "ee-caption";
              walk(ch, cap);
              dst.appendChild(cap);
            } else walk(ch, dst);
            return;
          }
          walk(ch, dst);
        });
      }
      walk(node, out);
      return out.innerHTML;
    }
    // Run through save sanitizer for final attribute safety.
    var flat = flatten(wrap);
    var tmp = document.createElement("div");
    tmp.innerHTML = flat;
    return sanitize(tmp, "p", flat);
  }
  function insertAtCaret(html) {
    var sel = window.getSelection && window.getSelection();
    if (sel && sel.rangeCount && state.editing) {
      var node = sel.anchorNode;
      var el = node && (node.nodeType === 1 ? node : node.parentElement);
      if (el && el.closest && el.closest(".ee-editable") && !isTitleField(el)) {
        document.execCommand("insertHTML", false, html);
        return true;
      }
    }
    var first = document.querySelector(".ee-editable:not(.art-title .ee-editable)");
    if (!first) first = document.querySelector("main.art-body .ee-editable, main.read .ee-editable");
    if (first) { first.insertAdjacentHTML("beforeend", html); return true; }
    return false;
  }
  function uploadPasteFile(file) {
    if (!Media) return Promise.reject(new Error("Media helpers not loaded."));
    editBar("Uploading pasted image…", "ee-busy");
    return Media.validateFile(file).then(function (info) {
      return E.getFile(Media.CATALOG).then(function (f) {
        return { info: info, catalog: JSON.parse(f.text) };
      }, function () { return { info: info, catalog: { version: 1, media: {} } }; });
    }).then(function (ctx) {
      var who = (state.profile && state.profile.person) || "devin";
      var prep = Media.prepareUpload(ctx.catalog, ctx.info, {
        title: ctx.info.name, tags: ["paste"], owner: who, uploadedBy: who,
        everyone: true, allowed: Media.PEOPLE.slice()
      });
      return E.commitFiles(prep.files, "Media: paste-upload " + prep.id + " [edit-mode]", E.BRANCH).then(function () {
        return prep.entry;
      });
    });
  }
  function dataUrlToFile(dataUrl, name) {
    var m = /^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i.exec(dataUrl || "");
    if (!m) return null;
    var bin = atob(m[2]), u8 = new Uint8Array(bin.length), i;
    for (i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    var mime = m[1].toLowerCase();
    try { return new File([u8], name || "paste.png", { type: mime }); }
    catch (e) { return new Blob([u8], { type: mime }); }
  }
  function rewriteDataImages(html) {
    if (!Media || !P.isAdmin(state.profile)) return Promise.resolve(html);
    var wrap = document.createElement("div");
    wrap.innerHTML = html;
    var imgs = Array.prototype.slice.call(wrap.querySelectorAll("img"));
    var chain = Promise.resolve();
    imgs.forEach(function (im, idx) {
      var src = im.getAttribute("src") || "";
      if (!/^data:image\//i.test(src)) return;
      chain = chain.then(function () {
        var file = dataUrlToFile(src, "paste-" + (idx + 1) + ".png");
        if (!file) return;
        // Blob may lack .name — wrap for validateFile
        if (!file.name) {
          try { file = new File([file], "paste-" + (idx + 1) + ".png", { type: file.type }); }
          catch (e) { return; }
        }
        return uploadPasteFile(file).then(function (entry) {
          im.setAttribute("src", gallerySrc(entry));
          if (entry.title && !im.getAttribute("alt")) im.setAttribute("alt", entry.title);
        });
      });
    });
    return chain.then(function () { return wrap.innerHTML; });
  }
  function onPaste(e) {
    if (!e.target.closest || !e.target.closest(".ee-editable")) return;
    e.preventDefault();
    var cd = e.clipboardData || window.clipboardData;
    if (isTitleField(e.target)) {
      var plain = cd ? cd.getData("text/plain") : "";
      document.execCommand("insertText", false, plain.replace(/\s+/g, " ").trim());
      return;
    }
    var files = clipboardImageFiles(cd);
    if (files.length && Media && P.isAdmin(state.profile)) {
      var seq = Promise.resolve();
      files.forEach(function (file) {
        seq = seq.then(function () {
          return uploadPasteFile(file).then(function (entry) {
            var rel = gallerySrc(entry);
            var imgHtml = '<img src="' + rel.replace(/"/g, "") + '" alt="' + String(entry.title || "").replace(/"/g, "") + '">';
            insertAtCaret(imgHtml);
          });
        });
      });
      seq.then(function () { editBar("Pasted image uploaded — Save to commit body"); },
        function (err) { editBar(err.message || "Paste upload failed.", "ee-bad-bar"); });
      return;
    }
    var html = cd ? cd.getData("text/html") : "";
    if (html && /<[a-z]/i.test(html)) {
      var cleaned = sanitizePasteHtml(html);
      rewriteDataImages(cleaned).then(function (finalHtml) {
        if (!finalHtml) {
          var t = cd.getData("text/plain");
          document.execCommand("insertText", false, t);
          return;
        }
        insertAtCaret(finalHtml);
        editBar("Rich paste inserted — Save to commit");
      }, function () { insertAtCaret(cleaned); });
      return;
    }
    var t = cd ? cd.getData("text/plain") : "";
    document.execCommand("insertText", false, t);
  }
  function onClick(e) {
    var a = e.target.closest && e.target.closest(".ee-editable a");
    if (a) e.preventDefault(); // editing a link's text shouldn't navigate
  }
  function stopEditing() {
    if (state.page && state.page.el) {
      var mainEl = state.page.el;
      mainEl.removeAttribute("contenteditable");
      mainEl.removeAttribute("spellcheck");
      mainEl.classList.remove("ee-editable", "ee-page");
      Array.prototype.forEach.call(mainEl.querySelectorAll(".ee-locked"), function (n) {
        n.removeAttribute("contenteditable");
        n.classList.remove("ee-locked");
        n.removeAttribute("data-ee-lock");
      });
    }
    state.records.forEach(function (r) {
      r.el.removeAttribute("contenteditable"); r.el.removeAttribute("spellcheck"); r.el.classList.remove("ee-editable");
    });
    document.documentElement.classList.remove("ee-editing", "ee-page-editing");
    document.removeEventListener("keydown", onKey, true);
    document.removeEventListener("paste", onPaste, true);
    document.removeEventListener("click", onClick, true);
    document.removeEventListener("selectionchange", onSelChange);
    window.removeEventListener("resize", positionStyleBar);
    removeStyleBar();
    state.editing = false;
  }
  function cancelEdit() {
    if (!state.editing) return;
    if (state.page && state.page.el) state.page.el.innerHTML = state.page.original;
    state.records.forEach(function (r) { r.el.innerHTML = r.original; });
    stopEditing();
    state.records = [];
    state.page = null;
  }

  /* ---------------- Full-page serialize ---------------- */
  var PAGE_BLOCK = { p: 1, h1: 1, h2: 1, h3: 1, h4: 1, h5: 1, h6: 1, section: 1, header: 1, blockquote: 1, ul: 1, ol: 1, li: 1, dl: 1, dt: 1, dd: 1, figure: 1, figcaption: 1, hr: 1, div: 1, br: 1, img: 1 };
  var PAGE_INLINE = { a: 1, em: 1, strong: 1, i: 1, b: 1, u: 1, s: 1, sub: 1, sup: 1, small: 1, span: 1, code: 1, cite: 1, q: 1, abbr: 1 };
  function sanitizePageHtml(root) {
    var out = document.createElement("div");
    function copyAttrs(from, to, tag) {
      var c = from.getAttribute("class");
      if (c && /^[\w\- ]+$/.test(c)) to.setAttribute("class", c);
      var id = from.getAttribute("id");
      if (id && /^[\w\-]+$/.test(id)) to.setAttribute("id", id);
      if (tag === "a") {
        var h = safeHref(from.getAttribute("href"));
        if (h != null) to.setAttribute("href", h);
        if (from.getAttribute("target") === "_blank") { to.setAttribute("target", "_blank"); to.setAttribute("rel", "noopener"); }
      }
      if (tag === "img") {
        var src = safeSrc(from.getAttribute("src"));
        if (src == null) return false;
        to.setAttribute("src", src);
        var alt = from.getAttribute("alt");
        if (alt != null) to.setAttribute("alt", alt);
        return true;
      }
      if ((tag === "a" || tag === "abbr") && from.getAttribute("title")) to.setAttribute("title", from.getAttribute("title"));
      return true;
    }
    function walk(src, dst) {
      Array.prototype.forEach.call(src.childNodes, function (ch) {
        if (ch.nodeType === 3) { dst.appendChild(document.createTextNode(ch.nodeValue)); return; }
        if (ch.nodeType !== 1) return;
        var tag = ch.tagName.toLowerCase();
        if (ch.getAttribute && ch.getAttribute("data-ee-lock-ph") != null) {
          var ph = document.createElement("div");
          ph.setAttribute("data-ee-lock-ph", ch.getAttribute("data-ee-lock-ph"));
          dst.appendChild(ph);
          return;
        }
        if (DROP[tag]) return;
        if (tag === "br") { dst.appendChild(document.createElement("br")); return; }
        if (tag === "img") {
          var im = document.createElement("img");
          if (!copyAttrs(ch, im, "img")) return;
          dst.appendChild(im);
          return;
        }
        if (PAGE_INLINE[tag]) {
          var n = document.createElement(tag);
          copyAttrs(ch, n, tag);
          walk(ch, n);
          dst.appendChild(n);
          return;
        }
        if (PAGE_BLOCK[tag]) {
          var b = document.createElement(tag === "div" ? "p" : tag);
          if (tag !== "div") copyAttrs(ch, b, tag);
          else {
            var dc = ch.getAttribute("class");
            if (dc && /^[\w\- ]+$/.test(dc)) b.setAttribute("class", dc);
          }
          walk(ch, b);
          dst.appendChild(b);
          return;
        }
        walk(ch, dst);
      });
    }
    walk(root, out);
    return out.innerHTML;
  }
  function serializePageMain() {
    var mainEl = state.page.el;
    var clone = mainEl.cloneNode(true);
    Array.prototype.forEach.call(clone.querySelectorAll("[data-ee-lock]"), function (n) {
      var i = n.getAttribute("data-ee-lock");
      var ph = document.createElement("div");
      ph.setAttribute("data-ee-lock-ph", i);
      n.parentNode.replaceChild(ph, n);
    });
    var html = sanitizePageHtml(clone);
    html = html.replace(/<div[^>]*data-ee-lock-ph="(\d+)"[^>]*>\s*<\/div>/gi, function (_, i) {
      return state.page.locks[Number(i)] || "";
    });
    // Prefer compact section/paragraph spacing like the rest of the site.
    return html.replace(/\n{3,}/g, "\n\n");
  }
  function openNewArticle() {
    if (!P.isAdmin(state.profile)) return;
    var title = window.prompt("New article title", "");
    if (title == null) return;
    title = String(title).trim();
    if (!title) return;
    var artSlug = (Media && Media.slugify) ? Media.slugify(title) : String(title).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
    if (!artSlug) { editBar("Need a usable title.", "ee-bad-bar"); return; }
    var path = "articles/" + artSlug + ".html";
    var pretty = "articles/" + artSlug + "/index.html";
    editBar("Creating article…", "ee-busy");
    E.getFile(path).then(function () {
      editBar("That article already exists: " + path, "ee-bad-bar");
    }, function () {
      var escTitle = title.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
      var body =
        "<!doctype html>\n<html lang=\"en\">\n<head>\n" +
        "<script src=\"/session-gate.js?v=guest-browse\"></script>\n\n" +
        "<meta charset=\"utf-8\">\n" +
        "<script src=\"/cats-rail-boot.js?v=art74\"></script>\n" +
        "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1,viewport-fit=cover\">\n" +
        "<title>" + escTitle + " - Elorae</title>\n" +
        "<meta name=\"description\" content=\"" + escTitle + "\">\n" +
        "<link rel=\"stylesheet\" href=\"/styles.css?v=art96\">\n" +
        "<link rel=\"stylesheet\" href=\"/html.css?v=edit-no-connect\">\n" +
        "<script src=\"/rail-toggle.js?v=nt26-veil\"></script>\n" +
        "<script src=\"/skip-link.js?v=nt11-skip\"></script>\n" +
        "<link rel=\"icon\" href=\"/favicon.svg\">\n</head>\n<body class=\"article\">\n" +
        "<div class=\"mast\"><header class=\"topbar\"><span class=\"mark\"></span>" +
        "<form action=\"/search/\"><input id=\"seek\" name=\"q\" type=\"search\" placeholder=\"Search\" aria-label=\"Search\"></form>" +
        "<nav class=\"filters\"><a href=\"/atlas/\">Atlas</a><a href=\"/codex/lore/\">Codex</a><a class=\"active\" href=\"/index/ancients/\">Index</a><a href=\"/journal/\">Journal</a></nav></header></div>\n" +
        "<main class=\"art-body\">\n" +
        "<header class=\"art-title\"><h1>" + escTitle + "</h1><p class=\"art-epithet\"></p></header>\n" +
        "<section class=\"art-sec\" id=\"lore\"><h2>Lore</h2><p class=\"art-life\"></p></section>\n" +
        "</main>\n" +
        "<script src=\"/search.js?v=pretty-urls\"></script><script src=\"/login.js?v=art-gallery-seed\"></script><script src=\"/player-mark.js?v=pretty-urls\"></script>\n" +
        "<canvas id=\"friend-glow\"></canvas>\n<script src=\"/glow.js?v=nt32-ambient\"></script>\n" +
        "<script src=\"/edit/edit.js?v=fullpage-edit\" defer></script>\n" +
        "</body>\n</html>\n";
      var files = [
        { path: path, text: body },
        { path: pretty, text: body }
      ];
      return E.commitFiles(files, "Edit: new article " + artSlug + " [edit-mode]", E.BRANCH).then(function () {
        editBar("Created /articles/" + artSlug + "/ — opening…", "ee-done");
        setTimeout(function () { location.href = "/articles/" + artSlug + "/#edit"; }, 800);
      });
    }).catch(function (e) {
      editBar(e.message || "Could not create article.", "ee-bad-bar");
    });
  }

  /* ---------------- Sanitizer ---------------- */
  var INLINE = { a: 1, em: 1, strong: 1, i: 1, b: 1, u: 1, s: 1, sub: 1, sup: 1, small: 1, span: 1, code: 1, cite: 1, q: 1, abbr: 1 };
  var DROP = { script: 1, style: 1, iframe: 1, object: 1, embed: 1, svg: 1, math: 1, template: 1, noscript: 1, link: 1, meta: 1, video: 1, audio: 1, canvas: 1, form: 1, input: 1, button: 1, select: 1, textarea: 1, frame: 1, frameset: 1, base: 1 };
  var NESTS = { blockquote: 1, li: 1, dd: 1, td: 1, th: 1 };
  function safeHref(h) {
    var v = String(h || "").replace(/[\u0000-\u001F\u007F\s]+/g, "");
    if (/^[a-z][a-z0-9+.-]*:/i.test(v) && !/^(https?|mailto):/i.test(v)) return null;
    return String(h).trim();
  }
  function safeSrc(s) {
    var raw = String(s == null ? "" : s).trim();
    if (!raw) return null;
    var v = raw.replace(/[\u0000-\u001F\u007F\s]+/g, "");
    if (/^(javascript|vbscript|file):/i.test(v)) return null;
    if (/^data:/i.test(v)) {
      return /^data:image\/(png|jpe?g|gif|webp|avif)/i.test(v) ? raw : null;
    }
    if (/^[a-z][a-z0-9+.-]*:/i.test(v) && !/^https?:/i.test(v)) return null;
    return raw;
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
      if (tag === "img") {
        var src = safeSrc(from.getAttribute("src"));
        if (src == null) return false;
        to.setAttribute("src", src);
        var alt = from.getAttribute("alt");
        if (alt != null) to.setAttribute("alt", alt);
        return true;
      }
      if ((tag === "a" || tag === "abbr") && from.getAttribute("title")) to.setAttribute("title", from.getAttribute("title"));
      return true;
    }
    function walk(src, dst) {
      Array.prototype.forEach.call(src.childNodes, function (ch) {
        if (ch.nodeType === 3) { dst.appendChild(document.createTextNode(ch.nodeValue)); return; }
        if (ch.nodeType !== 1) return; // comments etc. dropped
        var tag = ch.tagName.toLowerCase();
        if (DROP[tag]) return;
        if (tag === "br") { dst.appendChild(document.createElement("br")); return; }
        if (tag === "img") {
          var im = document.createElement("img");
          if (!copyAttrs(ch, im, "img")) return;
          dst.appendChild(im);
          return;
        }
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
    if (state.page) {
      if (state.page.el.innerHTML === state.page.original) return { none: true };
      var html = serializePageMain();
      var range = sourceMainRange(latest.text);
      if (!range) return { conflict: true };
      var out = latest.text.slice(0, range.start) + html + latest.text.slice(range.end);
      return { out: out, edits: [{ start: range.start, end: range.end, html: html }], changed: [state.page], page: true };
    }
    var changed = state.records.filter(function (r) { return r.el.innerHTML !== r.start; });
    if (!changed.length) return { none: true };
    var blocks = state.base.blocks;
    if (latest.sha !== state.base.sha) {
      var nb = M.sourceBlocks(latest.text, titleOpts());
      if (nb.length !== blocks.length) return { conflict: true };
      for (var i = 0; i < changed.length; i++) if (nb[changed[i].idx].inner !== changed[i].src.inner) return { conflict: true };
      blocks = nb;
    }
    var edits = changed.map(function (r) {
      var b = blocks[r.idx];
      var html = preserveEntities(sanitize(r.el, r.src.tag, canon(r.src.inner)), b.inner);
      // Site rule: epithet / description lines have no ending period.
      if (r.el.classList && r.el.classList.contains("art-epithet")) html = html.replace(/\.\s*$/, "");
      return { start: b.start, end: b.end, html: html, idx: r.idx };
    });
    var out = M.splice(latest.text, edits);
    // Self-check: same block structure, untouched blocks byte-identical.
    var after = M.sourceBlocks(out, titleOpts());
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
        state.base = {
          sha: done.res.content.sha,
          text: done.r.out,
          blocks: done.r.page ? null : M.sourceBlocks(done.r.out, titleOpts())
        };
        if (state.page) {
          state.page.original = state.page.el.innerHTML;
          state.page.range = sourceMainRange(done.r.out) || state.page.range;
        }
      }
      state.records.forEach(function (rec) { rec.original = rec.el.innerHTML; });
      stopEditing();
      state.page = null;
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
      else if (err.status === 401) m = "Your session expired, so nothing was saved. Keep this tab open, enter again (Edit, then Enter), then press Save again.";
      else if (err.status === 403 || err.status === 404) m = "GitHub refused the save (" + err.status + "): the token may lack Contents write access" + (mode === "pr" ? " or Pull requests access" : "") + ". Nothing was saved.";
      else m = err.message || "Save failed. Nothing was saved.";
      editBar(m, "ee-bad-bar");
      if (err.status === 401) {
        E.session.clear(); notify();
        openPanel("Your token expired or was deleted. Make a new one, enter, then press Save again. Your edits are still on the page.", "info");
      }
    }).then(function () { state.busy = false; });
  }

  /* ---------------- Init ---------------- */
  var bootExpired = false;
  function clearEditHash() {
    if (location.hash === "#edit") {
      try { history.replaceState(null, "", location.pathname + location.search); } catch (e) {
        location.hash = "";
      }
    }
  }
  function phraseWhoNow() {
    try { return String((E.loginWho && E.loginWho()) || "").toLowerCase(); } catch (e) { return ""; }
  }
  /* Site owner signed in by phrase — Connect happened before Edit/nav existed. */
  function isOwnerPhrase() {
    var who = phraseWhoNow();
    if (who === "devin") return true;
    try {
      if (document.body && document.body.classList.contains("login-devin")) return true;
    } catch (e) {}
    return false;
  }
  function alreadyConnectedHere() {
    var s = E.session.get();
    if (s && s.token) return true;
    /* Owner phrase login: never treat as first-time Make-token (Connect predated Edit). */
    if (isOwnerPhrase()) return true;
    if (!E.session.wasLinked) return false;
    var who = phraseWhoNow();
    /* Phrase identity (Devin) or any alias left by login Connect. */
    if (who && E.session.wasLinked(who)) return true;
    /* Owner: always honor linked stamps under person or GitHub login, even if phrase who is empty. */
    if ((!who || who === "devin") && E.session.wasLinked("devin")) return true;
    if ((!who || who === "devin") && E.session.wasLinked("195142095142091920")) return true;
    /* Any linked flag on this browser (pre-phrase identity). */
    try { if (E.session.wasLinked("")) return true; } catch (e2) {}
    return false;
  }
  /* Soft reconnect — NOT the first-time Make-token onboarding panel. */
  function softReconnect() {
    try {
      var who = phraseWhoNow() || "devin";
      if (E.session.markLinked) {
        E.session.markLinked(who, "195142095142091920");
        E.session.markLinked("devin", "195142095142091920");
      }
    } catch (e) {}
    clearEditHash();
    bootExpired = true;
    /* Paste-only reconnect — never the first-time Make-token onboarding panel. */
    openReconnectPanel(isOwnerPhrase()
      ? "You're signed in as Devin. Paste the GitHub token from when you connected — Edit will open right after."
      : "Paste your existing GitHub token to keep editing.");
  }
  /* Nav Edit / #edit: enter edit mode when already connected — never bounce to Connect. */
  function tryEnterEdit() {
    if (!E.session.get() || !state.profile) return false;
    if (state.editing || state.busy) { clearEditHash(); return true; }
    var Org = window.EloraeIndexOrg;
    if (isIndexOrganizePage() && Org && Org.start) {
      closePanel();
      clearEditHash();
      Org.start();
      return true;
    }
    if (!P.canEdit(state.profile, PATH)) return false;
    if (!liveBlocks().length && !isIndexOrganizePage()) return false;
    closePanel();
    clearEditHash();
    startEdit();
    return true;
  }
  function loadProfile() {
    var s = E.session.get();
    if (!s) return Promise.resolve(null);
    function apply(f) {
      state.profiles = JSON.parse(f.text);
      state.profile = P.profileFor(state.profiles, s.login);
      return state.profile;
    }
    return E.getFile("edit/profiles.json").then(apply).catch(function (err) {
      if (err.status !== 401) return null;
      /* Stale tab session may shadow a remembered Connect — drop tab copy and retry once. */
      if (E.session.dropTabSession) E.session.dropTabSession();
      s = E.session.get();
      if (!s) { bootExpired = true; softReconnect(); return null; }
      return E.getFile("edit/profiles.json").then(apply).catch(function (err2) {
        if (err2.status === 401) { bootExpired = true; softReconnect(); }
        return null;
      });
    });
  }
  function enterWithSession() {
    return loadProfile().then(function () {
      if (tryEnterEdit()) return;
      /* Token present: signed-in panel only — never first-time Make-token. */
      if (E.session.get()) openPanel();
      else if (alreadyConnectedHere()) softReconnect();
    });
  }
  function decideEditHash() {
    if (location.hash !== "#edit") return;
    if (bootExpired) return; /* soft re-enter already offered; do not dump Make-token */
    if (tryEnterEdit()) return;
    /* Live login/Edit Connect token: enter edit or signed-in panel — never Make-token. */
    if (E.session.get()) return enterWithSession();
    /* Salvage: drop a bad tab copy, then scan every LS/SS key for a leftover Connect token. */
    if (E.session.dropTabSession) E.session.dropTabSession();
    if (E.session.salvage) E.session.salvage();
    if (E.session.get()) return enterWithSession();
    if (alreadyConnectedHere() || isOwnerPhrase()) {
      /* Linked / owner phrase but token missing — soft re-enter only (no Make-token marketing). */
      softReconnect();
      return;
    }
    openPanel(); /* first-time Connect only — never connected on this browser */
  }
  var profileReady = loadProfile().then(function () { glyph(); });
  function onHash() {
    if (location.hash !== "#edit") return;
    profileReady.then(decideEditHash);
  }
  window.addEventListener("hashchange", onHash);
  profileReady.then(decideEditHash);

  window.EloraeEditor = { sanitize: sanitize, preserveEntities: preserveEntities, state: state, startEdit: startEdit, save: save, cancel: cancelEdit, path: PATH, openPanel: openPanel, glyph: glyph, tryEnterEdit: tryEnterEdit, onHash: onHash };
})();
