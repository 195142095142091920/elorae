/* Elorae edit mode: sign-in panel, EDIT glyph, in-place editing and save.
   Loaded on demand by edit/edit.js (never for anonymous visitors). */
(function () {
  "use strict";
  var E = window.EloraeEdit, P = window.EloraeEditPerms, M = window.EloraeSrcMap, Media = window.EloraeMedia,
      K = window.EloraeCrypto, V = window.EloraeVis, R = window.EloraeRecent;
  if (!E || !P || !M || window.EloraeEditor) return;

  var X_SVG = '<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M1.5 1.5L12.5 12.5M12.5 1.5L1.5 12.5" fill="none" stroke="#f3eee6" stroke-width="1" stroke-linecap="round" vector-effect="non-scaling-stroke"/></svg>';
  var PATH = E.pagePath();
  var state = { profiles: null, profile: null, editing: false, base: null, records: [], busy: false };
  // In-place page swaps (the Ghostly Wanderer journal tabs, ghostly-swap.js): follow the page shown.
  // The swap is paused while editing, so PATH never changes under an open edit.
  window.addEventListener("elorae-content-swapped", function () {
    if (state.editing) return;
    PATH = E.pagePath();
    if (typeof glyph === "function") glyph();
  });

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
    if (p) {
      p.hidden = true;
      p.classList.remove("ee-gal-mode");
      var box = p.querySelector(".ee-box");
      if (box) box.classList.remove("ee-wide");
    }
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
    /* Article pages: no floating EDIT on the hero art (it sat on the Arts arrows); the top-nav
       EDIT opens the editor instead (edit.js EloraeEditNav; its click runs tryEnterEdit). */
    var NavE = window.EloraeEditNav;
    if (NavE && document.body.classList.contains("article")) {
      if (g) g.remove();
      if (ok) NavE.add(); else NavE.remove();
      return;
    }
    if (!ok) { if (g) g.remove(); return; }
    if (g) return;
    g = el("button", { id: "ee-glyph", type: "button", "aria-label": "Edit this page" }, "Edit");
    g.onclick = function () {
      if (state.editing) { if (!state.busy && !$("ee-bar")) editBar(); return; }
      var O = window.EloraeIndexOrg;
      if (O && O.active && O.active()) return;
      if (isIndexOrganizePage() && O && O.start) { O.start(); return; }
      startEdit();
    };
    document.body.appendChild(g);
  }

  /* Article pages in edit mode: the edit bar + style bar are fixed at the bottom of the screen and
     used to sit on the hero (name, epithet, Arts arrows). --ee-dock = how much of the viewport bottom
     they take; edit.css shortens the hero by that much, so nothing in it is covered. */
  var dockRO = null, dockSeen = [], dockMax = 0;
  function dockSync() {
    var root = document.documentElement;
    if (!document.body || !document.body.classList.contains("article") || !root.classList.contains("ee-editing")) {
      dockMax = 0;
      if (root.style.getPropertyValue("--ee-dock")) root.style.removeProperty("--ee-dock");
      return;
    }
    var top = window.innerHeight;
    ["ee-bar", "ee-stylebar"].forEach(function (id) {
      var e = $(id);
      if (!e) return;
      if (dockRO && dockSeen.indexOf(e) < 0) { dockSeen.push(e); dockRO.observe(e); }
      var r = e.getBoundingClientRect();
      if (r.height > 0 && getComputedStyle(e).position === "fixed") top = Math.min(top, r.top);
    });
    // Only grows during one edit session (a bar message changing height must not make the page jump).
    dockMax = Math.max(dockMax, Math.round(window.innerHeight - top));
    var v = dockMax + "px";
    if (root.style.getPropertyValue("--ee-dock") !== v) root.style.setProperty("--ee-dock", v);
  }
  if (document.body && document.body.classList.contains("article")) {
    if (window.ResizeObserver) dockRO = new ResizeObserver(function () { dockSync(); });
    new MutationObserver(function () { dockSeen = dockSeen.filter(function (e) { return e.isConnected; }); dockSync(); })
      .observe(document.body, { childList: true });
    new MutationObserver(dockSync).observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    window.addEventListener("resize", function () { dockMax = 0; dockSync(); });
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
  function doneBar(msg) {
    bar('<span class="ee-msg ee-good">' + esc(msg) + '</span><button type="button" class="ee-btn" id="ee-x">Close</button>', "ee-done");
    $("ee-x").onclick = closeBar;
  }
  function canon(html) { var t = document.createElement("template"); t.innerHTML = html; return t.innerHTML; }
  function textOf(html) { var t = document.createElement("template"); t.innerHTML = html; return norm(t.content.textContent); }
  function norm(s) { return String(s || "").replace(/\s+/g, " ").trim(); }

  function startEdit() {
    if (state.editing || state.busy) return;
    if (!P.canEdit(state.profile, PATH)) return;
    // Your last save is not live yet and this page could not be fully brought up to date:
    // editing it now could save the old text back (recent.js).
    var wait = R && R.blocked(PATH);
    if (wait) {
      bar('<span class="ee-msg">' + esc(wait) + '</span><button type="button" class="ee-btn" id="ee-x">Close</button>');
      $("ee-x").onclick = closeBar;
      return;
    }
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
          range: range
        };
        // Match live elements to the source BEFORE any edit-mode marking.
        var PS = initPageSource(mainEl, f.text);
        if (!PS) throw new Error("Could not find the page body in the source.");
        mainEl.setAttribute("contenteditable", "true");
        mainEl.setAttribute("spellcheck", "true");
        mainEl.classList.add("ee-editable", "ee-page");
        Array.prototype.forEach.call(mainEl.querySelectorAll(PAGE_LOCK_SEL), function (n, i) {
          var sn = PS.map.get(n);
          PS.lockHTML[i] = sn ? PS.text.slice(sn.start, sn.end) : cleanRuntime(n.cloneNode(true), "raw").outerHTML;
          n.setAttribute("contenteditable", "false");
          n.classList.add("ee-locked");
          n.setAttribute("data-ee-lock", String(i));
        });
        setupTitles(mainEl);
        state.pending = {}; state.hero = null;
        setupArts();
        state.railRestore = E.closePhoneRail ? E.closePhoneRail() : null;
        document.documentElement.classList.add("ee-editing", "ee-page-editing");
        // New lines become real paragraphs (body size), not bare divs.
        try { document.execCommand("defaultParagraphSeparator", false, "p"); } catch (e0) {}
        // Empty article: put the caret inside the first empty Lore paragraph so typing
        // starts at body size instead of extending the small "Lore" heading.
        try {
          var emptyP = mainEl.querySelector("p.art-life:empty, .read p:empty");
          if (emptyP) {
            mainEl.focus();
            var r0 = document.createRange(); r0.setStart(emptyP, 0); r0.collapse(true);
            var s0 = window.getSelection(); s0.removeAllRanges(); s0.addRange(r0);
          }
        } catch (e1) {}
        document.addEventListener("keydown", onKey, true);
        document.addEventListener("paste", onPaste, true);
        document.addEventListener("copy", onCopy, true);
        document.addEventListener("cut", onCopy, true);
        document.addEventListener("click", onClick, true);
        document.addEventListener("click", onCapClick, true);
        mainEl.addEventListener("input", onCapInput);
        capMarkAll();
        document.addEventListener("selectionchange", onSelChange);
        window.addEventListener("resize", positionStyleBar);
        addDirtyListeners();
        state.editing = true;
        editBar();
        dossierTools();
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
      state.pending = {}; state.hero = null; state.titles = [];
      document.documentElement.classList.add("ee-editing");
      document.addEventListener("keydown", onKey, true);
      document.addEventListener("paste", onPaste, true);
      document.addEventListener("copy", onCopy, true);
      document.addEventListener("cut", onCopy, true);
      document.addEventListener("click", onClick, true);
      document.addEventListener("selectionchange", onSelChange);
      window.addEventListener("resize", positionStyleBar);
      addDirtyListeners();
      state.editing = true;
      editBar();
      ensureStyleBar();
    }).catch(function (err) {
      bar('<span class="ee-msg ee-bad">' + esc(err.message || "Could not start editing.") + '</span><button type="button" class="ee-btn" id="ee-x">Close</button>');
      $("ee-x").onclick = closeBar;
    }).then(function () { state.busy = false; });
  }
  /* Hero name + epithet: admins, and players on their own page. Inside main they are
     saved with the body; in the hero (most articles) they are their own small regions. */
  function titlesAllowed() { return !!(state.profile && P.ownsPage && P.ownsPage(state.profile, PATH)); }
  function setupTitles(mainEl) {
    state.titles = [];
    var ok = titlesAllowed();
    Array.prototype.forEach.call(document.querySelectorAll(".art-title"), function (t) {
      if (t.closest("#ee-panel,#ee-bar")) return;
      if (mainEl.contains(t)) {
        if (!ok) { t.setAttribute("contenteditable", "false"); t.classList.add("ee-locked"); }
        return;
      }
      if (!ok) return;
      [["h1", t.querySelector("h1")], ["epithet", t.querySelector(".art-epithet")]].forEach(function (pair) {
        var n = pair[1];
        if (!n) return;
        n.setAttribute("contenteditable", "true");
        n.setAttribute("spellcheck", "true");
        n.classList.add("ee-editable", "ee-title-edit");
        state.titles.push({ kind: pair[0], el: n, original: n.innerHTML, text: norm(n.textContent) });
      });
    });
  }
  function noEndPeriod(el) {
    var w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null), t, last = null;
    while ((t = w.nextNode())) if (/\S/.test(t.nodeValue)) last = t;
    if (last && /\.\s*$/.test(last.nodeValue)) last.nodeValue = last.nodeValue.replace(/\.\s*$/, "");
  }
  function editBar(msg, cls) {
    var mode = P.saveMode(state.profile) === "direct" ? "Saves to the live site" : "Saves as a pull request";
    var admin = P.isAdmin(state.profile);
    var artBtn = (admin && Media)
      ? '<button type="button" class="ee-btn" id="ee-art">Art</button>' : '';
    // vt1: who can see this article (Everyone / Devin only / chosen players); replaces Share.
    var VS = window.EloraeVisSet, vslug = articleSlugOfPath();
    var shareBtn = '';
    if (admin && VS && vslug) {
      var vst = VS.current(vslug);
      shareBtn = '<button type="button" class="ee-btn ee-vis-btn ee-vis-' + vst.mode + '" id="ee-vis" aria-haspopup="dialog" aria-expanded="false" title="Who can see this: ' + esc(VS.label(vst)) + '">' +
        VS.ICON[vst.mode] + '<span class="ee-vis-lbl">' + esc(VS.shortLabel(vst)) + '</span></button>';
    } else if (admin && V) shareBtn = '<button type="button" class="ee-btn" id="ee-share">Share</button>';
    var ownerBtn = admin ? '<button type="button" class="ee-btn" id="ee-owner">Owner</button>' : '';
    var newBtn = admin ? '<button type="button" class="ee-btn" id="ee-newart" aria-label="New article">New<span class="ee-wide-only"> article</span></button>' : '';
    var delBtn = admin && articleSlugOfPath() ? '<button type="button" class="ee-btn ee-danger" id="ee-delart" aria-label="Delete article">Del<span class="ee-wide-only">ete</span></button>' : '';
    var imgBtn = (state.page && Media && P.canEdit(state.profile, PATH)) ? '<button type="button" class="ee-btn" id="ee-img" aria-label="Image" title="Insert a picture with a caption at the caret"><svg class="ee-img-ic" viewBox="0 0 24 24" width="15" height="15" aria-hidden="true" focusable="false"><rect x="3" y="5" width="18" height="14" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M4 17l5-5 4 4 2.5-2.5L20 18" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="16" cy="9.5" r="1.6" fill="currentColor"/></svg><span class="ee-img-lbl">Image</span></button>' : '';
    var tplBtn = templatesAllowed() ? '<button type="button" class="ee-btn" id="ee-tpl" aria-haspopup="menu" aria-expanded="false" title="Article template">Template</button>' : '';
    var artsBtn = state.arts ? '<button type="button" class="ee-btn" id="ee-arts-btn" aria-expanded="' + (state.arts.open ? "true" : "false") + '">Arts<span class="ee-wide-only"> (' + state.arts.list.length + ')</span></button>' : '';
    bar('<span class="ee-msg">' + esc(msg || ("Editing · " + mode)) + '</span>' +
      tplBtn + artsBtn + imgBtn + artBtn + shareBtn + ownerBtn + newBtn + delBtn +
      '<button type="button" class="ee-btn" id="ee-cancel">Cancel</button>' +
      '<button type="button" class="ee-btn ee-primary" id="ee-save">Save</button>', cls);
    $("ee-save").onclick = save;
    $("ee-cancel").onclick = function () {
      if (state.dirty && !window.confirm("Discard your unsaved changes to this page?")) return;
      cancelEdit(); closeBar();
    };
    if ($("ee-art")) $("ee-art").onclick = function () { openArtPanel(); };
    if ($("ee-img")) { $("ee-img").onmousedown = function (e) { e.preventDefault(); captureStyleRange(); }; $("ee-img").onclick = function () { captureStyleRange(); openArtPanel({ insert: true }); }; }
    if ($("ee-tpl")) $("ee-tpl").onclick = function (e) { e.stopPropagation(); toggleTemplateMenu(); };
    if ($("ee-arts-btn")) $("ee-arts-btn").onclick = function () { if (state.arts) { state.arts.open = !state.arts.open; renderArts(); editBar(msg, cls); } };
    if ($("ee-share")) $("ee-share").onclick = openSharePanel;
    if ($("ee-vis")) $("ee-vis").onclick = function (e) {
      e.stopPropagation();
      var VS = window.EloraeVisSet, sl = articleSlugOfPath(), h1 = document.querySelector(".art-title h1");
      VS.open($("ee-vis"), sl, { name: h1 ? norm(h1.textContent) : sl, onSaved: function (res, st) {
        editBar((res.files.length ? "Visible to " + VS.label(st) + ". " : "No change. ") + "Saved at " + new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) + ".", "ee-done");
      } });
    };
    if ($("ee-vis") && window.EloraeVisSet && !window.EloraeVisSet.manifest()) {
      window.EloraeVisSet.loadManifest().then(function () { var b = $("ee-vis"); if (b && !$("ee-vis-pop")) { var VS = window.EloraeVisSet, st = VS.current(articleSlugOfPath());
        b.className = "ee-btn ee-vis-btn ee-vis-" + st.mode; b.title = "Who can see this: " + VS.label(st); b.innerHTML = VS.ICON[st.mode] + '<span class="ee-vis-lbl">' + esc(VS.shortLabel(st)) + "</span>"; } }).catch(function () {});
    }
    if ($("ee-owner")) $("ee-owner").onclick = openOwnerPanel;
    if ($("ee-delart")) $("ee-delart").onclick = deleteArticleFlow;
    if ($("ee-newart")) $("ee-newart").onclick = function () {
      if (state.dirty && !window.confirm("You have unsaved changes on this page. Discard them and start a new article?")) return;
      openNewArticle();
    };
    ensureStyleBar();
    if ($("ee-arts")) setTimeout(positionArts, 0);
  }

  /* ---------------- Article templates (Dossier presets) ----------------
     Template on the edit bar: None or one of Media.ART_TEMPLATES. Choosing one adds its fields as
     empty Dossier rows (after the rows already there; a label that is already there is not added
     twice) and keeps the type as a tpl-<id> class on dl.art-dossier, so it shows as selected next
     time. Switching never deletes a filled row: it only drops the old type's rows that are still
     empty and adds the new type's missing ones. The rows are ordinary <dt>/<dd> page content, saved
     with the body (both copies); empty ones are hidden from viewers by html.css (tpl1). */
  function templatesAllowed() {
    return !!(Media && Media.ART_TEMPLATES && state.editing && state.page && state.page.el && state.page.el.matches("main.art-body"));
  }
  function dossierEl() { return state.page && state.page.el.querySelector("dl.art-dossier"); }
  function currentTemplate() {
    var dl = dossierEl(), m = dl && /(?:^|\s)tpl-([\w-]+)/.exec(dl.className);
    return m && Media.artTemplate(m[1]) ? m[1] : "";
  }
  function ddEmpty(dd) { return !!dd && !norm(dd.textContent) && !dd.querySelector("img"); }
  function closeTemplateMenu() {
    var m = $("ee-tpl-menu"); if (m) m.remove();
    var b = $("ee-tpl"); if (b) b.setAttribute("aria-expanded", "false");
    document.removeEventListener("mousedown", tplOutside, true);
  }
  function tplOutside(e) { if (!e.target.closest("#ee-tpl-menu, #ee-tpl")) closeTemplateMenu(); }
  function toggleTemplateMenu() {
    if ($("ee-tpl-menu")) { closeTemplateMenu(); return; }
    var btn = $("ee-tpl"); if (!btn) return;
    var cur = currentTemplate();
    var items = [{ id: "", label: "None" }].concat(Media.ART_TEMPLATES);
    var menu = el("div", { id: "ee-tpl-menu", "class": "ee-tpl-menu", role: "menu", "data-ee-ui": "1" },
      '<div class="ee-tpl-head">Template</div>' + items.map(function (t) {
        return '<button type="button" role="menuitemradio" aria-checked="' + (t.id === cur) + '" class="ee-tpl-item' + (t.id === cur ? " ee-on" : "") + '" data-tpl="' + esc(t.id) + '">' + esc(t.label) + "</button>";
      }).join(""));
    document.body.appendChild(menu);
    var r = btn.getBoundingClientRect(), mw = menu.offsetWidth, mh = menu.offsetHeight;
    var left = Math.max(8, Math.min(window.innerWidth - mw - 8, r.left + r.width / 2 - mw / 2));
    var top = r.top - mh - 8; if (top < 8) top = Math.min(window.innerHeight - mh - 8, r.bottom + 8);
    menu.style.left = Math.round(left) + "px"; menu.style.top = Math.round(top) + "px";
    btn.setAttribute("aria-expanded", "true");
    menu.addEventListener("click", function (e) {
      var it = e.target.closest("[data-tpl]"); if (!it) return;
      closeTemplateMenu();
      applyTemplate(it.getAttribute("data-tpl"));
    });
    setTimeout(function () { document.addEventListener("mousedown", tplOutside, true); }, 0);
  }
  function applyTemplate(type) {
    if (!templatesAllowed()) return;
    var main = state.page.el, cur = currentTemplate();
    var nt = type ? Media.artTemplate(type) : null;
    if (type && !nt) return;
    if ((type || "") === cur) { editBar(nt ? "Template: " + nt.label : "No template"); return; }
    var ot = cur ? Media.artTemplate(cur) : null;
    var lc = function (x) { return norm(x).toLowerCase(); };
    var oldF = (ot ? ot.fields : []).map(lc), newF = (nt ? nt.fields : []).map(lc);
    var dl = dossierEl();
    if (!dl) {
      if (!nt) { editBar("No template \u00b7 use + Add dossier to start one"); return; }
      dl = ensureDossier();
    }
    // Drop the old type's rows that are still empty (and not part of the new type).
    Array.prototype.slice.call(dl.querySelectorAll(":scope > dt")).forEach(function (dt) {
      var dd = dt.nextElementSibling;
      if (!dd || dd.tagName !== "DD") return;
      var l = lc(dt.textContent);
      if (oldF.indexOf(l) >= 0 && newF.indexOf(l) < 0 && ddEmpty(dd)) { dt.remove(); dd.remove(); }
    });
    // Add the new type's missing rows, in its order, after what is there.
    var have = {};
    Array.prototype.forEach.call(dl.querySelectorAll(":scope > dt"), function (dt) { have[lc(dt.textContent)] = 1; });
    var added = 0;
    (nt ? nt.fields : []).forEach(function (f) {
      if (have[lc(f)]) return;
      var dt = document.createElement("dt"); dt.textContent = f;
      var dd = document.createElement("dd");
      dl.appendChild(dt); dl.appendChild(dd); added++;
    });
    Array.prototype.slice.call(dl.classList).forEach(function (c) { if (/^tpl-/.test(c)) dl.classList.remove(c); });
    if (nt) dl.classList.add("tpl-" + nt.id);
    // A Dossier the template itself created goes again when nothing is left in it.
    var box = dl.closest("section.art-sec");
    if (!dl.querySelector("dt") && box && box.id === "dossier" && !(pageSrc().map && pageSrc().map.get(box))) box.remove();
    state.dirty = true;
    editBar(nt ? "Template: " + nt.label + (added ? " \u00b7 " + added + " field" + (added > 1 ? "s" : "") + " added" : "") + " \u00b7 Save to publish" : "No template \u00b7 empty fields removed \u00b7 Save to publish");
    var first = nt && Array.prototype.filter.call(dl.querySelectorAll(":scope > dd"), ddEmpty)[0];
    if (first) { try { first.scrollIntoView({ block: "center" }); } catch (e) {} }
    dossierTools();
  }
  /* dos1: a Dossier can be started on any article, and any field added, not only via a template.
     The page gets a "+ Add dossier" control where the Dossier goes (after Description, before
     the rest) when there is none, and "+ Add field" under an existing one. Both are editor UI
     (data-ee-ui: never saved). Enter in a field name moves to its value; Enter in a value starts
     the next field (Shift+Enter: a line break inside the value). Rows left with no name and no
     value are dropped on Save; a Dossier started in this session and left empty goes too. */
  function ensureDossier() {
    var dl = dossierEl(); if (dl) return dl;
    var main = state.page.el;
    var sec = document.createElement("section");
    sec.className = "art-sec"; sec.id = "dossier";
    sec.innerHTML = "<h2>Dossier</h2>";
    dl = document.createElement("dl"); dl.className = "art-dossier";
    sec.appendChild(dl);
    var desc = main.querySelector(":scope > #description");
    if (desc) desc.after(sec); else main.insertBefore(sec, main.firstElementChild);
    return dl;
  }
  function removeDossierTools() {
    Array.prototype.forEach.call(document.querySelectorAll(".ee-dossier-tools"), function (n) { n.remove(); });
  }
  function caretAt(node) {
    try {
      var r = document.createRange(); r.selectNodeContents(node); r.collapse(false);
      var sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r);
      if (state.page && state.page.el.focus) state.page.el.focus({ preventScroll: true });
      sel.removeAllRanges(); sel.addRange(r);
    } catch (e) {}
  }
  function addDossierField(after) {
    if (!templatesAllowed()) return null;
    var had = !!dossierEl();
    var dl = ensureDossier();
    var dt = document.createElement("dt"), dd = document.createElement("dd");
    if (after && after.parentNode === dl) { after.after(dt); dt.after(dd); } else { dl.appendChild(dt); dl.appendChild(dd); }
    state.dirty = true;
    dossierTools();
    caretAt(dt);
    try { dt.scrollIntoView({ block: "nearest" }); } catch (e) {}
    editBar((had ? "Field added" : "Dossier added") + " \u00b7 type the field name, Enter, then its value \u00b7 Save to publish");
    return dt;
  }
  function dossierTools() {
    removeDossierTools();
    if (!templatesAllowed()) return;
    var main = state.page.el, dl = dossierEl();
    var box = el("div", { "class": "ee-dossier-tools", "data-ee-ui": "1", contenteditable: "false" },
      '<button type="button" class="ee-dos-add" data-ee-dos="1">' + (dl ? "+ Add field" : "+ Add dossier") + "</button>");
    if (dl) dl.after(box);
    else {
      var desc = main.querySelector(":scope > #description");
      if (desc) desc.after(box); else main.insertBefore(box, main.firstElementChild);
    }
    box.addEventListener("mousedown", function (e) { e.preventDefault(); });
    box.addEventListener("click", function (e) {
      if (!e.target.closest("[data-ee-dos]")) return;
      e.preventDefault(); e.stopPropagation();
      addDossierField();
    });
  }
  // Enter inside the Dossier (onKey): name -> its value; value -> a new field after it.
  function dossierEnter(e) {
    var n = selNode(), cell = n && n.closest && n.closest("main.art-body dl.art-dossier > dt, main.art-body dl.art-dossier > dd");
    if (!cell || !templatesAllowed()) return false;
    if (cell.tagName === "DT") {
      var dd = cell.nextElementSibling;
      if (!dd || dd.tagName !== "DD") { dd = document.createElement("dd"); cell.after(dd); }
      caretAt(dd); return true;
    }
    if (e.shiftKey) return false;
    addDossierField(cell);
    return true;
  }
  // Before save: a field emptied while editing (often a lone <br>) is saved truly empty, so viewers never see it.
  function tidyDossier() {
    var dl = dossierEl(); if (!dl) return;
    Array.prototype.forEach.call(dl.querySelectorAll(":scope > dd"), function (dd) { if (ddEmpty(dd) && dd.innerHTML !== "") dd.innerHTML = ""; });
    Array.prototype.forEach.call(dl.querySelectorAll(":scope > dt"), function (dt) {
      if (!norm(dt.textContent) && dt.innerHTML !== "") dt.innerHTML = "";
      var dd = dt.nextElementSibling;
      if (!norm(dt.textContent) && (!dd || dd.tagName !== "DD" || ddEmpty(dd))) { if (dd && dd.tagName === "DD") dd.remove(); dt.remove(); }
    });
    var box = dl.closest("section.art-sec");
    if (!dl.querySelector("dt, dd") && box && box.id === "dossier" && !(pageSrc().map && pageSrc().map.get(box))) box.remove();
  }

  /* ---------------- Styling toolbar (caret block) ---------------- */
  var STYLE_FONTS = [
    { id: "serif", label: "Serif \u2014 Iowan Old Style", cls: "ee-serif" },
    { id: "sans", label: "Sans-serif \u2014 Helvetica Neue", cls: "ee-sans" }
  ];
  var STYLE_SIZES = ["10", "11", "12", "14", "16", "18", "20", "24"].map(function (n) {
    return { id: n, label: n + "pt", cls: "ee-pt-" + n };
  });
  var STYLE_BLOCKS = [
    { id: "p", label: "P", cls: "" },
    { id: "h2", label: "H2", cls: "ee-h2" },
    { id: "h3", label: "H3", cls: "ee-h3" },
    { id: "cap", label: "Cap", cls: "ee-caption" }
  ];
  var savedStyleRange = null;
  function captureStyleRange() {
    var sel = window.getSelection && window.getSelection();
    if (!sel || !sel.rangeCount) return;
    var n = sel.anchorNode;
    var node = n && (n.nodeType === 1 ? n : n.parentElement);
    if (!node || !node.closest) return;
    var ed = node.closest(".ee-editable");
    if (!ed || isTitleField(ed)) return;
    try { savedStyleRange = sel.getRangeAt(0).cloneRange(); } catch (e) {}
  }
  function restoreStyleRange() {
    // The live selection wins when it is still in the text (the saved copy can lag a
    // selectionchange behind); the saved one is for when a control took the selection.
    var cur = selectionEditable();
    if (cur && (!state.page || cur === state.page.el)) { captureStyleRange(); return true; }
    var ed = null;
    if (savedStyleRange) {
      try {
        var sc = savedStyleRange.startContainer;
        var node = sc && (sc.nodeType === 1 ? sc : sc.parentElement);
        ed = node && node.closest && node.closest(".ee-editable");
      } catch (e) { ed = null; }
    }
    if (!ed) ed = selectionEditable();
    if (!ed && state.page && state.page.el) ed = state.page.el;
    if (!ed) {
      ed = document.querySelector("main.ee-editable, .ee-editable:not(.art-title .ee-editable)");
    }
    if (ed && ed.focus) {
      try { ed.focus({ preventScroll: true }); } catch (e2) { try { ed.focus(); } catch (e3) {} }
    }
    if (savedStyleRange) {
      try {
        var sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(savedStyleRange);
      } catch (e4) {}
    }
    return !!selectionEditable() || !!(ed && ed.isContentEditable);
  }
  function runStyleCommand(fn) {
    restoreStyleRange();
    try { fn(); } catch (e) {}
    captureStyleRange();
  }
  function ensureStyleBar() {
    if (!state.editing) { removeStyleBar(); return; }
    var b = $("ee-stylebar");
    if (!b) {
      b = el("div", { id: "ee-stylebar", role: "toolbar", "aria-label": "Text style" });
      document.body.appendChild(b);
      b.addEventListener("mousedown", function (e) {
        captureStyleRange();
        // Buttons: preventDefault keeps the caret. Native <select> must NOT
        // get preventDefault or the dropdown never opens (looked like a dead toolbar).
        if (e.target.closest && e.target.closest("button")) e.preventDefault();
      });
      b.addEventListener("focusin", function () { captureStyleRange(); });
    }
    b.innerHTML =
      '<select id="ee-font" aria-label="Font" title="Font">' +
        '<option value="" hidden selected>Font</option>' +
        '<option value="default">Default font</option>' +
        '<option value="serif">Serif \u2014 Iowan Old Style</option>' +
        '<option value="sans">Sans-serif \u2014 Helvetica Neue</option>' +
      '</select>' +
      '<select id="ee-size" aria-label="Size" title="Size">' +
        '<option value="" hidden selected>Size</option>' +
        '<option value="default">Default (match paragraph)</option>' +
        STYLE_SIZES.map(function (z) { return '<option value="' + z.id + '">' + z.label + '</option>'; }).join("") +
      '</select>' +
      '<select id="ee-block" aria-label="Block style" title="Block">' +
        '<option value="" hidden selected>Block</option>' +
        '<option value="p">Paragraph</option>' +
        '<option value="h2">Heading</option>' +
        '<option value="h3">Subheading</option>' +
        '<option value="cap">Caption</option>' +
      '</select>' +
      '<button type="button" class="ee-glyph-btn" id="ee-bold" title="Bold" aria-label="Bold"><b>B</b></button>' +
      '<button type="button" class="ee-glyph-btn" id="ee-italic" title="Italic" aria-label="Italic"><i>I</i></button>' +
      '<button type="button" class="ee-glyph-btn" id="ee-link" title="Link" aria-label="Link">↗</button>' +
      (state.page
        ? '<span class="ee-al-group" role="group" aria-label="Alignment">' +
          ALIGNS.map(function (a) {
            return '<button type="button" class="ee-glyph-btn ee-al-btn" id="ee-al-' + a + '" data-al="' + a + '" title="' + ALIGN_TITLES[a] + '" aria-label="' + ALIGN_TITLES[a] + '" aria-pressed="false">' + alignSvg(a) + '</button>';
          }).join("") +
          '<button type="button" class="ee-glyph-btn ee-al-btn" id="ee-al-cycle" title="Alignment: left (tap for center)" aria-label="Alignment: left">' + alignSvg("left") + '</button>' +
          '</span>'
        : '');
    $("ee-font").onchange = function () {
      var v = this.value; this.selectedIndex = 0;
      runStyleCommand(function () { applyFont(v); });
    };
    $("ee-size").onchange = function () {
      var v = this.value; this.selectedIndex = 0;
      runStyleCommand(function () { applySize(v); });
    };
    $("ee-block").onchange = function () {
      var v = this.value; this.selectedIndex = 0;
      runStyleCommand(function () { applyBlockStyle(v); });
    };
    $("ee-bold").onclick = function () {
      runStyleCommand(function () { document.execCommand("bold", false, null); });
    };
    $("ee-italic").onclick = function () {
      runStyleCommand(function () { document.execCommand("italic", false, null); });
    };
    Array.prototype.forEach.call(b.querySelectorAll("[data-al]"), function (btn) {
      btn.onclick = function () { runStyleCommand(function () { applyAlign(btn.getAttribute("data-al")); }); };
    });
    if ($("ee-al-cycle")) $("ee-al-cycle").onclick = function () {
      runStyleCommand(function () { applyAlign(ALIGNS[(ALIGNS.indexOf(currentAlign()) + 1) % 3]); });
    };
    $("ee-link").onclick = function () {
      runStyleCommand(function () {
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
      });
    };
    positionStyleBar();
  }
  function removeStyleBar() {
    var b = $("ee-stylebar");
    if (b) b.remove();
    savedStyleRange = null;
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
    dockSync();
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
  /* Style families. A family is a set of mutually exclusive classes (sizes, fonts,
     caption). Applying one first removes every class/span of the same family inside
     the target, so sizes never stack. Whole paragraphs (caret, whole-block or
     multi-block selections) get the class on the block itself, so the line box
     (line-height strut) shrinks with the text. */
  var FAMILIES = {
    size: { re: /^ee-(pt-\d+|size-(sm|md|lg))$/, valid: /^(10|11|12|14|16|18|20|24)$/, cls: function (v) { return "ee-pt-" + v; } },
    font: { re: /^ee-(serif|sans)$/, valid: /^(serif|sans)$/, cls: function (v) { return "ee-" + v; } },
    cap: { re: /^ee-caption$/, valid: /^cap$/, cls: function () { return "ee-caption"; }, toggle: true },
    head: { re: /^ee-(h2|h3|caption)$/, valid: /^(h2|h3|cap)$/, cls: function (v) { return v === "cap" ? "ee-caption" : "ee-" + v; } },
    // Alignment is always a whole-block class (never an inline span). Left is the default:
    // the class is dropped, unless the block is centred by the page itself.
    align: { re: /^ee-al-(left|center|right)$/, valid: /^(left|center|right)$/, cls: function (v) { return "ee-al-" + v; }, block: true,
      post: function (b) {
        if (!b.classList.contains("ee-al-left")) return;
        b.classList.remove("ee-al-left");
        var ta = getComputedStyle(b).textAlign;
        if (ta === "center" || ta === "right" || ta === "end" || ta === "justify") b.classList.add("ee-al-left");
        if (!b.classList.length) b.removeAttribute("class");
      } }
  };
  var ALIGNS = ["left", "center", "right"];
  var ALIGN_TITLES = { left: "Align left (Ctrl+Shift+L)", center: "Center (Ctrl+Shift+E)", right: "Align right (Ctrl+Shift+R)" };
  function alignSvg(a) {
    var L = { left: [[1, 13], [1, 9], [1, 11]], center: [[1, 13], [3, 11], [2, 12]], right: [[1, 13], [5, 13], [3, 13]] }[a];
    return '<svg viewBox="0 0 14 12" aria-hidden="true">' + L.map(function (x, i) {
      return '<path d="M' + x[0] + ' ' + (2 + i * 4) + 'H' + x[1] + '" stroke="currentColor" stroke-width="1" stroke-linecap="round" vector-effect="non-scaling-stroke"/>';
    }).join("") + '</svg>';
  }
  var AL_SEL = "p,h1,h2,h3,h4,h5,h6,li,dd,dt,figcaption,blockquote";
  function alignOfBlock(b) {
    if (!b) return "left";
    if (b.classList.contains("ee-al-center")) return "center";
    if (b.classList.contains("ee-al-right")) return "right";
    if (b.classList.contains("ee-al-left")) return "left";
    var ta = getComputedStyle(b).textAlign;
    return ta === "center" ? "center" : (ta === "right" || ta === "end") ? "right" : "left";
  }
  function currentAlign() {
    var root = state.page && state.page.el, n = selNode();
    return alignOfBlock(root && n ? leafOf(n, root) : null);
  }
  function applyAlign(v) {
    if (!state.page || ALIGNS.indexOf(v) < 0) return;
    applyFamily("align", v);
    syncAlignButtons();
  }
  function syncAlignButtons() {
    var bar = $("ee-stylebar");
    if (!bar || !state.page) return;
    var a = currentAlign();
    ALIGNS.forEach(function (x) { var btn = $("ee-al-" + x); if (btn) btn.setAttribute("aria-pressed", x === a ? "true" : "false"); });
    var cyc = $("ee-al-cycle");
    if (cyc && cyc.getAttribute("data-cur") !== a) {
      var next = ALIGNS[(ALIGNS.indexOf(a) + 1) % 3];
      cyc.setAttribute("data-cur", a);
      cyc.innerHTML = alignSvg(a);
      cyc.title = "Alignment: " + a + " (tap for " + next + ")";
      cyc.setAttribute("aria-label", "Alignment: " + a);
    }
  }
  var LEAF_SEL = "p,li,h1,h2,h3,h4,h5,h6,dd,dt,figcaption,blockquote,div";
  var BLOCKISH_SEL = LEAF_SEL + ",section,ul,ol,dl,figure,table,header,article";
  function isLeafBlock(n) { return n && n.nodeType === 1 && n.matches(LEAF_SEL) && !n.querySelector(BLOCKISH_SEL); }
  function leafOf(node, root) {
    var n = node && (node.nodeType === 1 ? node : node.parentNode);
    while (n && n !== root && root.contains(n)) {
      if (isLeafBlock(n)) return n;
      n = n.parentNode;
    }
    return null;
  }
  function blockUsable(b) { return b && !b.closest(".ee-locked,[contenteditable=\"false\"]") && !isTitleField(b); }
  function hasContent(r) {
    if (/\S/.test(r.toString())) return true;
    var f = r.cloneContents();
    return !!(f.querySelector && f.querySelector("img,br"));
  }
  function targetBlocks(range, root) {
    if (!state.page) return root ? [root] : [];
    if (range.collapsed) { var one = leafOf(range.startContainer, root); return blockUsable(one) ? [one] : []; }
    var out = [];
    var all = root.querySelectorAll(LEAF_SEL);
    for (var i = 0; i < all.length; i++) {
      var b = all[i];
      if (!isLeafBlock(b) || !blockUsable(b) || !range.intersectsNode(b)) continue;
      var r = document.createRange(); r.selectNodeContents(b);
      if (range.compareBoundaryPoints(Range.START_TO_START, r) > 0) r.setStart(range.startContainer, range.startOffset);
      if (range.compareBoundaryPoints(Range.END_TO_END, r) < 0) r.setEnd(range.endContainer, range.endOffset);
      if (hasContent(r)) out.push(b);
    }
    if (!out.length) { var s1 = leafOf(range.startContainer, root); if (blockUsable(s1)) out.push(s1); }
    return out;
  }
  function coversBlock(range, b) {
    var before = document.createRange(), after = document.createRange();
    try {
      before.setStart(b, 0); before.setEnd(range.startContainer, range.startOffset);
      after.setStart(range.endContainer, range.endOffset); after.setEnd(b, b.childNodes.length);
    } catch (e) { return false; }
    return !/\S/.test(before.toString()) && !/\S/.test(after.toString());
  }
  function textOffset(block, node, off) {
    var r = document.createRange();
    try { r.setStart(block, 0); r.setEnd(node, off); } catch (e) { return 0; }
    return r.toString().length;
  }
  function pointAt(block, n) {
    var w = document.createTreeWalker(block, NodeFilter.SHOW_TEXT, null), t, last = null;
    while ((t = w.nextNode())) {
      if (n <= t.nodeValue.length) return { node: t, off: n };
      n -= t.nodeValue.length; last = t;
    }
    return last ? { node: last, off: last.nodeValue.length } : { node: block, off: block.childNodes.length };
  }
  function stripFamily(n, re) {
    var cl = (n.getAttribute("class") || "").split(/\s+/).filter(Boolean);
    var keep = cl.filter(function (c) { return !re.test(c); });
    if (keep.length === cl.length) return false;
    if (keep.length) n.setAttribute("class", keep.join(" ")); else n.removeAttribute("class");
    return true;
  }
  function unwrapIfBare(sp) {
    if (sp.tagName !== "SPAN" || sp.attributes.length) return;
    while (sp.firstChild) sp.parentNode.insertBefore(sp.firstChild, sp);
    sp.remove();
  }
  function clearFamilyIn(container, re) {
    Array.prototype.slice.call(container.querySelectorAll("[class]")).forEach(function (n) {
      if (stripFamily(n, re)) unwrapIfBare(n);
    });
  }
  function famAncestors(node, block, re) {
    var out = [], n = node.parentNode;
    while (n && n !== block) {
      if (n.nodeType === 1 && (n.getAttribute("class") || "").split(/\s+/).some(function (c) { return re.test(c); })) out.push(n);
      n = n.parentNode;
    }
    return out;
  }
  function splitOut(anc, marker, side) {
    var r = document.createRange();
    if (side === "before") { r.setStart(anc, 0); r.setEndBefore(marker); }
    else { r.setStartAfter(marker); r.setEnd(anc, anc.childNodes.length); }
    if (r.collapsed) return;
    var frag = r.extractContents();
    if (!frag.textContent && !(frag.querySelector && frag.querySelector("img,br"))) return;
    var clone = anc.cloneNode(false);
    clone.appendChild(frag);
    anc.parentNode.insertBefore(clone, side === "before" ? anc : anc.nextSibling);
  }
  function dropEmptyFamilySpans(block, re) {
    Array.prototype.slice.call(block.querySelectorAll("span")).forEach(function (sp) {
      if (sp.textContent || sp.querySelector("img,br")) return;
      if (!sp.hasAttribute("class") || (sp.getAttribute("class") || "").split(/\s+/).some(function (c) { return re.test(c); })) sp.remove();
    });
  }
  function selectBetween(a, b) {
    var sel = window.getSelection(), r = document.createRange();
    r.setStartAfter(a); r.setEndBefore(b);
    sel.removeAllRanges(); sel.addRange(r);
  }
  // Partial selection inside one block: split same-family spans at the selection
  // edges, clear the family inside, then wrap (or leave bare for Default).
  function wrapPartial(range, block, re, cls) {
    var sm = document.createElement("span"), em = document.createElement("span");
    sm.setAttribute("data-ee-mark", "s"); em.setAttribute("data-ee-mark", "e");
    var re2 = range.cloneRange(); re2.collapse(false); re2.insertNode(em);
    var rs = range.cloneRange(); rs.collapse(true); rs.insertNode(sm);
    var anc = famAncestors(sm, block, re).concat(famAncestors(em, block, re)).filter(function (n, i, a) { return a.indexOf(n) === i; });
    famAncestors(sm, block, re).forEach(function (A) { splitOut(A, sm, "before"); });
    famAncestors(em, block, re).forEach(function (A) { splitOut(A, em, "after"); });
    anc.forEach(function (A) { if (stripFamily(A, re)) unwrapIfBare(A); });
    var mid = document.createRange();
    mid.setStartAfter(sm); mid.setEndBefore(em);
    var frag = mid.extractContents();
    var holder = document.createElement("div"); holder.appendChild(frag);
    clearFamilyIn(holder, re);
    var wrap;
    if (cls) {
      wrap = document.createElement("span"); wrap.className = cls;
      while (holder.firstChild) wrap.appendChild(holder.firstChild);
      mid.insertNode(wrap);
    } else {
      var f2 = document.createDocumentFragment();
      while (holder.firstChild) f2.appendChild(holder.firstChild);
      mid.insertNode(f2);
    }
    // Reselect what was styled, then drop the markers.
    var startOff = textOffset(block, sm, 0), endOff = textOffset(block, em, 0);
    sm.remove(); em.remove();
    dropEmptyFamilySpans(block, re);
    block.normalize();
    var p1 = pointAt(block, startOff), p2 = pointAt(block, endOff);
    try {
      var r = document.createRange(); r.setStart(p1.node, p1.off); r.setEnd(p2.node, p2.off);
      var sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r);
    } catch (e) {}
  }
  var styleUndo = [], styleRedo = [];
  function snapBlock(b) { return { el: b, html: b.innerHTML, cls: b.getAttribute("class") }; }
  function blockMatches(b, html, cls) { return b.isConnected && b.innerHTML === html && b.getAttribute("class") === cls; }
  function setBlock(b, html, cls) { b.innerHTML = html; if (cls == null) b.removeAttribute("class"); else b.setAttribute("class", cls); }
  function applyFamily(fam, value) {
    var F = FAMILIES[fam];
    if (!F) return;
    if (value && !F.valid.test(value)) return;
    var cls = value ? F.cls(value) : "";
    var sel = window.getSelection && window.getSelection();
    if (!sel || !sel.rangeCount) return;
    var range = sel.getRangeAt(0);
    var root = state.page ? state.page.el : selectionEditable();
    if (!root || !root.contains(range.commonAncestorContainer)) return;
    var blocks = targetBlocks(range, root);
    if (!blocks.length) return;
    var before = blocks.map(snapBlock);
    var whole = F.block || range.collapsed || blocks.length > 1 || coversBlock(range, blocks[0]);
    if (whole) {
      if (F.toggle && blocks.every(function (b) { return b.classList.contains(cls); })) cls = "";
      var first = blocks[0], last = blocks[blocks.length - 1];
      var so = textOffset(first, range.startContainer, range.startOffset);
      var eo = textOffset(last, range.endContainer, range.endOffset);
      blocks.forEach(function (b) {
        if (state.page) stripFamily(b, F.re);
        clearFamilyIn(b, F.re);
        if (cls) {
          if (state.page) b.classList.add(cls);
          else {
            var sp = document.createElement("span"); sp.className = cls;
            while (b.firstChild) sp.appendChild(b.firstChild);
            b.appendChild(sp);
          }
        }
        if (F.post) F.post(b);
        b.normalize();
      });
      try {
        var p1 = pointAt(first, so), p2 = pointAt(last, eo);
        var r = document.createRange(); r.setStart(p1.node, p1.off); r.setEnd(p2.node, p2.off);
        sel.removeAllRanges(); sel.addRange(r);
      } catch (e) {}
    } else {
      wrapPartial(range, blocks[0], F.re, cls);
    }
    var entry = before.map(function (s) { return { el: s.el, html: s.html, cls: s.cls, html2: s.el.innerHTML, cls2: s.el.getAttribute("class") }; })
      .filter(function (x) { return x.html !== x.html2 || x.cls !== x.cls2; });
    if (entry.length) {
      styleUndo.push(entry); if (styleUndo.length > 60) styleUndo.shift();
      styleRedo = [];
      markDirty();
    }
    captureStyleRange();
  }
  // Ctrl+Z / Ctrl+Shift+Z for style changes: only when the blocks still look exactly
  // like right after the change; otherwise the browser's own undo runs.
  function styleUndoKey(e) {
    if (!(e.ctrlKey || e.metaKey) || e.altKey) return false;
    var k = (e.key || "").toLowerCase();
    var redo = (k === "z" && e.shiftKey) || (k === "y" && !e.shiftKey);
    var undo = k === "z" && !e.shiftKey;
    if (!undo && !redo) return false;
    var stack = undo ? styleUndo : styleRedo;
    var top = stack[stack.length - 1];
    if (!top) return false;
    if (top.custom) {
      // pf1: a formatted paste (blocks inserted / split by hand, not by execCommand).
      if (!(undo ? top.custom.canUndo() : top.custom.canRedo())) return false;
      e.preventDefault();
      stack.pop();
      if (undo) top.custom.undo(); else top.custom.redo();
      (undo ? styleRedo : styleUndo).push(top);
      markDirty();
      return true;
    }
    var ok = top.every(function (x) { return undo ? blockMatches(x.el, x.html2, x.cls2) : blockMatches(x.el, x.html, x.cls); });
    if (!ok) return false;
    e.preventDefault();
    stack.pop();
    top.forEach(function (x) { if (undo) setBlock(x.el, x.html, x.cls); else setBlock(x.el, x.html2, x.cls2); });
    (undo ? styleRedo : styleUndo).push(top);
    try {
      var r = document.createRange(); r.selectNodeContents(top[0].el); r.collapse(false);
      var sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r);
    } catch (e2) {}
    markDirty();
    return true;
  }
  function applyFont(id) {
    if (!id) return;
    applyFamily("font", id === "default" ? "" : id);
  }
  function applySize(id) {
    if (!id) return;
    applyFamily("size", id === "default" ? "" : id);
  }
  function applyBlockStyle(id) {
    if (!id) return;
    if (state.page) {
      if (id === "cap") { applyFamily("cap", "cap"); return; }
      // Heading = the page's own section heading (h2), Subheading = h3; both take the
      // page's real heading styles. formatBlock keeps native undo but drops classes, so
      // paragraphs get their body class (art-life …) back and headings carry none.
      var tag = { p: "p", h2: "h2", h3: "h3" }[id];
      if (!tag) return;
      var sel = window.getSelection(), root = state.page.el;
      if (!sel || !sel.rangeCount || !root.contains(sel.getRangeAt(0).commonAncestorContainer)) return;
      var r0 = sel.getRangeAt(0);
      var blocks = targetBlocks(r0, root).filter(function (b) { return /^(P|H[1-6]|DIV)$/.test(b.tagName); });
      if (!blocks.length) return;
      var als = blocks.map(function (b) { return (b.className.match(/\bee-al-\w+/) || [""])[0]; });
      document.execCommand("formatBlock", false, tag);
      var r1 = sel.rangeCount ? sel.getRangeAt(0) : null;
      var after = r1 ? targetBlocks(r1, root) : [];
      after.forEach(fixBlockClass);
      // formatBlock drops classes: put each block's alignment back (same order).
      if (after.length === als.length) after.forEach(function (b, i) { if (als[i] && !b.classList.contains(als[i])) b.classList.add(als[i]); });
      var lf = leafOf(selNode(), root);
      if (lf) fixBlockClass(lf);
      markDirty();
      return;
    }
    applyFamily("head", id === "p" ? "" : id);
  }
  function onSelChange() {
    if (!state.editing) return;
    var b = $("ee-stylebar");
    if (!b) return;
    var ae = document.activeElement;
    var onBar = !!(ae && ae.closest && ae.closest("#ee-stylebar"));
    if (selectionEditable()) {
      captureStyleRange();
      b.hidden = false;
      syncAlignButtons();
    } else if (!onBar) {
      b.hidden = true;
    }
    positionStyleBar();
  }

  function jsonDoc(o) { var c = JSON.parse(JSON.stringify(o)); delete c.__sha; return JSON.stringify(c, null, 2) + "\n"; }
  function commitMsg(files, message) {
    return E.retrySave(function () { return E.commitFiles(files, message + " [edit-mode]", E.BRANCH); });
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
    // Plain secrets (everything but legacy encrypted ones): plain toggles, no key needed.
    var unlocked = !enc || !!(V.myKey.get() && V.myKey.get().person === "devin");
    var b = $("ee-body");
    var people = Object.keys(man.people || {}).filter(function (p) { return p !== "devin"; });
    var body;
    if (false) {
      body = '<p class="ee-note"><b>' + esc(sec.title) + '</b> is still plaintext (hidden only by CSS). Encrypt it to use real sharing toggles.</p>' +
        (unlocked
          ? '<div class="ee-row"><button type="button" class="ee-btn ee-primary" id="ee-share-encrypt">Encrypt</button></div>'
          : '<p class="ee-note">Unlock your secrets key first (passphrase below), then Encrypt.</p>');
    } else {
      var allowed = V.allowedList(sec);
      var boxes = '<label class="ee-tog"><input type="checkbox" id="ee-vis-everyone"' + (sec.everyone ? " checked" : "") + (!unlocked ? " disabled" : "") + '> Everyone</label>' +
        people.map(function (p) {
          var noKey = enc && !(man.people[p] && man.people[p].key);
          var on = allowed.indexOf(p) >= 0 || (!enc && p === sec.owner);
          return '<label class="ee-tog' + (noKey ? " ee-nokey" : "") + '"><input type="checkbox" data-vis-who="' + esc(p) + '"' +
            (on ? " checked" : "") + ((!unlocked || noKey || sec.everyone || (!enc && p === sec.owner)) ? " disabled" : "") + '> ' + esc(nameOfPerson(man, p)) +
            (noKey ? ' <span class="ee-sub">no key</span>' : "") + '</label>';
        }).join("");
      body = '<p class="ee-note"><b>' + esc(sec.title) + '</b>' + (enc ? ' · encrypted' + (unlocked ? "" : " · unlock your key to change sharing") : " · shown only to the people ticked (and you)") + '</p>' +
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
    var plain = sec.status !== "encrypted";
    (plain ? Promise.resolve(null) : currentSecretPayload(man, id, sec)).then(function (cur) {
      if (plain) { // visibility only: edit the lists, no keys
        if (who === "everyone") sec.everyone = on;
        else {
          var pa = V.allowedList(sec);
          if (on && pa.indexOf(who) < 0) pa.push(who);
          sec.allowed = on ? pa : pa.filter(function (p) { return p !== who || p === "devin" || p === sec.owner; });
        }
        return [];
      }
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
      '<select id="ee-owner-select" style="width:100%;margin-top:8px;background:#0b0b0b;color:#f3eee6;border:0;border-bottom:1px solid rgba(143,138,130,.28);padding:8px 0;font:calc(14px * var(--fs,1.5094)) Helvetica,Arial,sans-serif">' + opts + '</select>' +
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
        if (state.editing) editBar("Owner updated. Saved at " + new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) + ".", "ee-done");
        else doneBar("Owner updated. Saved at " + new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) + ".");
      })
      .catch(function (e) { fail(e.message || "Save failed."); });
  }


  function openArtPanel(opts) {
    // ic1: "Image" on the edit bar opens the same gallery in insert-only mode, for anyone who can
    // edit this page (players: gallery pictures they may use; upload only where they may upload).
    state.galInsertOnly = !!(opts && opts.insert);
    if (!Media) return;
    if (!P.isAdmin(state.profile) && !(state.galInsertOnly && state.editing && P.canEdit(state.profile, PATH))) return;
    openPanel();
    var p = $("ee-panel");
    if (p) {
      p.classList.add("ee-gal-mode");
      var box = p.querySelector(".ee-box");
      if (box) {
        box.classList.add("ee-wide");
        box.setAttribute("aria-label", "Art gallery");
      }
    }
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

  /* Art picker for other tools (the Index organizer's card art): the gallery to pick from, plus
     upload. opts: { title, note, onPick(entry), onFile(file) -> Promise<bool> }. */
  function loadCatalogForGallery() {
    var catP = E.getFile(Media.CATALOG).then(function (f) { return JSON.parse(f.text); }, function () { return { version: 1, media: {} }; });
    var assetsP = (E.listDir ? E.listDir(Media.ASSET_DIR) : Promise.reject(new Error("no listDir"))).then(function (entries) {
      return entries.filter(function (e) { return e.type === "file"; }).map(function (e) { return e.path; });
    }, function () { return []; });
    return Promise.all([catP, assetsP]).then(function (pair) {
      var cat = pair[0];
      if (pair[1] && pair[1].length) cat = Media.seedFromAssetPaths(cat, pair[1], { everyone: true, tags: ["site", "seed"] }).catalog;
      return cat;
    });
  }
  function openArtPicker(opts) {
    if (!Media) return;
    opts = opts || {};
    openPanel();
    var p = $("ee-panel");
    if (p) {
      p.classList.add("ee-gal-mode");
      var box = p.querySelector(".ee-box");
      if (box) { box.classList.add("ee-wide"); box.setAttribute("aria-label", opts.title || "Art"); }
    }
    var b = $("ee-body");
    b.innerHTML = '<p class="ee-k">' + esc(opts.title || "Art") + '</p>' +
      (opts.upload === false
        ? '<p class="ee-note">' + esc(opts.noUploadNote || "Uploading new pictures needs Devin; pick one from the gallery.") + '</p><p class="ee-err" id="ee-pick-err" hidden></p>'
        : '<form id="ee-pick-form" class="ee-gal-up ee-gal-first">' +
          '<p class="ee-sub">Upload new</p>' +
          fileButton("ee-pick-file") +
          '<p class="ee-note">' + esc(opts.note || "Nothing is published until you press Save.") + '</p>' +
          '<p class="ee-note">Big images are resized to ' + Media.MAX_EDGE + ' px on the long edge.</p>' +
          '<p class="ee-err" id="ee-pick-err" hidden></p></form>') +
      '<div class="ee-gal-head"><p class="ee-sub">Or pick from the gallery</p>' +
      '<input type="search" id="ee-pick-search" class="ee-field ee-gal-q" placeholder="Search by name or tag" autocomplete="off" spellcheck="false"></div>' +
      '<div id="ee-pick-wrap"><p class="ee-note">Loading gallery…</p></div>';
    var fileIn = $("ee-pick-file");
    bindFileButton(fileIn);
    if (fileIn) fileIn.onchange = function () {
      var f = fileIn.files && fileIn.files[0];
      if (!f) return;
      var err = $("ee-pick-err"); err.hidden = true;
      Promise.resolve(opts.onFile ? opts.onFile(f) : true).then(function (ok) {
        if (ok === false) { err.textContent = "That image could not be used (see the bar below)."; err.hidden = false; return; }
        closePanel();
      });
    };
    loadCatalogForGallery().then(function (catalog) {
      var all = Media.listVisible(catalog, opts.person || "devin", opts.person ? P.isAdmin(state.profile) : true);
      function grid(items) {
        if (!items.length) return '<p class="ee-note">No pictures yet.</p>';
        return '<div class="ee-gallery">' + items.map(function (m) {
          var thumb = window.eloraeImg
            ? window.eloraeImg.html(E.ROOT + m.path, { sizes: "(max-width: 800px) 180px, 240px", min: 160, max: 640, fallback: 320, lazy: true }, 'alt=""')
            : '<img src="' + esc(gallerySrc(m)) + '" alt="" loading="lazy">';
          return '<button type="button" class="ee-gal-item" data-pick-id="' + esc(m.id) + '" title="' + esc(m.title || m.id) + '">' + thumb + '<span>' + esc(m.title || m.id) + '</span></button>';
        }).join("") + '</div>';
      }
      function draw(items) {
        var w = $("ee-pick-wrap"); if (!w) return;
        w.innerHTML = grid(items);
        thumbFallback(w, catalog);
        Array.prototype.forEach.call(w.querySelectorAll("[data-pick-id]"), function (btn) {
          btn.onclick = function () {
            var entry = catalog.media[btn.getAttribute("data-pick-id")];
            if (!entry) return;
            closePanel();
            if (opts.onPick) opts.onPick(entry);
          };
        });
      }
      draw(all);
      var q = $("ee-pick-search");
      if (q) q.oninput = function () {
        var t = String(q.value || "").trim().toLowerCase();
        draw(all.filter(function (m) { return !t || [m.id, m.title, m.path].concat(m.tags || []).join(" ").toLowerCase().indexOf(t) >= 0; }));
      };
    });
  }

  /* Gallery manager (top-nav GALLERY, Devin only, any page, no edit mode): browse and search the
     art catalog, upload new art, rename, retag, set who may use it, remove it from the gallery.
     Every change is one commit of edit/media/catalog.json (+ the image for an upload), made on a
     fresh copy of the catalog and retried automatically when someone else saved meanwhile. */
  function openGalleryManager() {
    return profileReady.then(function () {
      if (!Media || !state.profile || !P.isAdmin(state.profile)) return false;
      openPanel();
      var p = $("ee-panel");
      p.classList.add("ee-gal-mode");
      var box = p.querySelector(".ee-box");
      if (box) { box.classList.add("ee-wide"); box.setAttribute("aria-label", "Gallery"); }
      var b = $("ee-body");
      b.innerHTML = '<p class="ee-k">Gallery</p><p class="ee-note">Loading gallery\u2026</p>';
      var catalog = null, q = "", sel = null, busy = false;
      function freshCatalog() {
        return E.getFile(Media.CATALOG).then(function (f) { return JSON.parse(f.text); }, function (err) { if (err && err.status === 404) return { version: 1, media: {} }; throw err; });
      }
      function commitCatalog(change, message, extraFiles) {
        return E.retrySave(function () {
          return freshCatalog().then(function (fresh) {
            var out = change(fresh);
            var files = [{ path: Media.CATALOG, text: JSON.stringify(out.catalog || out, null, 2) + "\n" }].concat(out.files || extraFiles || []);
            return E.commitFiles(files, message + " [edit-mode]", E.BRANCH).then(function () { return out.catalog || out; });
          });
        }, function (n) { say("Someone else saved at the same time \u2014 retrying (" + n + "/3)\u2026"); });
      }
      function say(m, bad) { var e = $("ee-galm-msg"); if (e) { e.textContent = m || ""; e.className = "ee-note" + (bad ? " ee-err" : ""); } }
      function people() { return Media.PEOPLE.filter(function (x) { return x !== "devin"; }); }
      function detailHtml(m) {
        if (!m) return '<p class="ee-note">Pick a picture to rename it, change its tags or who can use it, or remove it.</p>';
        var thumb = '<img src="' + esc(gallerySrc(m)) + '" alt="">';
        return '<div class="ee-galm-pic">' + thumb + '</div>' +
          '<p class="ee-sub">Title</p><input type="text" id="ee-galm-title" class="ee-field" value="' + esc(m.title || "") + '" autocomplete="off">' +
          '<p class="ee-sub">Tags</p><input type="text" id="ee-galm-tags" class="ee-field" value="' + esc((m.tags || []).join(", ")) + '" placeholder="comma-separated" autocomplete="off">' +
          '<p class="ee-sub">Who can use it in the editor</p>' +
          '<div class="ee-galm-who"><label class="ee-check"><input type="checkbox" id="ee-galm-everyone"' + (m.everyone ? " checked" : "") + '> Everyone</label>' +
          people().map(function (x) { return '<label class="ee-check"><input type="checkbox" data-galm-who="' + esc(x) + '"' + ((m.allowed || []).indexOf(x) >= 0 ? " checked" : "") + (m.everyone ? " disabled" : "") + '> ' + esc(x.charAt(0).toUpperCase() + x.slice(1)) + '</label>'; }).join("") + '</div>' +
          '<p class="ee-note">' + esc(m.path) + '</p>' +
          '<div class="ee-row"><button type="button" class="ee-btn ee-primary" id="ee-galm-save">Save</button>' +
          '<button type="button" class="ee-btn ee-danger" id="ee-galm-remove">Remove from gallery</button></div>';
      }
      function list() {
        var all = Media.listVisible(catalog, "devin", true);
        return all.filter(function (m) { return !q || [m.id, m.title, m.path].concat(m.tags || []).join(" ").toLowerCase().indexOf(q) >= 0; });
      }
      function drawGrid() {
        var w = $("ee-galm-wrap"); if (!w) return;
        var items = list();
        w.innerHTML = items.length ? '<div class="ee-gallery">' + items.map(function (m) {
          var thumb = window.eloraeImg
            ? window.eloraeImg.html(E.ROOT + m.path, { sizes: "(max-width: 800px) 180px, 240px", min: 160, max: 640, fallback: 320, lazy: true }, 'alt=""')
            : '<img src="' + esc(gallerySrc(m)) + '" alt="" loading="lazy">';
          return '<button type="button" class="ee-gal-item' + (sel === m.id ? " ee-on" : "") + '" data-gal-id="' + esc(m.id) + '" title="' + esc(m.title || m.id) + '">' + thumb + '<span>' + esc(m.title || m.id) + '</span></button>';
        }).join("") + '</div>' : '<p class="ee-note">' + (q ? "No matches." : "The gallery is empty. Upload the first picture above.") + '</p>';
        thumbFallback(w, catalog);
        Array.prototype.forEach.call(w.querySelectorAll("[data-gal-id]"), function (btn) {
          btn.onclick = function () {
            sel = btn.getAttribute("data-gal-id"); drawGrid(); drawDetail();
            if (window.matchMedia && matchMedia("(max-width: 800px)").matches) { var d = $("ee-galm-detail"); if (d) d.scrollIntoView({ block: "start", behavior: "smooth" }); }
          };
        });
      }
      function drawDetail() {
        var d = $("ee-galm-detail"); if (!d) return;
        var m = sel && catalog.media[sel] ? Object.assign({ id: sel }, catalog.media[sel]) : null;
        d.innerHTML = detailHtml(m);
        if (!m) return;
        var ev = $("ee-galm-everyone");
        ev.onchange = function () { Array.prototype.forEach.call(d.querySelectorAll("[data-galm-who]"), function (c) { c.disabled = ev.checked; }); };
        $("ee-galm-save").onclick = function () {
          if (busy) return; busy = true; say("Saving\u2026");
          var id = m.id, shown = catalog.media[id];
          var patch = { title: $("ee-galm-title").value.trim() || shown.title, tags: $("ee-galm-tags").value.split(",").map(function (t) { return t.trim(); }).filter(Boolean),
            everyone: ev.checked, allowed: Array.prototype.filter.call(d.querySelectorAll("[data-galm-who]"), function (c) { return c.checked; }).map(function (c) { return c.getAttribute("data-galm-who"); }) };
          commitCatalog(function (fresh) {
            fresh.media = fresh.media || {};
            if (!fresh.media[id]) fresh.media[id] = JSON.parse(JSON.stringify(shown)); // a picture only seeded from assets/
            return Media.setVisibility(fresh, id, patch);
          }, "Media: update " + id + " via gallery").then(function (next) {
            busy = false; catalog = mergeSeeded(next); say("Saved at " + new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) + "."); drawGrid(); drawDetail();
          }, function (err) { busy = false; say(err.message || "Save failed. Nothing was saved.", true); });
        };
        $("ee-galm-remove").onclick = function () {
          if (busy) return;
          if (!window.confirm("Remove \u201c" + (m.title || m.id) + "\u201d from the gallery? Pages that already show it keep it; the image file stays in assets/.")) return;
          busy = true; say("Removing\u2026");
          var id = m.id;
          commitCatalog(function (fresh) {
            fresh.media = fresh.media || {};
            delete fresh.media[id];
            fresh.hidden = (fresh.hidden || []).filter(function (x) { return x !== m.path; }).concat([m.path]); // keep a seeded assets/ file from coming back
            return fresh;
          }, "Media: remove " + id + " from the gallery").then(function (next) {
            busy = false; sel = null; catalog = mergeSeeded(next); say("Removed."); drawGrid(); drawDetail();
          }, function (err) { busy = false; say(err.message || "Remove failed. Nothing was changed.", true); });
        };
      }
      var assetPaths = [];
      function mergeSeeded(cat) {
        var hide = (cat && cat.hidden) || [];
        var paths = assetPaths.filter(function (x) { return hide.indexOf(x) < 0; });
        return paths.length ? Media.seedFromAssetPaths(cat, paths, { everyone: true, tags: ["site", "seed"] }).catalog : cat;
      }
      var assetsP = (E.listDir ? E.listDir(Media.ASSET_DIR) : Promise.resolve([])).then(function (es) { return es.filter(function (e) { return e.type === "file"; }).map(function (e) { return e.path; }); }, function () { return []; });
      return Promise.all([freshCatalog().catch(function () { return { version: 1, media: {} }; }), assetsP]).then(function (r) {
        assetPaths = r[1]; catalog = mergeSeeded(r[0]);
        b.innerHTML = '<p class="ee-k">Gallery</p>' +
          '<form id="ee-galm-up" class="ee-gal-up ee-gal-first"><p class="ee-sub">Add art</p>' +
          '<div class="ee-galm-uprow">' + fileButton("ee-galm-file") +
          '<input type="text" id="ee-galm-newtitle" class="ee-field" placeholder="Title (optional)" autocomplete="off">' +
          '<input type="text" id="ee-galm-newtags" class="ee-field" placeholder="Tags (comma-separated)" autocomplete="off">' +
          '<label class="ee-check"><input type="checkbox" id="ee-galm-neweveryone" checked> Everyone can use it</label>' +
          '<button type="submit" class="ee-btn ee-primary" id="ee-galm-upload">Upload</button></div>' +
          '<p class="ee-note">Goes to assets/ and the gallery right away (one commit). Big images are resized to ' + Media.MAX_EDGE + ' px on the long edge.</p></form>' +
          '<div class="ee-gal-head"><p class="ee-sub">All art</p><input type="search" id="ee-galm-search" class="ee-field ee-gal-q" placeholder="Search by name or tag" autocomplete="off" spellcheck="false"></div>' +
          '<p class="ee-note" id="ee-galm-msg" role="status"></p>' +
          '<div class="ee-galm-cols"><div id="ee-galm-wrap"></div><div id="ee-galm-detail" class="ee-galm-detail"></div></div>';
        bindFileButton($("ee-galm-file"));
        $("ee-galm-search").oninput = function () { q = String(this.value || "").trim().toLowerCase(); drawGrid(); };
        $("ee-galm-up").onsubmit = function (e) {
          e.preventDefault();
          var fi = $("ee-galm-file"), file = fi.files && fi.files[0];
          if (!file) { say("Choose an image first.", true); return; }
          if (busy) return; busy = true; say("Uploading\u2026");
          var title = $("ee-galm-newtitle").value.trim(), tags = $("ee-galm-newtags").value.split(",").map(function (t) { return t.trim(); }).filter(Boolean), every = $("ee-galm-neweveryone").checked;
          Media.validateFile(file).then(function (info) {
            var newId = null;
            return commitCatalog(function (fresh) {
              var prep = Media.prepareUpload(fresh, info, { title: title || info.name, tags: tags, owner: "devin", uploadedBy: "devin", everyone: every, allowed: every ? Media.PEOPLE.slice() : ["devin"] });
              newId = prep.id;
              return { catalog: prep.catalog, files: [prep.files[1]] };
            }, "Media: upload via gallery").then(function (next) { return { next: next, id: newId }; });
          }).then(function (r) {
            busy = false; catalog = mergeSeeded(r.next); sel = r.id; fi.value = ""; fi.dispatchEvent(new Event("change"));
            $("ee-galm-newtitle").value = ""; $("ee-galm-newtags").value = "";
            say("Uploaded. It shows on the site in about a minute."); drawGrid(); drawDetail();
          }, function (err) { busy = false; say(err.message || "Upload failed. Nothing was saved.", true); });
        };
        drawGrid(); drawDetail();
        return true;
      });
    });
  }

  /* Styled file picker (no raw "Choose file / No file chosen"): the real input stays in the form,
     visually hidden; the label is the button and shows the chosen file's name. */
  function fileButton(id) {
    return '<label class="ee-file"><input type="file" id="' + id + '" accept="image/png,image/jpeg,image/webp,image/gif">' +
      '<span class="ee-file-btn">Choose image</span><span class="ee-file-name" data-file-name>No image chosen</span></label>';
  }
  function bindFileButton(input) {
    if (!input) return;
    input.addEventListener("change", function () {
      var n = input.parentNode && input.parentNode.querySelector("[data-file-name]");
      if (n) n.textContent = input.files && input.files[0] ? input.files[0].name : "No image chosen";
    });
  }
  /* A picture uploaded a moment ago is in the repo but not on the site until it rebuilds (~1 min),
     so its thumbnail 404s: fall back to the repo's raw file, then to a quiet placeholder. */
  function thumbFallback(root, catalog) {
    Array.prototype.forEach.call(root.querySelectorAll(".ee-gal-item img"), function (im) {
      var btn = im.closest(".ee-gal-item"), id = btn && (btn.getAttribute("data-pick-id") || btn.getAttribute("data-gal-id"));
      var entry = id && catalog && catalog.media && catalog.media[id];
      function fail() {
        if (!entry || im.getAttribute("data-ee-raw")) { btn.classList.add("ee-gal-missing"); return; }
        im.setAttribute("data-ee-raw", "1");
        im.removeAttribute("srcset");
        im.src = "https://raw.githubusercontent.com/" + E.REPO + "/" + E.BRANCH + "/" + entry.path.split("/").map(encodeURIComponent).join("/");
      }
      im.addEventListener("error", fail);
      if (im.complete && im.naturalWidth === 0 && im.getAttribute("src")) fail();
    });
  }

  function gallerySrc(entry) {
    // Root-absolute (like the site's own /assets/ URLs), so both copies of a page agree.
    return new URL(E.ROOT).pathname + entry.path;
  }

  function renderGallery(catalog) {
    var b = $("ee-body");
    if (!b) return;
    var admin = P.isAdmin(state.profile);
    var allItems = Media.listVisible(catalog, admin ? "devin" : ((state.profile && state.profile.person) || ""), admin);
    var insertOnly = state.galInsertOnly || !admin;
    var hasHero = !insertOnly && !!document.querySelector(".art-hero img, section.art-hero");
    var canUp = admin || canUploadArt();
    var act = hasHero ? (state.galAct || "hero") : "insert";
    function matchItem(m, q) {
      if (!q) return true;
      var hay = [m.id, m.title, m.path].concat(Array.isArray(m.tags) ? m.tags : []).join(" ").toLowerCase();
      return hay.indexOf(q) >= 0;
    }
    function gridHtml(items) {
      if (!items.length) {
        return allItems.length
          ? '<p class="ee-note" id="ee-gal-empty">No matches.</p>'
          : '<p class="ee-note" id="ee-gal-empty">Catalog is empty. Upload below, or add images from the dashboard.</p>';
      }
      return '<div class="ee-gallery" id="ee-gal-grid">' + items.map(function (m) {
        var src = gallerySrc(m);
        /* img-resize: thumbnail sized to its ~120-240 x 96px cover box (/img.js); ~7:3 art. */
        var thumb = window.eloraeImg
          ? window.eloraeImg.html(E.ROOT + m.path, { sizes: "(max-width: 800px) 180px, 240px", min: 160, max: 640, fallback: 320, lazy: true }, 'alt=""')
          : '<img src="' + esc(src) + '" alt="">';
        return '<button type="button" class="ee-gal-item" data-gal-id="' + esc(m.id) + '" title="' + esc(m.title || m.id) + '">' +
          thumb +
          '<span>' + esc(m.title || m.id) + '</span></button>';
      }).join("") + '</div>';
    }
    function bindThumbs(root) {
      Array.prototype.forEach.call(root.querySelectorAll("[data-gal-id]"), function (btn) {
        btn.onclick = function () {
          var id = btn.getAttribute("data-gal-id");
          var entry = catalog.media[id];
          if (!entry) return;
          if (act === "hero") applyCatalogToHero(entry);
          else insertCatalogImage(entry);
        };
      });
    }
    b.innerHTML =
      '<p class="ee-k">' + (insertOnly ? "Insert image" : "Art") + '</p>' +
      (insertOnly ? '<p class="ee-note">Click a picture to insert it at the caret as a figure with a caption.</p>' : '') +
      (hasHero
        ? '<p class="ee-gal-act" role="radiogroup" aria-label="Click a picture to">' +
          '<label><input type="radio" name="ee-gal-act" value="hero"' + (act === "hero" ? " checked" : "") + '> Hero</label>' +
          '<label><input type="radio" name="ee-gal-act" value="insert"' + (act === "insert" ? " checked" : "") + '> Insert at caret</label></p>'
        : '') +
      '<p class="ee-note">Nothing is published until you press Save.</p>' +
      '<label class="ee-gal-search-label" for="ee-gal-search">Search</label>' +
      '<input type="search" id="ee-gal-search" class="ee-field ee-gal-q" placeholder="Search by name or tag" autocomplete="off" spellcheck="false">' +
      '<div id="ee-gal-wrap">' + gridHtml(allItems) + '</div>' +
      '<form id="ee-art-form" class="ee-gal-up"' + (canUp ? '' : ' hidden') + '>' +
      '<p class="ee-sub">Upload new</p>' +
      fileButton("ee-art-file") +
      '<input type="text" id="ee-art-title" class="ee-field" placeholder="Title (optional)" autocomplete="off">' +
      '<input type="text" id="ee-art-tags" class="ee-field" placeholder="Tags (comma-separated)" autocomplete="off">' +
      '<label class="ee-check"><input type="checkbox" id="ee-art-everyone" checked> Everyone can use in the editor</label>' +
      '<div class="ee-row"><button type="submit" class="ee-btn ee-primary" id="ee-art-up">' + (act === "hero" ? "Use as hero" : "Insert") + '</button>' +
      '<button type="button" class="ee-btn" id="ee-art-back">Back</button></div>' +
      '<p class="ee-err" id="ee-art-err" hidden></p></form>' +
      (canUp ? '' : '<div class="ee-row"><button type="button" class="ee-btn" id="ee-art-back2">Back</button></div><p class="ee-err" id="ee-art-err2" hidden></p>');
    $("ee-art-back").onclick = function () { closePanel(); };
    if ($("ee-art-back2")) $("ee-art-back2").onclick = function () { closePanel(); };
    Array.prototype.forEach.call(b.querySelectorAll('input[name="ee-gal-act"]'), function (r) {
      r.onchange = function () {
        act = state.galAct = r.value;
        $("ee-art-up").textContent = act === "hero" ? "Use as hero" : "Insert";
      };
    });
    $("ee-art-form").onsubmit = function (e) {
      e.preventDefault();
      replaceHeroImage(act);
    };
    bindThumbs(b);
    thumbFallback(b, catalog);
    bindFileButton($("ee-art-file"));
    var search = $("ee-gal-search");
    if (search) {
      search.oninput = function () {
        var q = String(search.value || "").trim().toLowerCase();
        var filtered = allItems.filter(function (m) { return matchItem(m, q); });
        var wrap = $("ee-gal-wrap");
        if (!wrap) return;
        wrap.innerHTML = gridHtml(filtered);
        bindThumbs(wrap);
        thumbFallback(wrap, catalog);
      };
      setTimeout(function () { try { search.focus(); } catch (e) {} }, 30);
    }
  }

  /* Hero art: a gallery pick (or a new upload) only previews on the page; it is written
     with the rest of the page when you press Save, and Cancel puts the old art back. */
  function heroImg() { return document.querySelector(".art-hero img"); }
  function heroSection() { var h = document.querySelector("section.art-hero"); return h && !h.closest("#ee-panel,#ee-bar") ? h : null; }
  function setHeroPreview(src, alt, pending) {
    var hero = heroImg(), created = false;
    if (!hero) {
      // A page without hero art yet ("no-art" hero, e.g. a new card's article): add one.
      var sec = heroSection();
      if (!sec) return false;
      hero = document.createElement("img");
      hero.setAttribute("alt", alt || "");
      sec.insertBefore(hero, sec.firstChild);
      sec.classList.remove("no-art");
      created = true;
    }
    if (!state.hero) {
      state.hero = { el: hero, orig: {}, created: created };
      ["src", "srcset", "sizes", "alt"].forEach(function (a) { state.hero.orig[a] = hero.getAttribute(a); });
      state.hero.oldKey = created ? null : imgKey(hero.getAttribute("data-eimg-orig") || hero.getAttribute("src"));
    }
    state.hero.src = src; state.hero.alt = alt || null; state.hero.pending = pending || null;
    hero.removeAttribute("srcset"); hero.removeAttribute("sizes");
    hero.setAttribute("src", pending ? pending.url : src);
    if (alt) hero.setAttribute("alt", alt);
    markDirty();
    return true;
  }
  function restoreHero() {
    var h = state.hero;
    if (!h) return;
    if (h.created) {
      var sec = h.el.closest("section.art-hero");
      h.el.remove();
      if (sec) sec.classList.add("no-art");
      state.hero = null;
      return;
    }
    ["src", "srcset", "sizes", "alt"].forEach(function (a) {
      if (h.orig[a] == null) h.el.removeAttribute(a); else h.el.setAttribute(a, h.orig[a]);
    });
    state.hero = null;
  }
  function applyCatalogToHero(entry) {
    if (state.arts && state.arts.list.length) { artsReplaceMain({ src: gallerySrc(entry), alt: entry.title || "" }); closePanel(); editBar("Main art replaced \u00b7 Save to publish it, Cancel to keep the old art"); return; }
    if (!setHeroPreview(gallerySrc(entry), entry.title || "")) return;
    closePanel();
    editBar("Hero preview \u00b7 Save to publish it, Cancel to keep the old art");
  }

  // Insert at the caret where it was before the gallery opened (not at the page end).
  function insertImageHtml(imgHtml) {
    if (!state.editing) return false;
    restoreStyleRange();
    var n = selNode();
    if (n && n.closest && n.closest(".ee-editable") && !isTitleField(n) && !n.closest(".ee-locked")) {
      document.execCommand("insertHTML", false, imgHtml);
      captureStyleRange();
      return true;
    }
    var first = (state.page && state.page.el) || document.querySelector(".ee-editable:not(.art-title .ee-editable)");
    if (first) { first.insertAdjacentHTML("beforeend", imgHtml); return true; }
    return false;
  }
  /* ---- ic1: pictures with captions ----
     A picture goes in as the site's own caption markup (as on the Journal pages):
     <figure><img src alt><figcaption>…</figcaption></figure>, as its own block after the
     paragraph holding the caret (or in place of an empty one), with the caret in the caption.
     An empty caption shows "Add a caption" only in edit mode (data-ee-empty, never saved) and is
     dropped on save; clicking a picture in edit mode offers Add caption / Remove caption. */
  var FLOW_BLOCK = /^(P|H[1-6]|BLOCKQUOTE|UL|OL|DL|FIGURE|PRE|TABLE|HR|DIV)$/;
  function flowBlockOf(n, root) {
    var b = null;
    for (var x = n; x && x !== root; x = x.parentElement) if (x.nodeType === 1 && FLOW_BLOCK.test(x.tagName)) b = x;
    // The outermost flow block under a section/main, not a <p> inside a blockquote's quote.
    return b;
  }
  function capMark(fc) {
    if (!fc) return;
    var empty = !norm(fc.textContent);
    if (empty) fc.setAttribute("data-ee-empty", ""); else fc.removeAttribute("data-ee-empty");
  }
  function capMarkAll() { var r = state.page && state.page.el; if (r) Array.prototype.forEach.call(r.querySelectorAll("figcaption"), capMark); }
  function caretInto(el, atEnd) {
    try {
      var r = document.createRange(); r.selectNodeContents(el); r.collapse(!atEnd);
      var s0 = window.getSelection(); s0.removeAllRanges(); s0.addRange(r); el.focus && state.page && state.page.el.focus({ preventScroll: true });
      s0.removeAllRanges(); s0.addRange(r);
    } catch (e) {}
  }
  function newFigure(imgHtml) {
    var f = document.createElement("figure");
    f.innerHTML = imgHtml + "<figcaption></figcaption>";
    capMark(f.querySelector("figcaption"));
    return f;
  }
  function insertFigure(imgHtml) {
    if (!state.editing || !state.page) return insertImageHtml(imgHtml);
    restoreStyleRange();
    var root = state.page.el, n = selNode(), fig = newFigure(imgHtml);
    var inPage = n && root.contains(n) && !isTitleField(n) && !(n.closest && n.closest(".ee-locked"));
    var blk = inPage ? flowBlockOf(n, root) : null;
    if (blk && blk.closest("figure") && blk.closest("figure") !== blk) blk = blk.closest("figure");
    if (blk) {
      var emptyP = blk.tagName === "P" && !norm(blk.textContent) && !blk.querySelector("img");
      if (emptyP) blk.parentNode.replaceChild(fig, blk);
      else blk.parentNode.insertBefore(fig, blk.nextSibling);
    } else {
      var host = (n && inPage && n.closest && n.closest("section, article")) || root.querySelector("#lore, .art-sec:last-of-type, section:last-of-type") || root;
      host.appendChild(fig);
    }
    caretInto(fig.querySelector("figcaption"));
    captureStyleRange();
    return true;
  }
  function addCaption(img) {
    var root = state.page && state.page.el;
    if (!root || !img || !root.contains(img)) return null;
    var fig = img.closest("figure");
    if (!fig || !root.contains(fig)) {
      fig = document.createElement("figure");
      var blk = flowBlockOf(img, root);
      var alone = blk && blk.tagName === "P" && !norm(blk.textContent) && blk.querySelectorAll("img").length === 1;
      if (alone) { blk.parentNode.replaceChild(fig, blk); fig.appendChild(img); }
      else if (blk) { blk.parentNode.insertBefore(fig, blk.nextSibling); fig.appendChild(img); }
      else { img.parentNode.insertBefore(fig, img); fig.appendChild(img); }
    }
    var fc = fig.querySelector("figcaption");
    if (!fc) { fc = document.createElement("figcaption"); fig.appendChild(fc); }
    capMark(fc); caretInto(fc, true); markDirty();
    return fc;
  }
  function removeCaption(img) {
    var fig = img && img.closest("figure"), fc = fig && fig.querySelector("figcaption");
    if (fc) { fc.remove(); markDirty(); }
  }
  function capToolsClose() { var t = $("ee-cap-tools"); if (t) t.remove(); }
  function capTools(img) {
    capToolsClose();
    var fig = img.closest("figure"), has = !!(fig && fig.querySelector("figcaption"));
    var t = document.createElement("div");
    t.id = "ee-cap-tools"; t.className = "ee-cap-tools"; t.setAttribute("data-ee-ui", "1"); t.setAttribute("contenteditable", "false");
    t.innerHTML = has ? '<button type="button" class="ee-btn" data-cap="rm">Remove caption</button>' : '<button type="button" class="ee-btn" data-cap="add">Add caption</button>';
    document.body.appendChild(t);
    var r = img.getBoundingClientRect();
    t.style.left = Math.round(Math.max(8, Math.min(window.innerWidth - t.offsetWidth - 8, r.left + 8))) + "px";
    t.style.top = Math.round(Math.max(8, r.top + 8)) + "px";
    t.addEventListener("mousedown", function (e) { e.preventDefault(); });
    t.addEventListener("click", function (e) {
      var b = e.target.closest("[data-cap]"); if (!b) return;
      e.preventDefault(); e.stopPropagation();
      if (b.getAttribute("data-cap") === "add") addCaption(img); else removeCaption(img);
      capToolsClose();
    });
  }
  function onCapClick(e) {
    if (!state.editing || !state.page) return;
    if (e.target.closest && e.target.closest("#ee-cap-tools")) return;
    var img = e.target.tagName === "IMG" ? e.target : null;
    if (img && state.page.el.contains(img) && !img.closest(".ee-locked, .art-hero")) { capTools(img); return; }
    capToolsClose();
  }
  function onCapInput() { capMarkAll(); }
  function capEnter() {
    var n = selNode(), fc = n && n.closest && n.closest("figcaption");
    if (!fc || !state.page || !state.page.el.contains(fc)) return false;
    // Enter in a caption: a new paragraph after the picture (captions stay one line).
    var fig = fc.closest("figure") || fc, p = document.createElement("p");
    p.appendChild(document.createElement("br"));
    fig.parentNode.insertBefore(p, fig.nextSibling);
    fixBlockClass(p);
    caretInto(p);
    markDirty();
    return true;
  }
  function insertCatalogImage(entry) {
    var rel = gallerySrc(entry);
    var imgHtml = '<img src="' + esc(rel) + '" alt="' + esc(entry.title || "") + '">';
    if (!insertFigure(imgHtml)) {
      var err = $("ee-art-err");
      if (err) { err.textContent = "Enter edit mode and place the caret where the image should go."; err.hidden = false; }
      return;
    }
    closePanel();
    markDirty();
    editBar("Image inserted \u00b7 Save to publish");
  }

  /* ---------------- Hero art set (the article's art switcher) ----------------
     Every article with a hero can hold several arts: the main one shows first (and is the Index
     card art); the others are reached with the switcher (art-swap.js). Edited from the "Arts"
     strip over the hero; written as the site's own switcher markup, in one commit with the
     uploads. Players: their own pages, gallery pictures only (uploads go to assets/, Devin's). */
  function artsAllowed() { return !!(Media && Media.heroParts && heroSection() && titlesAllowed() && state.base && state.base.text); }
  function canUploadArt() { return !!(Media && P.canEdit(state.profile, Media.ASSET_DIR + "/x.webp") && P.canEdit(state.profile, Media.CATALOG)); }
  function artSig(list, main) { return JSON.stringify([main, list.map(function (a) { return [a.src, a.alt, a.pending ? a.pending.key : ""]; })]); }
  function setupArts() {
    state.arts = null;
    if (!artsAllowed()) return;
    var parts = Media.heroParts(state.base.text);
    if (!parts) return;
    var list = parts.arts.map(function (a) { return { src: a.src, alt: a.alt, pos: a.pos, raw: a.raw, src0: a.src, alt0: a.alt, pending: null }; });
    state.arts = { list: list, main: parts.main, shown: parts.main, sig0: artSig(list, parts.main), main0Key: list[parts.main] ? imgKey(list[parts.main].src) : null, open: false };
  }
  function artsDirty() { var A = state.arts; return !!A && artSig(A.list, A.main) !== A.sig0; }
  function artUrl(a) { return a.pending ? a.pending.url : a.src; }
  function closeArts() {
    var b = $("ee-arts"); if (b) b.remove();
    document.documentElement.classList.remove("ee-arts-on");
    window.removeEventListener("resize", positionArts);
    window.removeEventListener("scroll", positionArts);
  }
  // Docked just above the edit bar (always in view while the hero art is being edited).
  function positionArts() {
    var box = $("ee-arts");
    if (!box) return;
    var b = $("ee-bar"), sb = $("ee-stylebar"), top = window.innerHeight;
    [b, sb].forEach(function (x) { if (x && x.getClientRects().length) { var r = x.getBoundingClientRect(); if (r.height && r.top < top && r.top > window.innerHeight / 2) top = r.top; } });
    box.style.bottom = Math.max(8, Math.round(window.innerHeight - top + 10)) + "px";
  }
  function renderArts() {
    var A = state.arts;
    if (!A || !A.open || !state.editing) { closeArts(); return; }
    var box = $("ee-arts");
    if (!box) {
      box = el("div", { id: "ee-arts", role: "region", "aria-label": "Arts", "data-ee-ui": "1" });
      document.body.appendChild(box);
      bindArtsBox(box);
      window.addEventListener("resize", positionArts);
      window.addEventListener("scroll", positionArts, { passive: true });
    }
    document.documentElement.classList.add("ee-arts-on");
    var n = A.list.length;
    box.innerHTML = '<div class="ee-arts-head"><span class="ee-arts-title">Arts \u00b7 ' + n + '</span>' +
      '<span class="ee-arts-hint">' + (n > 1 ? "Main shows first and is the Index card art. Drag or use \u2039 \u203a to reorder." : "Add a second art to give this page an art switcher.") + '</span>' +
      '<button type="button" class="ee-btn ee-primary" id="ee-arts-add">+ Add art</button>' +
      '<button type="button" class="ee-btn" id="ee-arts-close">Done</button></div>' +
      '<div class="ee-arts-list" role="list">' + A.list.map(function (a, i) {
        var main = i === A.main;
        return '<div class="ee-art-item' + (main ? " is-main" : "") + (i === A.shown ? " is-shown" : "") + '" role="listitem" draggable="true" data-i="' + i + '">' +
          '<button type="button" class="ee-art-thumb" data-act="show" aria-label="Show ' + esc(a.alt || "art " + (i + 1)) + ' in the hero"><img alt="" draggable="false"></button>' +
          (main ? '<span class="ee-art-badge">Main</span>' : '') +
          '<input type="text" class="ee-field ee-art-cap" data-act="cap" value="' + esc(a.alt || "") + '" aria-label="Caption" placeholder="Caption" autocomplete="off" spellcheck="true">' +
          '<div class="ee-art-row">' +
          '<button type="button" class="ee-btn ee-art-left" data-act="left" aria-label="Move earlier"' + (i === 0 ? " disabled" : "") + '>\u2039</button>' +
          '<button type="button" class="ee-btn ee-art-setmain" data-act="main" aria-pressed="' + (main ? "true" : "false") + '"' + (main ? " disabled" : "") + '>' + (main ? "Main" : "Set as main") + '</button>' +
          '<button type="button" class="ee-btn ee-art-right" data-act="right" aria-label="Move later"' + (i === n - 1 ? " disabled" : "") + '>\u203a</button>' +
          '<button type="button" class="ee-btn ee-art-del" data-act="del" aria-label="Remove ' + esc(a.alt || "this art") + '"' + (n < 2 ? " disabled" : "") + '>\u2715</button>' +
          '</div></div>';
      }).join("") + '</div>';
    Array.prototype.forEach.call(box.querySelectorAll(".ee-art-item"), function (it) {
      var a = A.list[+it.getAttribute("data-i")], im = it.querySelector(".ee-art-thumb img");
      if (!a || !im) return;
      var u = artUrl(a);
      if (!a.pending && Media.thumbHtml && /^\/?assets\//.test(String(u).replace(/^\//, ""))) {
        var m = /src="([^"]*)"/.exec(Media.thumbHtml(u));
        im.onerror = function () { im.onerror = null; im.src = u; };
        im.src = m ? m[1] : u;
      } else im.src = u;
    });
    positionArts();
  }
  function artsChanged(msg) {
    var A = state.arts;
    if (A.shown >= A.list.length) A.shown = A.main;
    previewArt(A.shown);
    renderArts();
    state.dirty = state.dirty || artsDirty();
    if (msg) editBar(msg);
  }
  function previewArt(i) {
    var A = state.arts, a = A && A.list[i];
    if (!a) return;
    var was = state.dirty;
    setHeroPreview(a.pending ? null : a.src, a.alt || "", a.pending || null);
    if (state.hero) state.hero.viaArts = true;
    state.dirty = was;
  }
  function artsMove(i, j) {
    var A = state.arts;
    if (!A || i === j || i < 0 || j < 0 || i >= A.list.length || j >= A.list.length) return;
    var mainIt = A.list[A.main], shownIt = A.list[A.shown];
    var it = A.list.splice(i, 1)[0];
    A.list.splice(j, 0, it);
    A.main = A.list.indexOf(mainIt); A.shown = A.list.indexOf(shownIt);
    artsChanged("Arts reordered \u00b7 Save to publish");
  }
  function artsSetMain(i) {
    var A = state.arts; if (!A || !A.list[i]) return;
    A.main = i; A.shown = i;
    artsChanged("Main art set \u00b7 Save to publish");
  }
  function artsRemove(i) {
    var A = state.arts; if (!A || A.list.length < 2 || !A.list[i]) return;
    if (!window.confirm("Remove \u201c" + (A.list[i].alt || "this art") + "\u201d from this page's arts? (The picture stays in the gallery.)")) return;
    var mainIt = A.list[A.main], shownIt = A.list[A.shown];
    A.list.splice(i, 1);
    A.main = A.list.indexOf(mainIt); if (A.main < 0) A.main = Math.min(i, A.list.length - 1);
    A.shown = A.list.indexOf(shownIt); if (A.shown < 0) A.shown = A.main;
    artsChanged(A.list.length > 1 ? "Art removed \u00b7 Save to publish" : "Art removed \u00b7 one art left, the switcher goes away when you Save");
  }
  function artsAdd(item) {
    var A = state.arts; if (!A) return;
    A.list.push(item);
    if (!A.list[A.main] || A.list.length === 1) A.main = 0;
    A.shown = A.list.length - 1;
    A.open = true;
    artsChanged("Added \u201c" + (item.alt || "art") + "\u201d \u00b7 Save to publish");
  }
  function artsReplaceMain(item) {
    var A = state.arts; if (!A) return;
    var cur = A.list[A.main];
    if (!cur) { artsAdd({ src: item.src, alt: item.alt || "", pending: item.pending || null, pos: null, raw: null, src0: null, alt0: null }); return; }
    cur.src = item.src; cur.pending = item.pending || null;
    if (item.alt) cur.alt = item.alt;
    cur.pos = null;
    A.shown = A.main;
    artsChanged();
  }
  function baseName(name) { return String(name || "").replace(/\.[^.\/]+$/, "").replace(/[_]+/g, " ").trim(); }
  function artsAddDialog() {
    var up = canUploadArt();
    openArtPicker({
      title: "Add art to this page", upload: up,
      person: (state.profile && state.profile.person) || "devin",
      note: "Added as the last art; captions can be changed in the Arts strip. Nothing is published until you press Save.",
      noUploadNote: "Uploading new pictures needs Devin; you can add any picture from the gallery.",
      onFile: function (f) {
        var nm = baseName(f.name) || "Art";
        return addPending(f, { title: nm, alt: nm, tags: ["art"], everyone: true }).then(function (pd) {
          artsAdd({ src: null, alt: nm, pending: pd, pos: null, raw: null, src0: null, alt0: null });
          return true;
        }, function (e) { editBar(e.message || "That image could not be used.", "ee-bad-bar"); return false; });
      },
      onPick: function (entry) {
        artsAdd({ src: gallerySrc(entry), alt: entry.title || baseName(String(entry.path).split("/").pop()), pending: null, pos: null, raw: null, src0: null, alt0: null });
      }
    });
  }
  function bindArtsBox(box) {
    var drag = -1;
    box.addEventListener("click", function (e) {
      var b = e.target.closest && e.target.closest("button");
      if (!b || !box.contains(b)) return;
      if (b.id === "ee-arts-add") { artsAddDialog(); return; }
      if (b.id === "ee-arts-close") { state.arts.open = false; renderArts(); editBar(); return; }
      var it = b.closest(".ee-art-item"); if (!it) return;
      var i = +it.getAttribute("data-i"), act = b.getAttribute("data-act");
      if (act === "show") { state.arts.shown = i; previewArt(i); renderArts(); }
      else if (act === "left") artsMove(i, i - 1);
      else if (act === "right") artsMove(i, i + 1);
      else if (act === "main") artsSetMain(i);
      else if (act === "del") artsRemove(i);
      var again = box.querySelector('.ee-art-item[data-i="' + Math.max(0, act === "left" ? i - 1 : act === "right" ? i + 1 : i) + '"] [data-act="' + act + '"]');
      if (again && !again.disabled && (act === "left" || act === "right")) again.focus();
    });
    box.addEventListener("input", function (e) {
      var t = e.target;
      if (!t.classList || !t.classList.contains("ee-art-cap")) return;
      var it = t.closest(".ee-art-item"), i = +it.getAttribute("data-i"), a = state.arts.list[i];
      if (!a) return;
      a.alt = t.value.replace(/\s+/g, " ").trim();
      if (state.arts.shown === i) { var h = heroImg(); if (h) h.setAttribute("alt", a.alt); if (state.hero) state.hero.alt = a.alt; }
      state.dirty = state.dirty || artsDirty();
    });
    box.addEventListener("keydown", function (e) {
      // Inside the strip the arrow keys move the caret / focus, never the page's switcher.
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") e.stopPropagation();
      if (e.key === "Enter" && e.target.classList && e.target.classList.contains("ee-art-cap")) { e.preventDefault(); e.target.blur(); }
    });
    box.addEventListener("dragstart", function (e) {
      var it = e.target.closest && e.target.closest(".ee-art-item");
      if (!it || (e.target.closest && e.target.closest("input"))) return;
      drag = +it.getAttribute("data-i");
      it.classList.add("is-dragging");
      try { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", "ee-art-" + drag); } catch (x) {}
    });
    function mark(e) {
      Array.prototype.forEach.call(box.querySelectorAll(".is-before,.is-after"), function (n) { n.classList.remove("is-before", "is-after"); });
      var it = e.target.closest && e.target.closest(".ee-art-item");
      if (!it) return null;
      var r = it.getBoundingClientRect(), after = e.clientX > r.left + r.width / 2;
      it.classList.add(after ? "is-after" : "is-before");
      return { i: +it.getAttribute("data-i"), after: after };
    }
    box.addEventListener("dragover", function (e) { if (drag < 0) return; e.preventDefault(); mark(e); });
    box.addEventListener("drop", function (e) {
      if (drag < 0) return;
      e.preventDefault();
      var t = mark(e), from = drag; drag = -1;
      if (!t) { renderArts(); return; }
      var to = t.i + (t.after ? 1 : 0);
      if (from < to) to--;
      if (to === from) { renderArts(); return; }
      artsMove(from, to);
    });
    box.addEventListener("dragend", function () { drag = -1; Array.prototype.forEach.call(box.querySelectorAll(".is-dragging,.is-before,.is-after"), function (n) { n.classList.remove("is-dragging", "is-before", "is-after"); }); });
  }
  /* After a save: the page's own switcher shows the saved set (new pictures from memory). */
  function refreshHeroDom(text) {
    var A = state.arts, hero = heroSection();
    if (!A || !hero || !Media.heroParts) return;
    var parts = Media.heroParts(text);
    if (!parts) return;
    var t = document.createElement("template");
    t.innerHTML = text.slice(parts.section.start, parts.section.end);
    var fresh = t.content.querySelector("section.art-hero");
    if (!fresh) return;
    hero.className = fresh.className;
    var old = hero.querySelector(":scope > .art-swap"), nu = fresh.querySelector(":scope > .art-swap");
    if (old) old.remove();
    var blobs = {};
    A.list.forEach(function (a) { if (a.blobUrl) blobs[imgKey(a.src)] = a.blobUrl; });
    if (nu) {
      Array.prototype.forEach.call(nu.querySelectorAll("button[data-src]"), function (b) {
        var u = blobs[imgKey(b.getAttribute("data-src"))];
        if (!u) return;
        b.setAttribute("data-src", u);
        var im = b.querySelector("img"); if (im) { im.removeAttribute("srcset"); im.setAttribute("src", u); }
      });
      hero.appendChild(nu);
    }
    var hi = heroImg(), m = A.list[A.main];
    if (hi && m) {
      hi.setAttribute("src", blobs[imgKey(m.src)] || m.src); hi.setAttribute("alt", m.alt || "");
      hi.removeAttribute("srcset"); hi.removeAttribute("sizes");
      if (blobs[imgKey(m.src)]) { hi.setAttribute("data-eimg-orig", m.src); hi.setAttribute("data-eimg-fell", "1"); }
    }
    if (nu) {
      if (window.EloraeArtSwap) window.EloraeArtSwap.init();
      else { var sc = document.createElement("script"); sc.src = "/art-swap.js?v=" + Media.ART_SWAP_V; document.body.appendChild(sc); }
    } else if (window.EloraeArtSwap) window.EloraeArtSwap.init();
  }

  /* A renamed hero (or new main art): the name / art written elsewhere follows in the same
     commit: the Index cards (every copy, both Index files) and their category-panel entries,
     the category rail and "related" lists of the other articles, the search index entry, and
     this page's <title>/og tags. Only files this profile may edit; the rest is reported. */
  function renameInfo() {
    var o = {};
    (state.titles || []).forEach(function (t) {
      var now = norm(t.el.textContent);
      if (t.kind === "h1") { o.oldName = t.text; o.newName = now || t.text; }
      if (t.kind === "epithet") { o.oldEpithet = t.text; o.newEpithet = now.replace(/\.\s*$/, ""); }
    });
    if (!o.oldName) { var h = document.querySelector(".art-title h1"); if (h) o.oldName = o.newName = norm(h.textContent); }
    o.renamed = !!(o.oldName && o.newName && o.oldName !== o.newName);
    o.epithet = o.oldEpithet != null && o.oldEpithet !== o.newEpithet;
    return o;
  }
  function articleSlugOfPath() { return (/^articles\/([^\/]+?)(?:\/index)?\.html$/.exec(PATH) || [])[1] || null; }
  function eachLimit(list, n, fn) {
    var i = 0, out = [];
    function next() { if (i >= list.length) return Promise.resolve(); var k = i++; return Promise.resolve(fn(list[k], k)).then(function (v) { out[k] = v; return next(); }); }
    var workers = []; for (var w = 0; w < Math.min(n, list.length); w++) workers.push(next());
    return Promise.all(workers).then(function () { return out; });
  }
  function syncOthers(ren, ref, skip) {
    var slug = articleSlugOfPath(), files = [], skipped = 0;
    if (!slug || !(ren.renamed || ren.newArt)) return Promise.resolve({ files: files, skipped: 0 });
    var tasks = [];
    if (ren.newArt || ren.renamed) tasks.push("search-index.js");
    var listP = ren.renamed && E.listDir ? E.listDir("articles", ref).then(function (es) {
      es.forEach(function (e) {
        if (e.type === "file" && /\.html$/.test(e.name)) tasks.push(e.path);
        else if (e.type === "dir") tasks.push(e.path + "/index.html");
      });
    }, function () {}) : Promise.resolve();
    return listP.then(function () {
      tasks = tasks.filter(function (p) { return skip.indexOf(p) < 0; });
      var mine = tasks.filter(function (p) { return P.canEdit(state.profile, p); });
      skipped = tasks.length - mine.length;
      if (mine.length > 8) editBar("Saving\u2026 updating the name on " + mine.length + " pages", "ee-busy");
      return eachLimit(mine, 6, function (p) {
        return E.getFile(p, ref).then(function (f) {
          var out = p === "search-index.js" ? Media.renameSearchEntry(f.text, slug, ren)
            : (ren.renamed && f.text.indexOf(slug) >= 0 ? Media.renameArticleLinks(f.text, slug, ren.oldName, ren.newName) : f.text);
          if (out !== f.text) files.push({ path: p, text: out, base: f.text });
        }, function () {});
      });
    }).then(function () { return { files: files, skipped: skipped }; });
  }

  /* Pending uploads: pasted / uploaded pictures show from memory (blob: URL) and are only
     committed, together with the page, when you press Save. */
  function addPending(file, meta) {
    if (!Media) return Promise.reject(new Error("Media helpers not loaded."));
    return Media.validateFile(file).then(function () {
      state.pendingSeq = (state.pendingSeq || 0) + 1;
      var key = "p" + state.pendingSeq;
      var url = URL.createObjectURL(file);
      state.pending = state.pending || {};
      state.pending[key] = { key: key, file: file, url: url, meta: meta || {} };
      return state.pending[key];
    });
  }
  function pendingImgHtml(pd) {
    return '<img src="' + esc(pd.url) + '" alt="' + esc(pd.meta.alt || "") + '" data-ee-pending="' + esc(pd.key) + '">';
  }
  function dropPending() {
    Object.keys(state.pending || {}).forEach(function (k) { try { URL.revokeObjectURL(state.pending[k].url); } catch (e) {} });
    state.pending = {};
  }
  // On Save: give every pending picture still on the page a real /assets/ path and
  // return the files to commit (images + one catalog update).
  function preparePending() {
    var used = [];
    var root = (state.page && state.page.el) || document;
    Array.prototype.forEach.call(root.querySelectorAll("img[data-ee-pending]"), function (im) {
      var pd = state.pending && state.pending[im.getAttribute("data-ee-pending")];
      if (pd) used.push({ pd: pd, img: im });
      else im.removeAttribute("data-ee-pending");
    });
    if (state.hero && state.hero.pending && !state.hero.viaArts) used.push({ pd: state.hero.pending, hero: true });
    if (state.arts && artsDirty()) state.arts.list.forEach(function (a) { if (a.pending) used.push({ pd: a.pending, art: a }); });
    if (!used.length) return Promise.resolve([]);
    var who = (state.profile && state.profile.person) || "devin";
    return E.getFile(Media.CATALOG).then(function (f) { return JSON.parse(f.text); }, function () { return { version: 1, media: {} }; }).then(function (catalog) {
      var bins = [], seq = Promise.resolve();
      used.forEach(function (u) {
        seq = seq.then(function () { return Media.validateFile(u.pd.file); }).then(function (info) {
          var m = u.pd.meta || {};
          var prep = Media.prepareUpload(catalog, info, {
            title: m.title || info.name, tags: m.tags || ["paste"], owner: who, uploadedBy: who,
            everyone: m.everyone !== false, allowed: m.everyone === false ? [who] : Media.PEOPLE.slice()
          });
          catalog = prep.catalog;
          bins.push(prep.files[1]);
          u.rel = gallerySrc(prep.entry);
          u.entry = prep.entry;
          u.blob = info.blob || u.pd.file;
        });
      });
      return seq.then(function () {
        return { files: [{ path: Media.CATALOG, text: JSON.stringify(catalog, null, 2) + "\n" }].concat(bins), used: used };
      });
    });
  }
  // Real paths for the save; returns an undo that puts the in-memory previews back
  // (the new files are not on the live site until Pages rebuilds).
  function applyPending(prep) {
    var back = [];
    (prep.used || []).forEach(function (u) {
      if (u.hero) { state.hero.src = u.rel; return; }
      if (u.art) { back.push([null, u.art, u.art.pending]); u.art.src = u.rel; u.art.pending = null; return; }
      back.push([u.img, u.img.getAttribute("src"), u.img.getAttribute("data-ee-pending")]);
      u.img.setAttribute("src", u.rel);
      u.img.removeAttribute("data-ee-pending");
    });
    return function () {
      back.forEach(function (b) {
        if (!b[0]) { b[1].pending = b[2]; b[1].src = null; return; }
        b[0].setAttribute("src", b[1]); b[0].setAttribute("data-ee-pending", b[2]);
      });
    };
  }

  function replaceHeroImage(mode) {
    mode = mode || (heroImg() ? "hero" : "insert");
    var file = $("ee-art-file").files[0];
    var err = $("ee-art-err");
    function fail(m) { err.textContent = m; err.hidden = false; }
    err.hidden = true;
    var title = ($("ee-art-title").value || "").trim();
    var tags = ($("ee-art-tags").value || "").split(",").map(function (t) { return t.trim(); }).filter(Boolean);
    var everyone = $("ee-art-everyone").checked;
    if (mode === "hero" && !heroImg() && !heroSection()) return fail("No hero on this page.");
    if (!file) return fail("No file chosen.");
    addPending(file, { title: title || file.name, alt: title, tags: tags, everyone: everyone }).then(function (pd) {
      if (mode === "hero" && state.arts && state.arts.list.length) {
        artsReplaceMain({ src: null, alt: title || null, pending: pd });
        closePanel();
        editBar("Main art replaced \u00b7 uploaded and published when you press Save");
        return;
      }
      if (mode === "hero") {
        setHeroPreview(null, title || null, pd);
        closePanel();
        editBar("Hero preview \u00b7 uploaded and published when you press Save");
        return;
      }
      if (!insertFigure(pendingImgHtml(pd))) throw new Error("Enter edit mode and place the caret where the image should go.");
      closePanel(); markDirty();
      editBar("Image inserted \u00b7 uploaded when you press Save");
    }).catch(function (e) { fail(e.message || "Upload failed."); });
  }

  function onKey(e) {
    if (!e.target.closest || !e.target.closest(".ee-editable")) return;
    if (styleUndoKey(e)) return;
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && !e.altKey && state.page) {
      var ak = { l: "left", e: "center", r: "right" }[(e.key || "").toLowerCase()];
      if (ak && !isTitleField(e.target) && !isTitleField(selNode())) { e.preventDefault(); applyAlign(ak); return; }
    }
    if (e.key === "Enter" && !e.isComposing) {
      e.preventDefault();
      // Name/epithet stay single-line (site header).
      if (isTitleField(e.target) || isTitleField(selNode())) return;
      if (state.page && dossierEnter(e)) return;
      if (state.page && capEnter()) return;
      if (!e.shiftKey && state.page && enterParagraph()) return;
      document.execCommand("insertLineBreak");
    }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") { e.preventDefault(); save(); }
  }
  function selNode() {
    var sel = window.getSelection && window.getSelection();
    var n = sel && sel.rangeCount ? sel.anchorNode : null;
    return n && (n.nodeType === 1 ? n : n.parentElement);
  }
  // Body class a paragraph should carry here (e.g. art-life), from its neighbours.
  var PARA_SKIP = /^(ee-|art-epithet$)/;
  function paraClassFor(block) {
    var parent = block && block.parentElement;
    if (!parent) return "";
    function clsOf(n) {
      return Array.prototype.filter.call(n.classList, function (c) { return !PARA_SKIP.test(c) && !RUNTIME_CLASS.test(c); }).join(" ");
    }
    var sib, c;
    for (sib = block.previousElementSibling; sib; sib = sib.previousElementSibling) if (sib.tagName === "P" && (c = clsOf(sib))) return c;
    for (sib = block.nextElementSibling; sib; sib = sib.nextElementSibling) if (sib.tagName === "P" && (c = clsOf(sib))) return c;
    if (document.body.classList.contains("article") && block.closest(".art-sec")) return "art-life";
    return "";
  }
  // A new/converted paragraph: body class like its neighbours; headings carry none.
  function fixBlockClass(b) {
    if (!b || !b.isConnected) return;
    if (b.tagName === "P") {
      var keep = Array.prototype.filter.call(b.classList, function (c) { return /^ee-(pt-|serif|sans|caption|al-)/.test(c); });
      var body = b.classList.length && Array.prototype.some.call(b.classList, function (c) { return !/^ee-/.test(c); });
      if (!body) {
        var pc = paraClassFor(b);
        var all = (pc ? pc.split(" ") : []).concat(keep);
        if (all.length) b.setAttribute("class", all.join(" ")); else b.removeAttribute("class");
      }
    } else if (/^H[1-6]$/.test(b.tagName)) {
      if (b.classList.contains("art-life")) b.classList.remove("art-life");
      if (!b.classList.length) b.removeAttribute("class");
    }
  }
  function dropDuplicateIds(root) {
    var seen = {};
    Array.prototype.forEach.call(root.querySelectorAll("[id]"), function (n) {
      if (seen[n.id]) n.removeAttribute("id"); else seen[n.id] = 1;
    });
  }
  // Enter in a paragraph, list item or heading: a real new block (native undo).
  // Chrome copies the class (good: p.art-life stays p.art-life) and the id (dropped here);
  // Enter at the end of a heading gives a plain paragraph, which gets the body class.
  function enterParagraph() {
    var root = state.page && state.page.el, n = selNode();
    if (!root || !n || !root.contains(n) || n.closest(".ee-locked,[contenteditable=\"false\"]")) return false;
    var leaf = leafOf(n, root);
    if (!leaf || !/^(P|LI|H[1-6])$/.test(leaf.tagName)) return false;
    if (!document.execCommand("insertParagraph")) return false;
    var nb = leafOf(selNode(), root);
    if (nb && nb !== leaf) {
      if (nb.id && nb.id === leaf.id) nb.removeAttribute("id");
      fixBlockClass(nb);
      // The new block keeps the alignment (Chrome copies the class from a paragraph,
      // not from a heading).
      var al = Array.prototype.filter.call(leaf.classList, function (c) { return /^ee-al-/.test(c); });
      if (al.length && !Array.prototype.some.call(nb.classList, function (c) { return /^ee-al-/.test(c); })) al.forEach(function (c) { nb.classList.add(c); });
    }
    markDirty();
    return true;
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
  /* Rich paste (Word, Google Docs, web pages): keep only the structure — paragraphs,
     headings, lists, bold, italic, links, pictures. Foreign classes, styles, fonts and
     spans are dropped, so pasted text takes the page's own look and never nests fonts. */
  function styleOf(n, prop) {
    var m = new RegExp("(?:^|;)\\s*" + prop + "\\s*:\\s*([^;]+)", "i").exec(n.getAttribute("style") || "");
    return m ? m[1].trim().toLowerCase() : "";
  }
  function pasteInline(src, dst, inB, inI) {
    Array.prototype.forEach.call(src.childNodes, function (ch) {
      if (ch.nodeType === 3) { dst.appendChild(document.createTextNode(ch.nodeValue.replace(/[\r\n]+/g, " "))); return; }
      if (ch.nodeType !== 1) return;
      var tag = ch.tagName.toLowerCase();
      if (DROP[tag] || tag === "title" || tag === "xml" || /:/.test(tag)) return;
      if (tag === "br") { dst.appendChild(document.createElement("br")); return; }
      if (tag === "img") {
        var srcAttr = safeSrc(ch.getAttribute("src") || ch.getAttribute("data-src"));
        if (!srcAttr) return;
        var im = document.createElement("img");
        im.setAttribute("src", srcAttr);
        if (ch.getAttribute("alt")) im.setAttribute("alt", ch.getAttribute("alt"));
        dst.appendChild(im);
        return;
      }
      var fw = styleOf(ch, "font-weight"), fs = styleOf(ch, "font-style");
      var bold = !inB && ((tag === "b" || tag === "strong") ? !/^(normal|[1-5]00|lighter)$/.test(fw) : /^(bold|bolder|[6-9]00)$/.test(fw));
      var ital = !inI && ((tag === "i" || tag === "em") ? fs !== "normal" : fs === "italic" || fs === "oblique");
      var into = dst;
      if (tag === "a") {
        var h = safeHref(ch.getAttribute("href"));
        if (h != null && !/^#/.test(h)) { var a = document.createElement("a"); a.setAttribute("href", h); into.appendChild(a); into = a; }
      } else if (tag === "sub" || tag === "sup") {
        var ss = document.createElement(tag); into.appendChild(ss); into = ss;
      }
      if (bold) { var st = document.createElement("strong"); into.appendChild(st); into = st; }
      if (ital) { var em = document.createElement("em"); into.appendChild(em); into = em; }
      pasteInline(ch, into, inB || bold, inI || ital);
    });
  }
  var PASTE_BLOCK = /^(p|div|section|article|header|footer|main|aside|blockquote|figure|figcaption|pre|table|thead|tbody|tfoot|tr|td|th|dl|dt|dd|center|address|nav|form|fieldset)$/;
  // Pasted HTML -> clean blocks: <p class=…>, <h2>/<h3>, <ul>/<ol><li>.
  function sanitizePasteBlocks(html, paraCls) {
    var wrap = document.createElement("div");
    wrap.innerHTML = String(html || "").replace(/<!--[\s\S]*?-->/g, "");
    var out = document.createElement("div"), cur = null, curAl = "";
    // Centred / right-aligned source blocks (text-align, align=, or our own ee-al-* class).
    function alignOf(n) {
      var m = /\bee-al-(left|center|right)\b/.exec(n.getAttribute("class") || "");
      var v = m ? m[1] : (styleOf(n, "text-align") || String(n.getAttribute("align") || "").toLowerCase());
      return v === "center" || v === "right" ? "ee-al-" + v : (v === "left" || v === "start" || v === "justify") ? "-" : "";
    }
    function withAl(cls) { return [cls, curAl && curAl !== "-" ? curAl : ""].filter(Boolean).join(" "); }
    function para() {
      if (!cur) { cur = document.createElement("p"); var c = withAl(paraCls); if (c) cur.className = c; out.appendChild(cur); }
      return cur;
    }
    function end() { cur = null; }
    function walk(src) {
      Array.prototype.forEach.call(src.childNodes, function (ch) {
        if (ch.nodeType === 3) { if (/\S/.test(ch.nodeValue) || cur) pasteInline({ childNodes: [ch] }, para()); return; }
        if (ch.nodeType !== 1) return;
        var tag = ch.tagName.toLowerCase();
        if (DROP[tag] || tag === "title" || tag === "xml" || tag === "head" || /:/.test(tag)) return;
        if (/^h[1-6]$/.test(tag)) {
          end();
          var h = document.createElement(/^h[12]$/.test(tag) ? "h2" : "h3");
          var hal = alignOf(ch) || curAl;
          if (hal && hal !== "-") h.className = hal;
          pasteInline(ch, h);
          if (/\S/.test(h.textContent)) out.appendChild(h);
          return;
        }
        if (tag === "ul" || tag === "ol") {
          end();
          var list = document.createElement(tag);
          (function items(l) {
            Array.prototype.forEach.call(l.childNodes, function (li) {
              if (li.nodeType === 1 && /^(ul|ol)$/.test(li.tagName.toLowerCase())) { items(li); return; }
              if (li.nodeType !== 1 && !(li.nodeType === 3 && /\S/.test(li.nodeValue))) return;
              var item = document.createElement("li");
              if (li.nodeType === 3) item.textContent = li.nodeValue.trim();
              else {
                var sub = Array.prototype.filter.call(li.childNodes, function (k) { return k.nodeType === 1 && /^(UL|OL)$/.test(k.tagName); });
                sub.forEach(function (k) { li.removeChild(k); });
                pasteInline(li, item);
                if (/\S/.test(item.textContent) || item.querySelector("img")) list.appendChild(item);
                sub.forEach(items);
                return;
              }
              if (/\S/.test(item.textContent)) list.appendChild(item);
            });
          })(ch);
          if (list.children.length) out.appendChild(list);
          return;
        }
        if (tag === "li") { end(); walk(ch); end(); return; }
        if (tag === "hr") { end(); return; }
        if (PASTE_BLOCK.test(tag)) {
          end();
          var prevAl = curAl; curAl = alignOf(ch) || prevAl;
          walk(ch); end();
          curAl = prevAl;
          return;
        }
        if (tag === "br") {
          // Two line breaks in a row = a paragraph break; one stays a line break.
          if (cur && cur.lastChild && cur.lastChild.nodeName === "BR") { cur.removeChild(cur.lastChild); end(); }
          else if (cur) cur.appendChild(document.createElement("br"));
          return;
        }
        pasteInline({ childNodes: [ch] }, para());
      });
    }
    walk(wrap);
    Array.prototype.slice.call(out.querySelectorAll("p,li,h2,h3")).forEach(function (b) {
      while (b.lastChild && (b.lastChild.nodeName === "BR" || (b.lastChild.nodeType === 3 && !/\S/.test(b.lastChild.nodeValue)))) b.removeChild(b.lastChild);
      if (b.firstChild && b.firstChild.nodeType === 3) b.firstChild.nodeValue = b.firstChild.nodeValue.replace(/^\s+/, "");
      if (!/\S/.test(b.textContent) && !b.querySelector("img")) b.remove();
    });
    Array.prototype.slice.call(out.querySelectorAll("strong,em,a")).forEach(function (n) { if (!n.textContent && !n.querySelector("img")) n.remove(); });
    return out;
  }
  // Inline-only version for a single block (per-block pages, lists, headings, titles).
  function sanitizePasteHtml(html) {
    var out = sanitizePasteBlocks(html, "");
    var parts = [];
    Array.prototype.forEach.call(out.children, function (b) {
      if (b.tagName === "UL" || b.tagName === "OL") Array.prototype.forEach.call(b.children, function (li) { parts.push("\u2022 " + li.innerHTML); });
      else parts.push(b.innerHTML);
    });
    return parts.join("<br>");
  }
  function insertAtCaret(html) {
    var n = selNode();
    if (n && state.editing && n.closest && n.closest(".ee-editable") && !isTitleField(n)) {
      document.execCommand("insertHTML", false, html);
      return true;
    }
    return insertImageHtml(html);
  }
  // After a block paste: tidy what Chrome produced around it (no style spans, no
  // duplicate ids, body class on new paragraphs).
  function tidyPasted(root, from, to) {
    if (!root) return;
    dropDuplicateIds(root);
    var all = Array.prototype.slice.call(root.querySelectorAll("p,li,h1,h2,h3,h4,h5,h6"));
    var i0 = from ? all.indexOf(from) : 0, i1 = to ? all.indexOf(to) : all.length - 1;
    if (i0 < 0) i0 = 0;
    if (i1 < 0) i1 = all.length - 1;
    all.slice(i0, i1 + 1).forEach(function (b) {
      if (b.closest(".ee-locked,[contenteditable=\"false\"]")) return;
      [b].concat(Array.prototype.slice.call(b.querySelectorAll("[style]"))).forEach(function (x) { x.removeAttribute("style"); });
      Array.prototype.slice.call(b.querySelectorAll("span:not([class]),font")).forEach(function (sp) {
        while (sp.firstChild) sp.parentNode.insertBefore(sp.firstChild, sp);
        sp.remove();
      });
      fixBlockClass(b);
    });
  }
  function dataUrlToFile(dataUrl, name) {
    var m = /^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i.exec(dataUrl || "");
    if (!m) return null;
    var bin = atob(m[2]), u8 = new Uint8Array(bin.length), i;
    for (i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    var mime = m[1].toLowerCase();
    try { return new File([u8], name || "paste.png", { type: mime }); }
    catch (e) { return null; }
  }
  // Pasted HTML with embedded (data:) pictures: hold them as pending uploads too.
  function pendDataImages(container) {
    var imgs = Array.prototype.slice.call(container.querySelectorAll("img"));
    var seq = Promise.resolve();
    imgs.forEach(function (im, idx) {
      var src = im.getAttribute("src") || "";
      if (!/^data:image\//i.test(src)) return;
      if (!Media || !P.isAdmin(state.profile)) { im.remove(); return; }
      seq = seq.then(function () {
        var file = dataUrlToFile(src, "paste-" + (idx + 1) + "." + ((/^data:image\/(\w+)/i.exec(src) || [0, "png"])[1].replace("jpeg", "jpg")));
        if (!file) { im.remove(); return; }
        return addPending(file, { title: im.getAttribute("alt") || file.name, alt: im.getAttribute("alt") || "", tags: ["paste"] }).then(function (pd) {
          im.setAttribute("src", pd.url);
          im.setAttribute("data-ee-pending", pd.key);
        }, function () { im.remove(); });
      });
    });
    return seq.then(function () { return container; });
  }
  /* pf1: copy / cut / paste INSIDE the editor keeps the site's own formatting.
     Copy writes text/html of the selection wrapped in its blocks (p.ee-pt-12, h2, figure…)
     with a data-ee-clip marker; paste of that (or of site HTML that carries our ee-* classes)
     keeps sizes, fonts, captions, alignment, headings, bold/italic/underline, links, line
     breaks and pictures. Pasted text keeps ITS OWN look: it never takes the size/style of the
     line it lands in (an incompatible block is split; a compatible line gets a classed span).
     Foreign HTML still goes through the plain structure-only cleanup above. */
  var PF_KEEP = /^ee-(pt-(10|11|12|14|16|18|20|24)|size-(sm|md|lg)|serif|sans|caption|al-(left|center|right)|h2|h3)$/;
  var PF_FAMS = [/^ee-(pt-\d+|size-(sm|md|lg))$/, /^ee-(serif|sans)$/, /^ee-caption$/, /^ee-h[23]$/];
  var PF_SITE = /\bdata-ee-clip=|class\s*=\s*["']?[^"'>]*\bee-(pt-\d+|serif|sans|caption|size-(sm|md|lg)|al-(center|right))\b/i;
  function pfClasses(n) { return n && n.classList ? Array.prototype.filter.call(n.classList, function (c) { return PF_KEEP.test(c); }) : []; }
  function pfFam(list, re) { for (var i = 0; i < list.length; i++) if (re.test(list[i])) return list[i]; return ""; }
  function pfEl(n) { return n && (n.nodeType === 1 ? n : n.parentElement); }
  function pfSelRange() {
    var sel = window.getSelection && window.getSelection();
    if (!sel || !sel.rangeCount || sel.isCollapsed) return null;
    var r = sel.getRangeAt(0), host = pfEl(r.commonAncestorContainer);
    var ed = host && host.closest && host.closest(".ee-editable");
    if (!ed || isTitleField(host) || !ed.contains(pfEl(r.startContainer)) || !ed.contains(pfEl(r.endContainer))) return null;
    return { range: r, host: host, ed: ed, sel: sel };
  }
  function clipHtmlOf(x) {
    var holder = document.createElement("div");
    holder.appendChild(x.range.cloneContents());
    // A selection inside one block: wrap it in that block (and its spans) so the copy
    // carries the block's size / font / heading / caption.
    for (var a = x.host; a && a !== x.ed && x.ed.contains(a); a = a.parentElement) {
      var c = a.cloneNode(false);
      while (holder.firstChild) c.appendChild(holder.firstChild);
      holder.appendChild(c);
    }
    Array.prototype.slice.call(holder.querySelectorAll(INJECTED_SEL + ", [data-ee-ui], #ee-cap-tools")).forEach(function (n) { n.remove(); });
    Array.prototype.slice.call(holder.querySelectorAll("*")).forEach(function (n) {
      if (n.tagName === "IMG") {
        var o = n.getAttribute("data-eimg-orig");
        if (o) n.setAttribute("src", o);
        n.removeAttribute("srcset"); n.removeAttribute("sizes");
      }
      n.removeAttribute("id"); n.removeAttribute("style"); n.removeAttribute("contenteditable");
      var cls = pfClasses(n);
      if (cls.length) n.setAttribute("class", cls.join(" ")); else n.removeAttribute("class");
    });
    return '<div data-ee-clip="pf1">' + holder.innerHTML + "</div>";
  }
  function onCopy(e) {
    var x = pfSelRange(), cd = e.clipboardData;
    if (!x || !cd) return;
    try {
      cd.setData("text/html", clipHtmlOf(x));
      cd.setData("text/plain", x.sel.toString());
    } catch (err) { return; }
    e.preventDefault();
    if (e.type === "cut" && !pfEl(x.range.startContainer).closest(".ee-locked,[contenteditable=\"false\"]")) {
      document.execCommand("delete", false, null);
      markDirty();
    }
  }
  // Site clipboard HTML -> a div of clean blocks that keep their ee-* classes.
  function pfInline(src, dst) {
    Array.prototype.forEach.call(src.childNodes, function (ch) {
      if (ch.nodeType === 3) { dst.appendChild(document.createTextNode(ch.nodeValue.replace(/[\r\n]+/g, " "))); return; }
      if (ch.nodeType !== 1) return;
      var tag = ch.tagName.toLowerCase();
      if (DROP[tag] || tag === "title" || tag === "xml" || /:/.test(tag)) return;
      if (tag === "br") { dst.appendChild(document.createElement("br")); return; }
      if (tag === "img") {
        var s = safeSrc(ch.getAttribute("src"));
        if (!s || /^blob:/i.test(s)) return;
        var im = document.createElement("img"); im.setAttribute("src", s);
        if (ch.getAttribute("alt")) im.setAttribute("alt", ch.getAttribute("alt"));
        dst.appendChild(im); return;
      }
      var into = dst, k = null;
      if (tag === "b" || tag === "strong") k = document.createElement("strong");
      else if (tag === "i" || tag === "em") k = document.createElement("em");
      else if (/^(u|s|sub|sup|small|code|cite|q|mark)$/.test(tag)) k = document.createElement(tag);
      else if (tag === "a") {
        var h = safeHref(ch.getAttribute("href"));
        if (h != null) { k = document.createElement("a"); k.setAttribute("href", h); if (ch.getAttribute("target") === "_blank") { k.setAttribute("target", "_blank"); k.setAttribute("rel", "noopener"); } }
      }
      var cls = pfClasses(ch).filter(function (c) { return !/^ee-al-/.test(c); });
      if (!k && cls.length) k = document.createElement("span");
      if (k) { if (cls.length) k.className = cls.join(" "); into.appendChild(k); into = k; }
      pfInline(ch, into);
    });
  }
  function sanitizeSiteBlocks(html) {
    var wrap = document.createElement("div");
    wrap.innerHTML = String(html || "").replace(/<!--[\s\S]*?-->/g, "");
    var out = document.createElement("div"), cur = null, curCls = [];
    function para() {
      if (!cur) { cur = document.createElement("p"); if (curCls.length) cur.className = curCls.join(" "); out.appendChild(cur); }
      return cur;
    }
    function end() { cur = null; }
    function leafish(n) { return !n.querySelector("p,div,h1,h2,h3,h4,h5,h6,ul,ol,figure,section,article,blockquote,table"); }
    function walk(src) {
      Array.prototype.forEach.call(src.childNodes, function (ch) {
        if (ch.nodeType === 3) { if (/\S/.test(ch.nodeValue) || cur) pfInline({ childNodes: [ch] }, para()); return; }
        if (ch.nodeType !== 1) return;
        var tag = ch.tagName.toLowerCase();
        if (DROP[tag] || tag === "title" || tag === "xml" || tag === "head" || /:/.test(tag)) return;
        if (/^h[1-6]$/.test(tag)) {
          end();
          var h = document.createElement(/^h[12]$/.test(tag) ? "h2" : "h3"), hc = pfClasses(ch);
          if (hc.length) h.className = hc.join(" ");
          pfInline(ch, h);
          out.appendChild(h);
          return;
        }
        if (tag === "ul" || tag === "ol") {
          end();
          var list = document.createElement(tag);
          (function items(l) {
            Array.prototype.forEach.call(l.childNodes, function (li) {
              if (li.nodeType !== 1) { if (li.nodeType === 3 && /\S/.test(li.nodeValue)) { var t = document.createElement("li"); t.textContent = li.nodeValue.trim(); list.appendChild(t); } return; }
              if (/^(ul|ol)$/i.test(li.tagName)) { items(li); return; }
              var item = document.createElement("li"), lc = pfClasses(li);
              if (lc.length) item.className = lc.join(" ");
              var sub = Array.prototype.filter.call(li.childNodes, function (k) { return k.nodeType === 1 && /^(UL|OL)$/.test(k.tagName); });
              sub.forEach(function (k) { li.removeChild(k); });
              pfInline(li, item);
              list.appendChild(item);
              sub.forEach(items);
            });
          })(ch);
          out.appendChild(list);
          return;
        }
        if (tag === "figure") {
          end();
          var imgs = Array.prototype.slice.call(ch.querySelectorAll("img")), fc0 = ch.querySelector("figcaption");
          if (imgs.length) {
            var fig = document.createElement("figure");
            imgs.forEach(function (im) { pfInline({ childNodes: [im] }, fig); });
            if (fc0) { var fc = document.createElement("figcaption"), fcc = pfClasses(fc0); if (fcc.length) fc.className = fcc.join(" "); pfInline(fc0, fc); fig.appendChild(fc); }
            if (fig.querySelector("img")) { out.appendChild(fig); return; }
          }
          // Only the caption's words were copied: they keep the caption look.
          if (fc0) { var cp = document.createElement("p"), cc = pfClasses(fc0); if (cc.indexOf("ee-caption") < 0) cc.push("ee-caption"); cp.className = cc.join(" "); pfInline(fc0, cp); out.appendChild(cp); }
          return;
        }
        if (tag === "figcaption") { end(); var fp = document.createElement("p"), fpc = pfClasses(ch); if (fpc.indexOf("ee-caption") < 0) fpc.push("ee-caption"); fp.className = fpc.join(" "); pfInline(ch, fp); out.appendChild(fp); return; }
        if (tag === "li") { end(); var pc = curCls; curCls = pfClasses(ch); walk(ch); end(); curCls = pc; return; }
        if (tag === "hr") { end(); return; }
        if (tag === "p" || (PASTE_BLOCK.test(tag) && leafish(ch) && (tag !== "div" || pfClasses(ch).length || ch.parentNode !== wrap))) {
          end();
          var prev = curCls; curCls = pfClasses(ch);
          if (!curCls.length && tag !== "p") curCls = prev;
          walk(ch); end();
          curCls = prev;
          return;
        }
        if (PASTE_BLOCK.test(tag)) { end(); var pv = curCls; var own = pfClasses(ch); if (own.length) curCls = own; walk(ch); end(); curCls = pv; return; }
        pfInline({ childNodes: [ch] }, para());
      });
    }
    walk(wrap);
    Array.prototype.slice.call(out.querySelectorAll("p,li,h2,h3,figcaption")).forEach(function (b) {
      while (b.lastChild && b.lastChild.nodeType === 3 && !/\S/.test(b.lastChild.nodeValue)) b.removeChild(b.lastChild);
      if (b.firstChild && b.firstChild.nodeType === 3) b.firstChild.nodeValue = b.firstChild.nodeValue.replace(/^\s+/, "");
    });
    Array.prototype.slice.call(out.querySelectorAll("strong,em,a,span,u,s,sub,sup,small,code,cite,q,mark")).reverse().forEach(function (n) { if (!n.textContent && !n.querySelector("img,br")) n.remove(); });
    Array.prototype.slice.call(out.children).forEach(function (b) {
      if (b.tagName === "FIGURE") return;
      if (b.tagName === "UL" || b.tagName === "OL") {
        Array.prototype.slice.call(b.children).forEach(function (li) { if (!/\S/.test(li.textContent) && !li.querySelector("img")) li.remove(); });
        if (!b.children.length) b.remove();
        return;
      }
      // A block that is only a <br> was a copied empty line: keep it as an empty paragraph
      // between others, drop it at either end.
      if (!/\S/.test(b.textContent) && !b.querySelector("img")) {
        if (b === out.firstElementChild || b === out.lastElementChild || !b.querySelector("br")) b.remove();
        else b.innerHTML = "<br>";
      }
    });
    Array.prototype.slice.call(out.querySelectorAll("p,li,h2,h3,figcaption")).forEach(function (b) {
      while (b.lastChild && b.lastChild.nodeName === "BR" && b.childNodes.length > 1) b.removeChild(b.lastChild);
      // The whole line is one styled span (text copied out of a sized run): the look
      // moves onto the line itself, so it also sizes the line box where it lands.
      var kids = Array.prototype.filter.call(b.childNodes, function (k) { return !(k.nodeType === 3 && !/\S/.test(k.nodeValue)); });
      if (kids.length === 1 && kids[0].nodeName === "SPAN" && kids[0].classList.length) {
        var sp = kids[0];
        Array.prototype.forEach.call(sp.classList, function (c) {
          PF_FAMS.forEach(function (re) { if (re.test(c)) Array.prototype.slice.call(b.classList).forEach(function (x) { if (re.test(x)) b.classList.remove(x); }); });
          b.classList.add(c);
        });
        while (sp.firstChild) b.insertBefore(sp.firstChild, sp);
        sp.remove();
      }
    });
    return out;
  }
  function pfGroup(b) { var t = b.tagName; return t === "H1" || t === "H2" ? "h2" : /^H[3-6]$/.test(t) ? "h3" : t === "P" ? "p" : t.toLowerCase(); }
  function pfLook(b) { return pfClasses(b).filter(function (c) { return !/^ee-al-/.test(c); }).sort().join(" "); }
  function pfSame(a, b) { return pfGroup(a) === pfGroup(b) && pfLook(a) === pfLook(b); }
  function pfEmpty(n) { return !/\S/.test(n.textContent.replace(/\u00a0/g, " ")) && !n.querySelector("img"); }
  // Inline content of a pasted block, wrapped in a span for every look it has that the
  // target block does not (null when the target has a look the paste would wrongly inherit).
  function pfInlineFor(b, target) {
    var bc = pfClasses(b), tc = pfClasses(target), span = [];
    if (b.tagName === "H2" || b.tagName === "H3") bc.push("ee-" + b.tagName.toLowerCase());
    if (target.tagName === "H2" || target.tagName === "H3") tc.push("ee-" + target.tagName.toLowerCase());
    for (var i = 0; i < PF_FAMS.length; i++) {
      var s = pfFam(bc, PF_FAMS[i]), t = pfFam(tc, PF_FAMS[i]);
      if (s && s !== t) span.push(s);
      else if (!s && t) return null;
    }
    var f = document.createDocumentFragment(), into = f;
    if (span.length) { var sp = document.createElement("span"); sp.className = span.join(" "); f.appendChild(sp); into = sp; }
    if (b.tagName === "FIGURE") Array.prototype.forEach.call(b.querySelectorAll("img"), function (im) { into.appendChild(im.cloneNode(true)); });
    else if (b.tagName === "UL" || b.tagName === "OL") Array.prototype.forEach.call(b.children, function (li, k) { if (k) into.appendChild(document.createElement("br")); while (li.firstChild) into.appendChild(li.firstChild); });
    else while (b.firstChild) into.appendChild(b.firstChild);
    return f;
  }
  function pfPrune(n) {
    Array.prototype.slice.call(n.querySelectorAll ? n.querySelectorAll("span,strong,em,b,i,u,s,a,sub,sup,small,font") : []).reverse().forEach(function (x) {
      if (!x.textContent && !x.querySelector("img,br")) x.remove();
    });
  }
  function pfCaretAfter(node) {
    try { var r = document.createRange(); r.setStartAfter(node); r.collapse(true); var s = window.getSelection(); s.removeAllRanges(); s.addRange(r); } catch (e) {}
  }
  // Put inline content at the caret at the TOP level of block L: any spans/bold the caret
  // sits in are split around it, so the paste never inherits them.
  function pfInsertTop(L, range, frag) {
    var r = document.createRange();
    r.setStart(range.startContainer, range.startOffset); r.setEnd(L, L.childNodes.length);
    var tail = r.extractContents();
    pfPrune(tail); pfPrune(L);
    var hadText = /\S/.test(L.textContent) || !!L.querySelector("img");
    if (!hadText) while (L.firstChild) L.removeChild(L.firstChild);
    var last = frag.lastChild;
    L.appendChild(frag);
    if (/\S/.test(tail.textContent) || (tail.querySelector && tail.querySelector("img"))) L.appendChild(tail);
    L.normalize();
    return last;
  }
  function pfPaste(html) {
    var root = state.page && state.page.el;
    var out = sanitizeSiteBlocks(html);
    var blocks = Array.prototype.slice.call(out.children);
    if (!blocks.length) return false;
    var sel = window.getSelection();
    if (!sel.rangeCount) return false;
    if (!sel.isCollapsed) document.execCommand("delete", false, null);
    if (!sel.rangeCount) return false;
    var range = sel.getRangeAt(0);
    if (!root) {
      // Per-block pages: inline only, each pasted block's look rides on a span.
      var hh = blocks.map(function (b) {
        var d = document.createElement("div"), cls = pfClasses(b).filter(function (c) { return !/^ee-al-/.test(c); });
        if (b.tagName === "H2" || b.tagName === "H3") cls.push("ee-" + b.tagName.toLowerCase());
        var inner = b.tagName === "FIGURE" ? Array.prototype.map.call(b.querySelectorAll("img"), function (im) { return im.outerHTML; }).join("") : b.innerHTML;
        d.innerHTML = cls.length ? '<span class="' + cls.join(" ") + '">' + inner + "</span>" : inner;
        return d.innerHTML;
      });
      document.execCommand("insertHTML", false, hh.join("<br>"));
      markDirty();
      return true;
    }
    var L = leafOf(range.startContainer, root);
    if (!L || !blockUsable(L) || !root.contains(L)) return false;
    var before = { html: L.innerHTML, cls: L.getAttribute("class") };
    var parent = L.parentNode, inserted = [], removeL = false, caretNode = null;
    var blockOK = /^(P|H[1-6])$/.test(L.tagName) && !L.closest("li,figure,dd,dt,td,th");
    var Lempty = pfEmpty(L);
    var single = blocks.length === 1 && /^(P|H2|H3)$/.test(blocks[0].tagName) ? pfInlineFor(blocks[0].cloneNode(true), L) : null;
    if (!blockOK) {
      // Caption, list item, dossier cell…: lines joined by line breaks, looks on spans.
      var f = document.createDocumentFragment();
      blocks.forEach(function (b, i) {
        if (i) f.appendChild(document.createElement("br"));
        var part = pfInlineFor(b, L);
        if (!part) { part = document.createDocumentFragment(); var sp = document.createElement("span"); var cl = pfClasses(b).filter(function (c) { return !/^ee-al-/.test(c); }); if (cl.length) sp.className = cl.join(" "); while (b.firstChild) sp.appendChild(b.firstChild); part.appendChild(cl.length ? sp : document.createTextNode(sp.textContent)); }
        f.appendChild(part);
      });
      caretNode = pfInsertTop(L, range, f);
    } else if (single && !Lempty) {
      caretNode = pfInsertTop(L, range, single);
    } else {
      var r = document.createRange();
      r.setStart(range.startContainer, range.startOffset); r.setEnd(L, L.childNodes.length);
      var tailFrag = r.extractContents();
      pfPrune(tailFrag); pfPrune(L);
      var tailHas = /\S/.test(tailFrag.textContent) || !!(tailFrag.querySelector && tailFrag.querySelector("img"));
      var headHas = !pfEmpty(L);
      var list = blocks.slice();
      if (headHas && list.length && pfSame(L, list[0])) {
        var b0 = list.shift(); while (b0.firstChild) L.appendChild(b0.firstChild);
        caretNode = L.lastChild;
      }
      var T = null;
      if (tailHas) {
        T = L.cloneNode(false); T.removeAttribute("id");
        T.appendChild(tailFrag);
        if (list.length && pfSame(L, list[list.length - 1])) {
          var bl = list.pop(), first = T.firstChild, lastIn = bl.lastChild;
          while (bl.firstChild) T.insertBefore(bl.firstChild, first);
          caretNode = lastIn;
        }
      }
      var ref = L.nextSibling;
      list.forEach(function (b) { parent.insertBefore(b, ref); inserted.push(b); if (b.tagName === "P" || /^H/.test(b.tagName)) fixBlockClass(b); });
      if (T) { parent.insertBefore(T, ref); inserted.push(T); }
      // Caret: after the pasted text (merged into the tail line, else the last new block).
      if (!(T && caretNode && T.contains(caretNode)) && list.length) {
        var lb = list[list.length - 1];
        caretNode = null;
        caretInto(lb.tagName === "FIGURE" ? (lb.querySelector("figcaption") || lb) : (lb.tagName === "UL" || lb.tagName === "OL") ? (lb.lastElementChild || lb) : lb, true);
      }
      if (!headHas) { removeL = true; L.remove(); }
      else L.normalize();
    }
    if (caretNode && caretNode.isConnected) pfCaretAfter(caretNode);
    capMarkAll();
    var after = { html: L.innerHTML, cls: L.getAttribute("class"), ins: inserted.map(function (n) { return n.outerHTML; }) };
    var entry = [];
    entry.custom = {
      canUndo: function () {
        return inserted.every(function (n, i) { return n.isConnected && n.outerHTML === after.ins[i]; }) &&
          (removeL ? !L.isConnected && (inserted.length ? true : false) : (L.isConnected && L.innerHTML === after.html));
      },
      canRedo: function () {
        return L.isConnected && L.innerHTML === before.html && L.getAttribute("class") === before.cls && inserted.every(function (n) { return !n.isConnected; });
      },
      undo: function () {
        if (removeL) parent.insertBefore(L, inserted[0] || null);
        inserted.forEach(function (n) { n.remove(); });
        setBlock(L, before.html, before.cls);
        caretInto(L, true);
      },
      redo: function () {
        var ref2 = L.nextSibling;
        inserted.forEach(function (n) { parent.insertBefore(n, ref2); });
        setBlock(L, after.html, after.cls);
        if (removeL) L.remove();
        if (inserted.length) caretInto(inserted[inserted.length - 1], true); else caretInto(L, true);
      }
    };
    styleUndo.push(entry); if (styleUndo.length > 60) styleUndo.shift();
    styleRedo = [];
    markDirty();
    return true;
  }
  function onPaste(e) {
    if (!e.target.closest || !e.target.closest(".ee-editable")) return;
    e.preventDefault();
    var cd = e.clipboardData || window.clipboardData;
    if (isTitleField(e.target) || isTitleField(selNode())) {
      var plain = cd ? cd.getData("text/plain") : "";
      document.execCommand("insertText", false, plain.replace(/\s+/g, " ").trim());
      return;
    }
    var files = clipboardImageFiles(cd);
    if (files.length && Media && P.isAdmin(state.profile)) {
      var seq = Promise.resolve();
      files.forEach(function (file) {
        seq = seq.then(function () {
          return addPending(file, { title: file.name, tags: ["paste"] }).then(function (pd) { insertAtCaret(pendingImgHtml(pd)); markDirty(); });
        });
      });
      seq.then(function () { editBar("Picture pasted \u00b7 uploaded when you press Save"); },
        function (err) { editBar(err.message || "Paste failed.", "ee-bad-bar"); });
      return;
    }
    var html = cd ? cd.getData("text/html") : "";
    var t = cd ? cd.getData("text/plain") : "";
    if (!(html && /<[a-z]/i.test(html))) { document.execCommand("insertText", false, t); return; }
    // pf1: our own copy (or site HTML with our classes) keeps its formatting.
    if (PF_SITE.test(html)) { try { if (pfPaste(html)) return; } catch (pfErr) {} }
    var root = state.page && state.page.el, n = selNode();
    var leaf = root && n ? leafOf(n, root) : null;
    // Full-page editing in a paragraph: keep the pasted paragraphs/headings/lists.
    var blockMode = !!(leaf && leaf.tagName === "P");
    var cls = blockMode ? Array.prototype.filter.call(leaf.classList, function (c) { return !/^ee-/.test(c); }).join(" ") || paraClassFor(leaf) : "";
    var out = blockMode ? sanitizePasteBlocks(html, cls) : null;
    var holder = out || (function () { var d = document.createElement("div"); d.innerHTML = sanitizePasteHtml(html); return d; })();
    var range0 = window.getSelection().rangeCount ? window.getSelection().getRangeAt(0).cloneRange() : null;
    pendDataImages(holder).then(function (h) {
      if (range0) { try { var sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(range0); } catch (e1) {} }
      if (!/\S/.test(h.textContent) && !h.querySelector("img")) { document.execCommand("insertText", false, t); return; }
      var single = blockMode && h.children.length === 1 && h.firstElementChild.tagName === "P";
      var ins = (blockMode && !single) ? h.innerHTML : (single ? h.firstElementChild.innerHTML : h.innerHTML);
      document.execCommand("insertHTML", false, ins);
      if (blockMode) tidyPasted(root, leaf.isConnected ? leaf : null, leafOf(selNode(), root));
      markDirty();
    });
  }
  function onClick(e) {
    var a = e.target.closest && e.target.closest(".ee-editable a");
    if (a) e.preventDefault(); // editing a link's text shouldn't navigate
  }
  /* ---------------- Unsaved-changes tracking ---------------- */
  var LEAVE_MSG = "Leave this page? Your unsaved changes will be lost.";
  function markDirty() { if (state.editing) state.dirty = true; }
  function onEditInput(e) {
    var t = e.target;
    if (t && t.closest && t.closest(".ee-editable")) { markDirty(); styleRedo = []; }
  }
  function onNavClick(e) {
    if (!state.editing || !state.dirty || state.leaving) return;
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target && e.target.closest && e.target.closest("a[href]");
    if (!a || a.closest(".ee-editable") || a.closest("#ee-bar,#ee-panel,#ee-stylebar")) return;
    var tgt = a.getAttribute("target");
    if (tgt && tgt !== "_self") return;
    var u;
    try { u = new URL(a.getAttribute("href"), location.href); } catch (x) { return; }
    if (!/^https?:$/.test(u.protocol)) return;
    if (u.origin === location.origin && u.pathname === location.pathname && u.search === location.search && a.getAttribute("href").indexOf("#") >= 0) return;
    if (window.confirm(LEAVE_MSG)) { state.leaving = true; return; }
    e.preventDefault();
    e.stopImmediatePropagation();
  }
  function onBeforeUnload(e) {
    if (!state.editing || !state.dirty || state.leaving) return;
    e.preventDefault();
    e.returnValue = "";
    return "";
  }
  function addDirtyListeners() {
    state.dirty = false;
    state.leaving = false;
    document.addEventListener("input", onEditInput, true);
    window.addEventListener("click", onNavClick, true);
    window.addEventListener("beforeunload", onBeforeUnload);
  }
  function removeDirtyListeners() {
    document.removeEventListener("input", onEditInput, true);
    window.removeEventListener("click", onNavClick, true);
    window.removeEventListener("beforeunload", onBeforeUnload);
  }
  function stopEditing() {
    closeTemplateMenu();
    removeDossierTools();
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
    (state.titles || []).forEach(function (t) {
      t.el.removeAttribute("contenteditable"); t.el.removeAttribute("spellcheck"); t.el.classList.remove("ee-editable", "ee-title-edit");
    });
    state.titles = [];
    closeArts();
    if (state.railRestore) { try { state.railRestore(); } catch (e) {} state.railRestore = null; }
    document.documentElement.classList.remove("ee-editing", "ee-page-editing");
    document.removeEventListener("keydown", onKey, true);
    document.removeEventListener("paste", onPaste, true);
    document.removeEventListener("copy", onCopy, true);
    document.removeEventListener("cut", onCopy, true);
    document.removeEventListener("click", onClick, true);
    document.removeEventListener("click", onCapClick, true);
    if (state.page && state.page.el) state.page.el.removeEventListener("input", onCapInput);
    capToolsClose();
    document.removeEventListener("selectionchange", onSelChange);
    window.removeEventListener("resize", positionStyleBar);
    removeDirtyListeners();
    removeStyleBar();
    state.editing = false;
    state.dirty = false;
    styleUndo = []; styleRedo = [];
  }
  function cancelEdit() {
    if (!state.editing) return;
    // Only rebuild the DOM when something was changed (keeps page scripts' listeners).
    if (state.dirty) {
      if (state.page && state.page.el) state.page.el.innerHTML = state.page.original;
      state.records.forEach(function (r) { r.el.innerHTML = r.original; });
      (state.titles || []).forEach(function (t) { if (t.el.innerHTML !== t.original) t.el.innerHTML = t.original; });
    }
    restoreHero();
    dropPending();
    stopEditing();
    state.arts = null;
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
        keepImgSizing(from, to);
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
        if (tag === "figcaption" && !norm(ch.textContent)) return; // ic1: empty captions are never saved
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
  /* Full-page save rebuilds main from the page SOURCE, not from the live DOM.
     At startEdit every live element under main is matched to its source element
     (before any edit-mode marking). On save, untouched elements are copied from the
     source byte-for-byte (comments, entities, srcset, whitespace and all); only the
     blocks whose content actually changed are re-serialized. Elements that scripts
     injected at runtime (sibling navs, chapter navs, player buttons, cards) never
     match the source and are dropped; runtime classes/attributes are stripped. */
  var RUNTIME_CLASS = /^(nav-fade[\w-]*|ee-(editable|page|locked|index-[\w-]+))$/;
  var INJECTED_SEL = "nav.nt-siblings, nav.nt-chapnav, .profile-gh-actions, .card-lore-back, .nt-rel-head, .nt-related, [data-ee-ui]";
  var CONTAINER_TAGS = { main: 1, section: 1, div: 1, ul: 1, ol: 1, dl: 1, blockquote: 1, figure: 1, header: 1, footer: 1, article: 1, table: 1, thead: 1, tbody: 1, tr: 1 };
  var SRC_INLINE = { a: 1, em: 1, strong: 1, i: 1, b: 1, u: 1, s: 1, sub: 1, sup: 1, small: 1, span: 1, code: 1, cite: 1, q: 1, abbr: 1, br: 1, img: 1, wbr: 1, mark: 1, time: 1 };
  function keyClasses(list) { return Array.prototype.filter.call(list || [], function (c) { return !RUNTIME_CLASS.test(c); }).sort().join("."); }
  function liveKey(n) { return n.tagName.toLowerCase() + "#" + (n.id || "") + "." + keyClasses(n.classList); }
  function srcKey(s) { return s.tag + "#" + (s.id || "") + "." + keyClasses(s.classes); }
  function srcIsContainer(s) {
    return !!CONTAINER_TAGS[s.tag] && s.children.some(function (c) { return !SRC_INLINE[c.tag]; });
  }
  function imgKey(src) {
    var s = String(src || "").trim().replace(/^https?:\/\/[^\/]+/i, "").replace(/^\/cdn-cgi\/image\/[^\/]+/i, "");
    try { s = decodeURIComponent(s); } catch (e) { try { s = decodeURI(s); } catch (e2) {} }
    return s;
  }
  function findSrcMain(root) {
    var kids = root.children || [];
    for (var i = 0; i < kids.length; i++) {
      var c = kids[i], cls = c.classes || [];
      if (c.tag === "main" && (cls.indexOf("art-body") >= 0 || cls.indexOf("read") >= 0)) return c;
      var d = findSrcMain(c);
      if (d) return d;
    }
    return null;
  }
  function lcsPairs(a, b) {
    var n = a.length, m = b.length, w = m + 1, dp = new Uint16Array((n + 1) * w);
    for (var i = n - 1; i >= 0; i--) for (var j = m - 1; j >= 0; j--) {
      dp[i * w + j] = a[i] === b[j] ? dp[(i + 1) * w + j + 1] + 1 : Math.max(dp[(i + 1) * w + j], dp[i * w + j + 1]);
    }
    var out = [], x = 0, y = 0;
    while (x < n && y < m) {
      if (a[x] === b[y]) { out.push([x, y]); x++; y++; }
      else if (dp[(x + 1) * w + y] >= dp[x * w + y + 1]) x++;
      else y++;
    }
    return out;
  }
  function pageSrc() { return state.page.src; }
  function srcTextOf(s) {
    var P0 = pageSrc();
    if (!P0.textCache.has(s)) P0.textCache.set(s, norm(textOf(P0.text.slice(s.start, s.end))));
    return P0.textCache.get(s);
  }
  // Clean a detached clone: drop injected UI, locked regions (canon) or lock
  // placeholders (emit), runtime classes and attributes; put source img URLs back.
  function cleanRuntime(root, mode) {
    Array.prototype.slice.call(root.querySelectorAll(INJECTED_SEL)).forEach(function (n) { n.remove(); });
    if (mode !== "raw") Array.prototype.slice.call(root.querySelectorAll("[data-ee-lock], " + PAGE_LOCK_SEL)).forEach(function (n) {
      if (!n.parentNode) return;
      var idx = n.getAttribute("data-ee-lock");
      if (mode === "emit" && idx != null) {
        var ph = document.createElement("div"); ph.setAttribute("data-ee-lock-ph", idx);
        n.parentNode.replaceChild(ph, n);
      } else n.remove();
    });
    [root].concat(Array.prototype.slice.call(root.querySelectorAll("*"))).forEach(function (n) {
      if (n.tagName === "IMG") {
        var k = imgKey(n.getAttribute("data-eimg-orig") || n.getAttribute("src"));
        if (mode === "canon") { n.setAttribute("src", k); n.removeAttribute("srcset"); n.removeAttribute("sizes"); }
        else {
          var sa = pageSrc().imgs[k];
          if (sa && (n.getAttribute("data-eimg-fell") || !n.hasAttribute("srcset"))) {
            ["src", "srcset", "sizes", "loading", "decoding", "width", "height"].forEach(function (a) {
              if (sa[a] != null) n.setAttribute(a, sa[a]); else if (a !== "src") n.removeAttribute(a);
            });
          }
        }
      }
      if (n.hasAttribute("class")) {
        var kc = Array.prototype.filter.call(n.classList, function (c) { return !RUNTIME_CLASS.test(c); });
        if (kc.length) n.setAttribute("class", kc.join(" ")); else n.removeAttribute("class");
      }
      Array.prototype.slice.call(n.attributes).forEach(function (a) {
        var nm = a.name;
        if (nm === "style" || nm === "contenteditable" || nm === "spellcheck" || nm === "draggable" ||
            (/^data-(ee|eimg)-/.test(nm) && nm !== "data-ee-lock-ph")) n.removeAttribute(nm);
      });
    });
    return root;
  }
  function canonOf(n) {
    if (n.matches(PAGE_LOCK_SEL)) return { all: "LOCK", inner: "LOCK", cls: "" };
    var c = cleanRuntime(n.cloneNode(true), "canon");
    var w = document.createElement("div"); w.appendChild(c);
    return {
      all: sanitizePageHtml(w).replace(/\s+/g, " "),
      inner: sanitizePageHtml(c).replace(/\s+/g, " "),
      cls: keyClasses(n.classList)
    };
  }
  function mapPage(liveEl, srcNode) {
    var P0 = pageSrc();
    var live = Array.prototype.slice.call(liveEl.children);
    var src = srcNode.children.slice();
    var pairs = lcsPairs(live.map(liveKey), src.map(srcKey));
    var lm = new Array(live.length), sm = new Array(src.length);
    pairs.forEach(function (p) { lm[p[0]] = p[1]; sm[p[1]] = p[0]; });
    // Second pass: same tag and same text between matched anchors (scripts can
    // toggle classes on elements; their text still identifies them).
    var li = 0, si = 0;
    for (var a = 0; a <= pairs.length; a++) {
      var le = a < pairs.length ? pairs[a][0] : live.length, se = a < pairs.length ? pairs[a][1] : src.length;
      var j = si;
      for (var i = li; i < le; i++) {
        var t = live[i].tagName.toLowerCase(), txt = null;
        for (var k = j; k < se; k++) {
          if (sm[k] != null || src[k].tag !== t) continue;
          if (txt == null) txt = norm(live[i].textContent);
          if (srcTextOf(src[k]) === txt) { lm[i] = k; sm[k] = i; j = k + 1; break; }
        }
      }
      if (a < pairs.length) { li = pairs[a][0] + 1; si = pairs[a][1] + 1; }
    }
    live.forEach(function (n, i) {
      if (lm[i] == null) { P0.injected.add(n); return; }
      var s = src[lm[i]];
      P0.map.set(n, s);
      P0.mapped.add(s);
      P0.canon0.set(n, canonOf(n));
      if (srcIsContainer(s) && !n.matches(PAGE_LOCK_SEL)) mapPage(n, s);
    });
  }
  function initPageSource(mainEl, text) {
    var root = M.parse(text);
    var srcMain = findSrcMain(root);
    if (!srcMain) return null;
    var imgs = {};
    (function walk(s) {
      if (s.tag === "img" && s.attrs && s.attrs.src) {
        var k = imgKey(s.attrs.src);
        if (!(k in imgs)) imgs[k] = s.attrs;
      }
      (s.children || []).forEach(walk);
    })(srcMain);
    state.page.src = {
      text: text, node: srcMain, imgs: imgs, textCache: new Map(),
      map: new WeakMap(), mapped: new WeakSet(), injected: new WeakSet(), canon0: new WeakMap(), lockHTML: []
    };
    mapPage(mainEl, srcMain);
    return state.page.src;
  }
  function rebuildOpenTag(rawOpen, liveEl) {
    // Only the class attribute changes (e.g. a paragraph got ee-pt-12).
    var kc = Array.prototype.filter.call(liveEl.classList, function (c) { return !RUNTIME_CLASS.test(c) && /^[\w-]+$/.test(c); }).join(" ");
    var re = /(\sclass\s*=\s*)("[^"]*"|'[^']*'|[^\s>]+)/i;
    if (re.test(rawOpen)) {
      return kc ? rawOpen.replace(re, function (m, a) { return a + '"' + kc + '"'; }) : rawOpen.replace(re, "");
    }
    if (!kc) return rawOpen;
    return rawOpen.replace(/^<([a-zA-Z][\w-]*)/, '<$1 class="' + kc + '"');
  }
  function fillLocks(html) {
    var P0 = pageSrc();
    return html.replace(/<div[^>]*data-ee-lock-ph="(\d+)"[^>]*>\s*<\/div>/gi, function (_, i) { return P0.lockHTML[Number(i)] || ""; });
  }
  function emitNew(n) {
    var w = document.createElement("div");
    w.appendChild(cleanRuntime(n.cloneNode(true), "emit"));
    // A block split by Enter starts with Chrome's &nbsp; (kept visible while editing); drop it.
    return fillLocks(sanitizePageHtml(w)).replace(/^(<(?:p|li|h[1-6])\b[^>]*>)(?:&nbsp;)+/, "$1").replace(/(?:&nbsp;)+(<\/(?:p|li|h[1-6])>)$/, "$1");
  }
  var LEAF_TAGS = { p: 1, h1: 1, h2: 1, h3: 1, h4: 1, h5: 1, h6: 1, li: 1, dd: 1, dt: 1, figcaption: 1, td: 1, th: 1 };
  // Blocks pasted/typed inside a paragraph become line breaks (no <p> inside <p>).
  function flattenBlocks(c) {
    if (!LEAF_TAGS[c.tagName.toLowerCase()]) return;
    Array.prototype.slice.call(c.querySelectorAll("p,div,h1,h2,h3,h4,h5,h6,section,blockquote,header")).reverse().forEach(function (b) {
      var prev = b.previousSibling;
      if (prev && (prev.nodeType !== 3 || /\S/.test(prev.nodeValue)) && prev.nodeName !== "BR") b.parentNode.insertBefore(document.createElement("br"), b);
      while (b.firstChild) b.parentNode.insertBefore(b.firstChild, b);
      b.remove();
    });
  }
  function emitInnerOf(n, rawInner) {
    var c = cleanRuntime(n.cloneNode(true), "emit");
    flattenBlocks(c);
    var html = fillLocks(sanitizePageHtml(c));
    if (!/&nbsp;|&#160;|&#xa0;/i.test(rawInner)) html = html.replace(/&nbsp;/g, " ");
    return preserveEntities(html, rawInner);
  }
  function emitElement(n, s) {
    var P0 = pageSrc(), T = P0.text;
    var verbatim = T.slice(s.start, s.end);
    if (n.matches(PAGE_LOCK_SEL)) return verbatim;
    var c0 = P0.canon0.get(n), c1 = canonOf(n);
    if (c0 && c1.all === c0.all) return verbatim;
    var open = T.slice(s.start, s.openEnd), close = T.slice(s.closeStart, s.end);
    if (c0 && c1.cls !== c0.cls) open = rebuildOpenTag(open, n);
    if (srcIsContainer(s)) return open + emitChildren(n, s) + close;
    if (s.closeStart === s.openEnd && s.end === s.openEnd) return emitNew(n); // void (img etc.)
    var rawInner = T.slice(s.openEnd, s.closeStart);
    var inner = (c0 && c1.inner === c0.inner) ? rawInner : emitInnerOf(n, rawInner);
    return open + inner + close;
  }
  var NEW_BLOCK = { p: 1, h1: 1, h2: 1, h3: 1, h4: 1, h5: 1, h6: 1, section: 1, header: 1, blockquote: 1, ul: 1, ol: 1, li: 1, dl: 1, dt: 1, dd: 1, figure: 1, figcaption: 1, hr: 1, div: 1, img: 1 };
  function emitChildren(liveEl, s) {
    var P0 = pageSrc(), T = P0.text, kids = s.children, out = "", last = -1;
    var index = new Map(); kids.forEach(function (k, i) { index.set(k, i); });
    function gap(i) { return T.slice(i === 0 ? s.openEnd : kids[i - 1].end, kids[i].start); }
    function orphans(upto) {
      for (var j = last + 1; j < upto; j++) if (!P0.mapped.has(kids[j])) out += gap(j) + T.slice(kids[j].start, kids[j].end);
    }
    Array.prototype.forEach.call(liveEl.childNodes, function (ch) {
      if (ch.nodeType === 3) {
        if (/\S/.test(ch.nodeValue)) out += esc(ch.nodeValue).replace(/&#39;/g, "'").replace(/&quot;/g, '"');
        return;
      }
      if (ch.nodeType !== 1 || P0.injected.has(ch)) return;
      var sn = P0.map.get(ch), idx = sn ? index.get(sn) : undefined;
      if (idx != null && idx > last) {
        orphans(idx);
        out += gap(idx) + emitElement(ch, sn);
        last = idx;
        return;
      }
      if (!sn && (ch.matches(PAGE_LOCK_SEL) || ch.matches(INJECTED_SEL))) return;
      var tag = ch.tagName.toLowerCase();
      out += (NEW_BLOCK[tag] && tag !== "dt" && tag !== "dd" ? "\n" : "") + emitNew(ch); // Dossier rows stay on the dl's line, like the site's
    });
    orphans(kids.length);
    out += T.slice(kids.length ? kids[kids.length - 1].end : s.openEnd, s.closeStart);
    return out;
  }
  function serializePageMain() {
    return emitChildren(state.page.el, pageSrc().node);
  }
  function createArticleFromTitle(title) {
    title = String(title || "").trim();
    if (!title) return;
    var artSlug = (Media && Media.slugify) ? Media.slugify(title) : String(title).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
    if (!artSlug) { editBar("Need a usable title.", "ee-bad-bar"); return; }
    var path = "articles/" + artSlug + ".html";
    var pretty = "articles/" + artSlug + "/index.html";
    closePanel();
    editBar("Creating article…", "ee-busy");
    E.getFile(path).then(function () {
      editBar("That article already exists: " + path, "ee-bad-bar");
    }, function () {
      var escTitle = title.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
      var body =
        "<!doctype html>\n<html lang=\"en\">\n<head>\n" +
        "<script src=\"/session-gate.js?v=guest-browse\"></script>\n<script src=\"/back-scroll.js?v=bs1\"></script>\n\n" +
        "<meta charset=\"utf-8\">\n" +
        "<script src=\"/img.js?v=img-resize\"></script>\n" +
        "<script src=\"/cats-rail-boot.js?v=art74\"></script>\n" +
        "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1,viewport-fit=cover\">\n" +
        "<title>" + escTitle + " - Elorae</title>\n" +
        "<meta name=\"description\" content=\"" + escTitle + "\">\n" +
        "<link rel=\"stylesheet\" href=\"/styles.css?v=fs125\">\n" +
        "<link rel=\"stylesheet\" href=\"/html.css?v=fs125\">\n" +
        "<script src=\"/rail-toggle.js?v=nfs1\"></script>\n" +
        "<script src=\"/skip-link.js?v=fs125\"></script>\n" +
        "<link rel=\"icon\" href=\"/favicon.svg\">\n</head>\n<body class=\"article\">\n" +
        "<div class=\"mast\"><header class=\"topbar\"><span class=\"mark\"></span>" +
        "<form action=\"/search/\"><input id=\"seek\" name=\"q\" type=\"search\" placeholder=\"Search\" aria-label=\"Search\"></form>" +
        "<nav class=\"filters\"><a href=\"/atlas/\">Atlas</a><a href=\"/codex/lore/\">Codex</a><a class=\"active\" href=\"/index/ancients/\">Index</a><a href=\"/journal/\">Journal</a></nav></header></div>\n" +
        "<main class=\"art-body\">\n" +
        "<header class=\"art-title\"><h1>" + escTitle + "</h1><p class=\"art-epithet\"></p></header>\n" +
        "<section class=\"art-sec\" id=\"lore\"><h2>Lore</h2><p class=\"art-life\"></p></section>\n" +
        "</main>\n" +
        "<script src=\"/search.js?v=fs125\"></script><script src=\"/login.js?v=vt1\"></script><script src=\"/player-mark.js?v=pretty-urls\"></script>\n" +
        "<canvas id=\"friend-glow\"></canvas>\n<script src=\"/glow.js?v=nt32-ambient\"></script>\n" +
        "<script src=\"/peek.js?v=vt1\" defer></script>\n" +
        "<script src=\"/art-fit.js?v=af1\" defer></script>\n" +
        "<script src=\"/title-travel.js?v=tt1\" defer></script>\n" +
        "<script src=\"/edit/edit.js?v=fs125\" defer></script>\n" +
        "</body>\n</html>\n";
      var files = [
        { path: path, text: body },
        { path: pretty, text: body }
      ];
      return E.retrySave(function () { return E.commitFiles(files, "Edit: new article " + artSlug + " [edit-mode]", E.BRANCH); }).then(function () {
        var prettyUrl = "/articles/" + artSlug + "/";
        var htmlUrl = "/articles/" + artSlug + ".html";
        var maxMs = 180000;
        var intervalMs = 4000;
        var started = Date.now();
        editBar("Created — publishing to the site…", "ee-busy");
        function isRealArticle(body) {
          var s = String(body || "");
          if (/page does not exist|permalink\s*404/i.test(s)) return false;
          if (/<main[^>]*art-body|class="[^"]*art-body|class="art-title"|class="[^"]*art-title/i.test(s)) return true;
          if (/<body[^>]*class="[^"]*\barticle\b/i.test(s) && /<h1/i.test(s)) return true;
          return false;
        }
        function probe(url) {
          return fetch(url, { method: "GET", cache: "no-store", credentials: "same-origin" }).then(function (r) {
            if (!r.ok) return null;
            return r.text().then(function (body) { return isRealArticle(body) ? url : null; });
          }, function () { return null; });
        }
        function tick() {
          return probe(prettyUrl).then(function (hit) {
            if (hit) return hit + "#edit";
            return probe(htmlUrl).then(function (hit2) { return hit2 ? hit2 + "#edit" : null; });
          }).then(function (dest) {
            if (dest) {
              editBar("Published — opening…", "ee-done");
              state.leaving = true;
              location.href = dest;
              return;
            }
            if (Date.now() - started >= maxMs) {
              editBar(
                'Still publishing. Try <a href="' + prettyUrl + '#edit">' + prettyUrl + '</a> or <a href="' + htmlUrl + '#edit">' + htmlUrl + '</a> in a minute.',
                "ee-bad-bar"
              );
              return;
            }
            editBar("Publishing… (" + Math.round((Date.now() - started) / 1000) + "s)", "ee-busy");
            return new Promise(function (res) { setTimeout(res, intervalMs); }).then(tick);
          });
        }
        return tick();
      });
    }).catch(function (e) {
      editBar(e.message || "Could not create article.", "ee-bad-bar");
    });
  }
  function openNewArticle() {
    if (!P.isAdmin(state.profile)) return;
    openPanel();
    var p = $("ee-panel");
    if (p) {
      p.classList.remove("ee-gal-mode");
      var box = p.querySelector(".ee-box");
      if (box) {
        box.classList.remove("ee-wide");
        box.setAttribute("aria-label", "New article");
      }
    }
    var b = $("ee-body");
    if (!b) return;
    b.innerHTML =
      '<p class="ee-k">New article</p>' +
      '<p class="ee-note">Title only — a blank page opens for editing.</p>' +
      '<form id="ee-newart-form">' +
      '<input type="text" id="ee-newart-title" class="ee-field" placeholder="Article title" autocomplete="off" spellcheck="true">' +
      '<div class="ee-row">' +
      '<button type="submit" class="ee-btn ee-primary">Create</button>' +
      '<button type="button" class="ee-btn" id="ee-newart-cancel">Cancel</button>' +
      '</div>' +
      '<p class="ee-err" id="ee-newart-err" hidden></p>' +
      '</form>';
    var input = $("ee-newart-title");
    var err = $("ee-newart-err");
    function fail(msg) {
      if (!err) return;
      err.hidden = !msg;
      err.textContent = msg || "";
    }
    $("ee-newart-cancel").onclick = function () { closePanel(); };
    $("ee-newart-form").onsubmit = function (e) {
      e.preventDefault();
      var title = String((input && input.value) || "").trim();
      if (!title) { fail("Enter a title."); if (input) input.focus(); return; }
      fail("");
      createArticleFromTitle(title);
    };
    setTimeout(function () { if (input) try { input.focus(); } catch (e) {} }, 30);
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
  /* img-resize: keep responsive-image attributes (srcset/sizes from scripts/img-resize.py)
     through a save, when every srcset candidate is a safe non-data URL. */
  function keepImgSizing(from, to) {
    var ss = from.getAttribute("srcset");
    if (ss) {
      var ok = ss.split(/,\s+/).every(function (c) {
        var m = /^(\S+)(\s+\d+(?:\.\d+)?[wx])?$/.exec(c.trim());
        return m && !/^data:/i.test(m[1]) && safeSrc(m[1]) != null;
      });
      if (ok) {
        to.setAttribute("srcset", ss);
        var sz = from.getAttribute("sizes");
        if (sz && /^[\w\s(),.:\/%-]+$/.test(sz)) to.setAttribute("sizes", sz);
      }
    }
    var ld = from.getAttribute("loading");
    if (ld === "lazy" || ld === "eager") to.setAttribute("loading", ld);
    var dc = from.getAttribute("decoding");
    if (dc === "async" || dc === "sync" || dc === "auto") to.setAttribute("decoding", dc);
    ["width", "height"].forEach(function (k) {
      var v = from.getAttribute(k);
      if (v && /^\d{1,5}$/.test(v)) to.setAttribute(k, v);
    });
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
        keepImgSizing(from, to);
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
        // Text segments only (tags are skipped below), so a source &quot; is safe to keep.
        if (!/[&<>\u00a0]/.test(ch) && !(ch in map)) { map[ch] = ent; any = true; }
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

  /* Saved regions. Every change is a small region of the page source (the body, the hero
     name, the epithet, the hero picture), located again in the latest copy of the file and
     only written when that region is still exactly as it was when editing started. */
  function escText(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
  function titleRange(T, kind) {
    var root = M.parse(T), title = null, hit = null;
    (function walk(n) {
      (n.children || []).forEach(function (c) {
        if (title) return;
        if ((c.classes || []).indexOf("art-title") >= 0 && c.tag !== "main") title = c; else walk(c);
      });
    })(root);
    if (!title) return null;
    (function walk(n) {
      (n.children || []).forEach(function (c) {
        if (hit) return;
        if (kind === "h1" ? c.tag === "h1" : (c.classes || []).indexOf("art-epithet") >= 0) hit = c; else walk(c);
      });
    })(title);
    return hit && hit.closeStart >= hit.openEnd ? { start: hit.openEnd, end: hit.closeStart } : null;
  }
  function heroRange(T, attr) {
    var re = attr === "alt"
      ? /(<section\s+class="art-hero\b[^"]*"[\s\S]*?<img\b[^>]*\salt=")([^"]*)(")/i
      : /(<section\s+class="art-hero\b[^"]*"[\s\S]*?<img\b[^>]*\ssrc=")([^"]+)(")/i;
    var m = re.exec(T);
    if (!m) return null;
    var st = m.index + m[1].length;
    return { start: st, end: st + m[2].length };
  }
  function regionOf(locate, baseText, html) {
    var r = locate(baseText);
    if (!r) return null;
    return { locate: locate, base: baseText.slice(r.start, r.end), html: html };
  }
  // Apply regions to a copy of the page; null if any region moved or changed there.
  function applyRegions(T, regions) {
    var hits = [];
    for (var i = 0; i < regions.length; i++) {
      var g = regions[i], r = g.locate(T);
      if (!r || T.slice(r.start, r.end) !== g.base) return null;
      hits.push({ start: r.start, end: r.end, html: g.html });
    }
    hits.sort(function (x, y) { return y.start - x.start; });
    for (var k = 1; k < hits.length; k++) if (hits[k].end > hits[k - 1].start) return null;
    hits.forEach(function (h) { T = T.slice(0, h.start) + h.html + T.slice(h.end); });
    return T;
  }
  function pageRegions() {
    var base = state.base.text, regions = [], g;
    if (state.page) {
      var PS = pageSrc();
      var mainEl = state.page.el;
      Array.prototype.forEach.call(mainEl.querySelectorAll(".art-title .art-epithet"), noEndPeriod);
      tidyDossier();
      var baseInner = PS.text.slice(PS.node.openEnd, PS.node.closeStart);
      var html = serializePageMain();
      if (html !== baseInner) regions.push({ locate: function (T) { var r = sourceMainRange(T); return r && { start: r.start, end: r.end }; }, base: baseInner, html: html });
    }
    (state.titles || []).forEach(function (t) {
      if (t.kind === "epithet") noEndPeriod(t.el);
      var txt = norm(t.el.textContent);
      if (txt === t.text) return;
      if (t.kind === "h1" && !txt) return; // a page always keeps its name
      g = regionOf(function (T) { return titleRange(T, t.kind); }, base, escText(txt));
      if (g) { g.html = preserveEntities(g.html, g.base); regions.push(g); }
    });
    var artsOn = !!(state.arts && artsDirty() && Media.heroParts(base));
    if (state.arts) state.arts.outMain = null;
    if (artsOn) {
      var A = state.arts, parts = Media.heroParts(base);
      var set = { main: A.main, arts: A.list.map(function (a) {
        return { src: a.src, alt: a.alt, pos: a.pos, raw: a.raw, changed: !!a.raw && a.src !== a.src0, altChanged: a.alt !== a.alt0 };
      }) };
      var hh = Media.heroArtsHtml(parts, set);
      [["head", hh.head], ["swap", hh.swap], ["script", hh.script]].forEach(function (k) {
        var key = k[0];
        var gg = regionOf(function (T) { var q = Media.heroParts(T); return q && q[key]; }, base, k[1]);
        if (gg && gg.base !== gg.html) regions.push(gg);
      });
      A.outMain = set.arts[A.main] ? set.arts[A.main].src : null;
    }
    if (artsOn || (state.hero && state.hero.viaArts)) {
      // The art set owns the hero picture (a "show" preview alone changes nothing).
    } else if (state.hero && state.hero.src && !heroRange(base, "src")) {
      // The source hero has no picture yet: write <section class="art-hero"><img ...> in its open tag.
      var heroOpen = function (T) { var m = /<section\s+class="art-hero\b[^"]*"[^>]*>/i.exec(T); return m && { start: m.index, end: m.index + m[0].length }; };
      g = regionOf(heroOpen, base, "");
      if (g) {
        g.html = g.base.replace(/(\sclass\s*=\s*")([^"]*)(")/i, function (m0, a, c, b) { return a + c.split(/\s+/).filter(function (k) { return k && k !== "no-art"; }).join(" ") + b; }) +
          '<img src="' + state.hero.src.replace(/"/g, "%22") + '" alt="' + String(state.hero.alt || "").replace(/"/g, "") + '">';
        regions.push(g);
      }
    } else if (state.hero && state.hero.src) {
      g = regionOf(function (T) { return heroRange(T, "src"); }, base, state.hero.src.replace(/"/g, "%22"));
      if (g && g.base !== g.html) regions.push(g);
      if (state.hero.alt) {
        g = regionOf(function (T) { return heroRange(T, "alt"); }, base, String(state.hero.alt).replace(/"/g, ""));
        if (g && g.base !== g.html) regions.push(g);
      }
    }
    return regions;
  }

  function buildOutput(latest) {
    if (state.page || !state.records.length) {
      var regions = pageRegions();
      if (!regions.length) return { none: true };
      var out = applyRegions(latest.text, regions);
      // Someone changed one of these regions upstream since editing started: never overwrite.
      if (out == null) return { conflict: true };
      return { out: out, regions: regions, page: !!state.page };
    }
    var changed = state.records.filter(function (r) { return r.el.innerHTML !== r.start; });
    var extra = pageRegions();
    if (!changed.length && !extra.length) return { none: true };
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
    var out2 = M.splice(latest.text, edits);
    // Self-check: same block structure, untouched blocks byte-identical.
    var after = M.sourceBlocks(out2, titleOpts());
    if (after.length !== blocks.length) throw new Error("Safety check failed (the edit would change the page structure). Nothing was saved.");
    var touched = {}; edits.forEach(function (e) { touched[e.idx] = e.html; });
    for (var k = 0; k < after.length; k++) {
      if (k in touched) { if (after[k].inner !== touched[k]) throw new Error("Safety check failed. Nothing was saved."); }
      else if (after[k].inner !== blocks[k].inner) throw new Error("Safety check failed. Nothing was saved.");
    }
    if (extra.length) {
      out2 = applyRegions(out2, extra);
      if (out2 == null) return { conflict: true };
    }
    return { out: out2, edits: edits, changed: changed, regions: extra };
  }

  // The other copy of this article (pretty URL <-> .html) gets the same regions, when
  // they are identical there; otherwise it is left alone and the bar says so.
  function mirrorFor(ref, regions) {
    var mp = P.mirrorPath ? P.mirrorPath(PATH) : null;
    if (!mp || !regions || !P.canEdit(state.profile, mp)) return Promise.resolve(null);
    return E.getFile(mp, ref).then(function (f) {
      var out = applyRegions(f.text, regions);
      return out == null ? { path: mp, skipped: true } : (out === f.text ? null : { path: mp, text: out, sha: f.sha, base: f.text });
    }, function () { return null; });
  }

  /* New hero art on an article also goes on its Index card(s), when the card has no art yet or
     showed the old hero art (both Index copies, same commit). */
  var INDEX_FILES = ["index/ancients/index.html", "index/ancients.html"];
  function cardArtFor(heroSrc, oldKey, ref, ren) {
    var slug = (/^articles\/([^\/]+?)(?:\/index)?\.html$/.exec(PATH) || [])[1];
    /* Every save (not only a rename): the article's cards always show its current name/epithet. */
    var renamed = !!(ren && ren.newName && Media && Media.renameIndexCards);
    if (heroSrc && /^blob:/.test(heroSrc)) heroSrc = null;
    var asset = heroSrc ? String(heroSrc).replace(/^(\.\.\/)+|^\//, "") : null;
    if (asset && !/^assets\//.test(asset)) asset = null;
    if ((!asset && !renamed) || !slug || !Media || !Media.setCardArt) return Promise.resolve([]);
    var files = INDEX_FILES.filter(function (p) { return P.canEdit(state.profile, p); });
    if (files.length < INDEX_FILES.length) state.syncSkipped = (state.syncSkipped || 0) + (INDEX_FILES.length - files.length);
    return Promise.all(files.map(function (p) {
      return E.getFile(p, ref).then(function (f) {
        var out = f.text;
        if (asset) out = Media.setCardArt(out, slug, asset, function (old) { return !old || (oldKey && old === oldKey); });
        if (renamed) out = Media.renameIndexCards(out, slug, ren.oldName, ren.newName || ren.oldName, ren.oldEpithet, ren.newEpithet, true);
        if (Media.sortIndex) out = Media.sortIndex(out); // ia1: a renamed card moves to its A to Z place in the same save
        return out !== f.text ? { path: p, text: out, base: f.text } : null;
      }, function () { return null; });
    })).then(function (list) { return list.filter(Boolean); });
  }

  function save() {
    if (!state.editing || state.busy) return;
    state.busy = true;
    var pr = state.profile, mode = P.saveMode(pr);
    var msg = "Edit " + PATH + " via edit mode [edit-mode]";
    var s = E.session.get();
    editBar("Saving\u2026", "ee-busy");
    var latestRef, branch, prep = { files: [], used: [] }, undoPending = null, mirror = null, baseText = null, cards = [];
    var p = preparePending().then(function (pp) { if (pp && pp.files) prep = pp; });
    /* One try: read the latest main, re-apply the edits on top of it (buildOutput merges the
       edited regions into whatever is there now), commit with that commit as parent. A save
       that races another push is re-run from here (E.retrySave), never dropped. */
    var attempt = function (latest) {
      var r;
      if (prep.used.length) undoPending = applyPending(prep);
      baseText = latest.text;
      try { r = buildOutput(latest); } finally { if (undoPending) undoPending(); }
      if (r.none) { editBar("No changes to save."); return null; }
      if (r.conflict) { var e = new Error(conflictMsg()); e.conflict = true; throw e; }
      var heroSrc = state.hero && !state.hero.viaArts ? state.hero.src : null, oldHero = state.hero && state.hero.oldKey;
      var A = state.arts;
      if (A && A.outMain && imgKey(A.outMain) !== A.main0Key) { heroSrc = A.outMain; oldHero = A.main0Key; }
      else if (A && !heroSrc) oldHero = null;
      var ren = renameInfo();
      if (heroSrc && /^\/?assets\//.test(String(heroSrc).replace(/^\//, "")) && oldHero) { ren.oldArt = oldHero; ren.newArt = heroSrc; }
      state.syncSkipped = 0;
      var headFix = function (t) { return (ren.renamed || ren.epithet || ren.newArt) && Media.renameHead ? Media.renameHead(t, ren) : t; };
      var railFix = function (t) { var sl = articleSlugOfPath(); return ren.renamed && sl ? Media.renameArticleLinks(t, sl, ren.oldName, ren.newName) : t; };
      r.out = railFix(headFix(r.out));
      return Promise.all([mirrorFor(latestRef, r.edits ? null : r.regions), cardArtFor(heroSrc, oldHero, latestRef, ren)]).then(function (both) {
        var m = both[0];
        if (m && !m.skipped) m.text = railFix(headFix(m.text));
        var skip = [PATH].concat(m && m.path ? [m.path] : []).concat(INDEX_FILES);
        return syncOthers(ren, latestRef, skip).then(function (others) {
          state.syncSkipped += others.skipped;
          return [m, both[1], others.files];
        });
      }).then(function (both) {
        var m = both[0];
        mirror = m; cards = both[1];
        var files = [{ path: PATH, text: r.out }];
        if (m && !m.skipped) files.push({ path: m.path, text: m.text });
        cards.forEach(function (c) { files.push({ path: c.path, text: c.text }); });
        (both[2] || []).forEach(function (c) { files.push({ path: c.path, text: c.text }); });
        if ((ren.renamed || heroSrc) && state.syncSkipped && !P.isAdmin(state.profile)) state.syncNote = " The Index card and other pages keep the old " + (ren.renamed ? "name" : "art") + " until Devin updates them.";
        else state.syncNote = "";
        files = files.concat(prep.files);
        if (prep.used.length) msg = "Edit " + PATH + " via edit mode (+" + prep.used.length + " image" + (prep.used.length > 1 ? "s" : "") + ") [edit-mode]";
        var one = files.length === 1;
        if (mode === "direct") {
          return (one ? E.putFile(PATH, r.out, latest.sha, msg, E.BRANCH) : E.commitFiles(files, msg, E.BRANCH, latestRef))
            .then(function (res) { return { res: res, r: r, multi: !one }; });
        }
        branch = "edit/" + slug(s.login) + "/" + slug(PATH) + "-" + stamp();
        return E.api(E.repoPath("/git/refs"), { method: "POST", body: { ref: "refs/heads/" + branch, sha: latestRef } })
          .then(function () { return one ? E.putFile(PATH, r.out, latest.sha, msg, branch) : E.commitFiles(files, msg, branch, latestRef); })
          .then(function (res) {
            return E.api(E.repoPath("/pulls"), { method: "POST", body: {
              title: "Edit " + PATH + " via edit mode",
              head: branch, base: E.BRANCH,
              body: "Proposed in edit mode by @" + s.login + ".\n\nOnly the edited regions of `" + PATH + "`" + (files.length > 1 ? " (and its copies/images)" : "") + " changed. The edit-guard check verifies the author is allowed to edit this path.\n\n[edit-mode]"
            } }).then(function (pull) { return { res: res, r: r, pull: pull, multi: !one }; }, function (err) { return { res: res, r: r, pullErr: err, multi: !one }; });
          });
      });
    };
    p.then(function () {
      return E.retrySave(function () {
        return E.headSha(E.BRANCH).then(function (sha) { latestRef = sha; return E.getFile(PATH, sha); }).then(attempt);
      }, function (n) { editBar("Someone else saved at the same time \u2014 retrying (" + n + "/3)\u2026", "ee-busy"); });
    }).then(function (done) {
      if (!done) return;
      var commitUrl = done.multi ? (done.res && done.res.html_url) : (done.res && done.res.commit && done.res.commit.html_url);
      if (mode === "direct") {
        // A reload before the site rebuilds shows this saved copy (this browser only, recent.js).
        if (R) {
          R.remember([{ path: PATH, text: done.r.out, base: baseText }].concat(mirror && !mirror.skipped ? [{ path: mirror.path, text: mirror.text, base: mirror.base }] : [], cards));
          var imgs = (prep.used || []).filter(function (u) { return u.entry && u.blob; }).map(function (u) { return { path: u.entry.path, blob: u.blob }; });
          if (imgs.length && R.rememberImages) R.rememberImages(imgs);
        }
        state.base = {
          sha: done.multi ? null : done.res.content.sha,
          text: done.r.out,
          blocks: done.r.page ? null : M.sourceBlocks(done.r.out, titleOpts())
        };
        if (state.page) {
          state.page.original = state.page.el.innerHTML;
          state.page.range = sourceMainRange(done.r.out) || state.page.range;
        }
      }
      state.records.forEach(function (rec) { rec.original = rec.el.innerHTML; });
      // New pictures keep showing from memory until the site has them; the page (and the next
      // save) treats them as their real /assets/ files.
      (prep.used || []).forEach(function (u) {
        if (u.art) { u.art.src = u.rel; u.art.blobUrl = u.pd && u.pd.url; u.art.pending = null; return; }
        var im = u.img || (u.hero && state.hero && state.hero.el);
        if (!im) return;
        im.removeAttribute("data-ee-pending");
        if (u.rel) { im.setAttribute("data-eimg-orig", u.rel); im.setAttribute("data-eimg-fell", "1"); }
      });
      if (state.arts && artsDirty() && mode === "direct") { try { refreshHeroDom(done.r.out); } catch (eh) {} }
      state.hero = null; state.pending = {};
      stopEditing();
      state.arts = null;
      state.page = null;
      var note = (mirror && mirror.skipped ? " The other copy (" + esc(mirror.path) + ") differs here and was left unchanged." : "") + esc(state.syncNote || "");
      var html;
      if (mode === "direct") {
        html = '<span class="ee-msg ee-good">Saved at ' + esc(new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })) + '.' + note + '</span>';
      } else if (done.pull) {
        html = '<span class="ee-msg ee-good">Proposed as pull request #' + esc(done.pull.number) + '. Live about 1\u20132 minutes after it is merged.' + note + ' <a href="' + esc(done.pull.html_url) + '" target="_blank" rel="noopener">Open</a></span>';
      } else {
        html = '<span class="ee-msg ee-good">Saved to branch ' + esc(branch) + '. Opening the pull request failed (' + esc(done.pullErr && done.pullErr.message) + ').' + note + ' <a href="https://github.com/' + E.REPO + '/compare/' + E.BRANCH + '...' + encodeURIComponent(branch) + '" target="_blank" rel="noopener">Open one</a></span>';
      }
      bar(html + '<button type="button" class="ee-btn" id="ee-x">Close</button>', "ee-done");
      $("ee-x").onclick = closeBar;
    }).catch(function (err) {
      var m;
      if (err.race) m = E.RACE_MSG;
      else if (err.conflict || err.status === 409 || (err.status === 422 && /sha|match|fast.forward/i.test(err.message))) m = conflictMsg();
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
    if (state.editing || state.busy) {
      clearEditHash();
      // Recover a lost edit bar (never leave edit mode without Save/Cancel).
      if (state.editing && !state.busy && !$("ee-bar")) editBar();
      return true;
    }
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
        // GitHub rejected the remembered token too: forget it (the linked flag stays, so
        // this browser still gets the paste-only reconnect, not first-time onboarding).
        if (err2.status === 401) { E.session.clear(); notify(); bootExpired = true; softReconnect(); }
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
  // Edit mode starts only after recent.js has put a just-saved copy in place (or found none).
  var profileReady = Promise.all([loadProfile(), R ? R.ready : null]).then(function () { glyph(); });
  function onHash() {
    if (location.hash !== "#edit") return;
    profileReady.then(decideEditHash);
  }
  window.addEventListener("hashchange", onHash);
  profileReady.then(decideEditHash);

  /* ---------------- Deleting (Devin only): articles, and what points at them ---------------- */
  /* A small confirm dialog in the editor panel. o: { title, lines:[html], groups:[{ name, options:[{ value, label, checked }], showIf }],
     selects:[{ name, label, options:[{ value, label }], showIf }], checks:[{ name, label, showIf }], ok }.
     showIf: { name: value } (shown only while that choice is picked). Resolves the picked values, or null. */
  function deleteDialog(o) {
    return new Promise(function (resolve) {
      openPanel();
      var b = $("ee-body"), done = false;
      var cond = function (x) { return x.showIf ? ' data-show-if="' + esc(JSON.stringify(x.showIf)) + '"' : ""; };
      b.innerHTML = '<p class="ee-k">' + esc(o.title) + '</p>' + (o.lines || []).map(function (l) { return '<p class="ee-note">' + l + '</p>'; }).join("") +
        (o.groups || []).map(function (g) {
          return '<fieldset class="ee-del-group"' + cond(g) + '>' + g.options.map(function (op) {
            return '<label class="ee-del-opt"><input type="radio" name="ee-del-' + esc(g.name) + '" value="' + esc(op.value) + '"' + (op.checked ? " checked" : "") + '> <span>' + op.label + '</span></label>';
          }).join("") + '</fieldset>';
        }).join("") +
        (o.selects || []).map(function (s) {
          return '<label class="ee-del-opt ee-del-sel"' + cond(s) + '><span>' + esc(s.label) + '</span> <select class="ee-field" id="ee-del-' + esc(s.name) + '">' +
            s.options.map(function (op) { return '<option value="' + esc(op.value) + '">' + esc(op.label) + '</option>'; }).join("") + '</select></label>';
        }).join("") +
        (o.checks || []).map(function (c) {
          return '<label class="ee-del-opt"' + cond(c) + '><input type="checkbox" id="ee-del-' + esc(c.name) + '"' + (c.checked ? " checked" : "") + '> <span>' + c.label + '</span></label>';
        }).join("") +
        '<p class="ee-note ee-del-restore">Everything stays in the site\u2019s history, so it can be restored.</p>' +
        '<div class="ee-row"><button type="button" class="ee-btn" id="ee-del-cancel">Cancel</button><button type="button" class="ee-btn ee-primary ee-danger" id="ee-del-ok">' + esc(o.ok || "Delete") + '</button></div>';
      var vals = function () {
        var v = {};
        (o.groups || []).forEach(function (g) { var r = b.querySelector('input[name="ee-del-' + g.name + '"]:checked'); v[g.name] = r ? r.value : null; });
        (o.selects || []).forEach(function (s) { v[s.name] = $("ee-del-" + s.name).value; });
        (o.checks || []).forEach(function (c) { v[c.name] = $("ee-del-" + c.name).checked; });
        return v;
      };
      var refresh = function () {
        var v = vals();
        Array.prototype.forEach.call(b.querySelectorAll("[data-show-if]"), function (n) {
          var c = JSON.parse(n.getAttribute("data-show-if")); n.hidden = !Object.keys(c).every(function (k) { return v[k] === c[k]; });
        });
      };
      b.addEventListener("change", refresh); refresh();
      var p = $("ee-panel");
      var finish = function (val) {
        if (done) return; done = true; obs.disconnect();
        if (val) { var v = vals(); Array.prototype.forEach.call(b.querySelectorAll("[data-show-if]"), function (n) { if (n.hidden) { var i = n.querySelector("input,select"); if (i) v[(i.name || i.id).replace(/^ee-del-/, "")] = null; } }); val = v; }
        closePanel(); resolve(val);
      };
      var obs = new MutationObserver(function () { if (p.hidden) finish(null); });
      obs.observe(p, { attributes: true, attributeFilter: ["hidden"] });
      $("ee-del-cancel").onclick = function () { finish(null); };
      $("ee-del-ok").onclick = function () { finish(true); };
      $("ee-del-ok").focus();
    });
  }

  var DEL_SKIP = /^(?:edit|assets|tools|scripts|_verify|docs|saved|node_modules|foundry-welcome)\//;
  function slugOfArticlePath(p) { return (/^articles\/([^\/]+?)(?:\/index)?\.html$/.exec(p) || [])[1] || null; }
  /* Everything one commit needs to delete these articles (o.slugs, both copies each) and drop what points
     at them: Index cards (both copies, unless o.indexText: the organizer builds those), other pages' rails,
     related lists, mast marks and links (made plain text), search index, sitemap, players' editable lists,
     visibility entries, and gallery entries of art no other page uses (the image files stay in assets/).
     o.sections: removed top-level Index sections (their rail groups go everywhere); o.anchors: removed
     Index anchors, o.moveTo { slug: anchor } (moved cards' articles link back there). */
  function planDelete(o) {
    if (!P.isAdmin(state.profile)) return Promise.reject(new Error("Only Devin can delete articles."));
    var ref = o.ref, slugs = o.slugs || [], secs = o.sections || [], anchors = (o.anchors || []).concat(secs), moveTo = o.moveTo || {};
    var gone = {}; slugs.forEach(function (s) { gone["articles/" + s + ".html"] = 1; gone["articles/" + s + "/index.html"] = 1; });
    var out = { files: [], deletes: [], dropped: [], kept: [], names: {}, owners: {}, pages: 0 };
    var finalText = {}, imgs = [];
    return E.listTree(ref).then(function (all) {
      var have = {}; all.forEach(function (p) { have[p] = 1; });
      out.deletes = Object.keys(gone).filter(function (p) { return have[p]; }).map(function (p) { return { path: p, delete: true }; });
      var pages = all.filter(function (p) { return /\.html$/.test(p) && !DEL_SKIP.test(p) && !gone[p]; });
      var live = {};
      var own = eachLimit(out.deletes, 4, function (d) {
        return E.getFile(d.path, ref).then(function (f) {
          Media.articleImages(f.text).forEach(function (k) { if (imgs.indexOf(k) < 0) imgs.push(k); });
          var h = /<div class="art-title">\s*<h1>([\s\S]*?)<\/h1>/.exec(f.text), s = slugOfArticlePath(d.path);
          if (h && !out.names[s]) out.names[s] = h[1].replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").trim();
        }, function () {});
      });
      // What links here: read the built site (cheap), then the repo copy of just those pages.
      var scan = eachLimit(pages, 8, function (p) {
        return fetch("/" + p, { cache: "no-store" }).then(function (r) { return r.ok ? r.text() : null; }).then(function (t) { live[p] = t; }, function () { live[p] = null; });
      });
      return Promise.all([own, scan]).then(function () {
        if (o.indexText) INDEX_FILES.forEach(function (p) { live[p] = o.indexText; });
        var hits = pages.filter(function (p) {
          if (o.indexText && INDEX_FILES.indexOf(p) >= 0) return false;
          var t = live[p];
          if (t == null) return true;
          if (slugs.some(function (s) { return Media.linksTo(t, s); })) return true;
          if (anchors.some(function (a) { return t.indexOf('#' + a + '"') >= 0; })) return true;
          return !!moveTo[slugOfArticlePath(p)];
        });
        return eachLimit(hits, 6, function (p) {
          return E.getFile(p, ref).then(function (f) {
            var t = f.text, sl = slugOfArticlePath(p);
            if (INDEX_FILES.indexOf(p) >= 0) { t = Media.removeIndexCards(t, slugs); if (Media.sortIndex) t = Media.sortIndex(t); }
            slugs.forEach(function (s) { t = Media.unlinkArticle(t, s); });
            secs.forEach(function (id) { t = Media.removeRailSection(t, id); });
            var bk = Media.artBackOf(t), hash = bk && bk.indexOf("#") >= 0 ? bk.slice(bk.indexOf("#") + 1) : null;
            if (sl && hash && anchors.indexOf(hash) >= 0) t = Media.setArtBack(t, "/index/ancients/" + (moveTo[sl] ? "#" + moveTo[sl] : (o.fallback && o.fallback[hash] ? "#" + o.fallback[hash] : "")));
            finalText[p] = t;
            if (t !== f.text) out.files.push({ path: p, text: t, base: f.text });
          }, function () {});
        }).then(function () {
          pages.forEach(function (p) { if (!(p in finalText)) finalText[p] = live[p] || ""; });
          out.pages = out.files.length;
          // Data files.
          var data = [["search-index.js", function (t) { slugs.forEach(function (s) { t = Media.removeSearchEntry(t, s); }); return t; }],
            ["sitemap.xml", function (t) { slugs.forEach(function (s) { t = Media.removeSitemap(t, s); }); return t; }],
            ["edit/profiles.json", function (t) { slugs.forEach(function (s) { var ow = Media.ownersOf(t, s); if (ow.length) out.owners[s] = ow; t = Media.pruneProfiles(t, s, out.names[s]); }); return t; }],
            ["edit/visibility.json", function (t) { slugs.forEach(function (s) { t = Media.pruneVisibility(t, s); }); return t; }]];
          if (imgs.length) {
            imgs.forEach(function (k) {
              var used = pages.some(function (p) { return Media.usesImage(finalText[p], k); });
              (used ? out.kept : out.dropped).push(k);
            });
            if (out.dropped.length) data.push([Media.CATALOG, function (t) { return Media.pruneCatalog(t, out.dropped); }]);
          }
          return eachLimit(data.filter(function (d) { return have[d[0]]; }), 4, function (d) {
            return E.getFile(d[0], ref).then(function (f) { var t = d[1](f.text); if (t !== f.text) out.files.push({ path: d[0], text: t, base: f.text }); }, function () {});
          });
        });
      });
    }).then(function () { return out; });
  }

  function deleteArticleFlow() {
    var slug = articleSlugOfPath();
    if (!slug || !P.isAdmin(state.profile) || state.busy) return;
    if (state.dirty && !window.confirm("You have unsaved changes on this page. Discard them and delete the article?")) return;
    var name = norm(((document.querySelector(".art-title h1") || {}).textContent) || slug);
    editBar("Checking what links to \u201c" + name + "\u201d\u2026", "ee-busy");
    Promise.all([
      E.getFile(INDEX_FILES[0]).then(function (f) { return (f.text.match(new RegExp('<a\\b[^>]*class="index-card[^"]*"[^>]*href="/articles/' + slug.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + '/"', "g")) || []).length; }, function () { return 0; }),
      E.getFile("edit/profiles.json").then(function (f) { return Media.ownersOf(f.text, slug); }, function () { return []; })
    ]).then(function (r) {
      var n = r[0], owners = r[1];
      editBar();
      return deleteDialog({
        title: "Delete \u201c" + name + "\u201d?",
        lines: ["Removes this article (both copies of the page)" + (n ? ", its " + (n > 1 ? n + " Index cards" : "Index card") : "") +
          ", and the links to it on other pages (they become plain text), in one commit.",
          owners.length ? "<strong>This is " + esc(owners.map(function (o) { return o.charAt(0).toUpperCase() + o.slice(1); }).join(" and ")) + "\u2019s character.</strong> They will no longer be able to edit it." : ""].filter(Boolean),
        ok: "Delete article"
      });
    }).then(function (v) {
      if (!v) { editBar(); return; }
      state.busy = true;
      editBar("Deleting\u2026", "ee-busy");
      var ref;
      return E.retrySave(function () {
        return E.headSha(E.BRANCH).then(function (sha) { ref = sha; return planDelete({ slugs: [slug], ref: ref }); }).then(function (plan) {
          var files = plan.files.concat(plan.deletes);
          return E.commitFiles(files, "Delete article \u201c" + name + "\u201d (articles/" + slug + ") + clean up " + plan.pages + " page" + (plan.pages === 1 ? "" : "s") + " [edit-mode]", E.BRANCH, ref).then(function () { return plan; });
        });
      }, function (n) { editBar("Someone else saved at the same time \u2014 retrying (" + n + "/3)\u2026", "ee-busy"); }).then(function (plan) {
        state.busy = false;
        var R = window.EloraeRecent;
        if (R) R.remember(plan.files.filter(function (f) { return INDEX_FILES.indexOf(f.path) >= 0; }));
        state.dirty = false;
        var back = (document.querySelector("a.art-back") || {}).getAttribute ? document.querySelector("a.art-back").getAttribute("href") : "/index/ancients/";
        editBar("Deleted \u201c" + name + "\u201d. " + "Saved at " + new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) + ". Going to the Index\u2026", "ee-done");
        window.EloraeEditor.lastDelete = plan;
        setTimeout(function () { state.leaving = true; location.href = (back && /^\/index\//.test(back) ? back : "/index/ancients/"); }, 1200);
      }).catch(function (err) {
        state.busy = false;
        editBar(err.message || "Delete failed.", "ee-bad-bar");
      });
    });
  }

  window.EloraeEditor = { openGalleryManager: openGalleryManager, openArtPicker: openArtPicker, sanitize: sanitize, preserveEntities: preserveEntities, state: state, startEdit: startEdit, save: save, cancel: cancelEdit, path: PATH, openPanel: openPanel, glyph: glyph, tryEnterEdit: tryEnterEdit, onHash: onHash, deleteDialog: deleteDialog, planDelete: planDelete, deleteArticle: deleteArticleFlow };
})();
