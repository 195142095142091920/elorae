/* Elorae edit mode bootstrap (the only file referenced from site pages).
   For anonymous visitors this does nothing: no DOM, no styles, no network requests.
   It wakes up only when the URL hash is #edit or an editor session already exists in this
   browser, and (for an admin edit session) adds a bare DASHBOARD link to the top nav. */
(function () {
  "use strict";
  var KEY = "elorae-edit-session";
  var me = document.currentScript;
  var src = me ? me.getAttribute("src") : "edit/edit.js";
  var base = new URL(src, location.href);
  var V = (base.search || "").replace(/^\?/, "");

  function readSession() {
    try {
      var ls = localStorage.getItem(KEY);
      var ss = sessionStorage.getItem(KEY);
      function parseOne(raw) {
        if (raw == null || raw === "") return null;
        var s = JSON.parse(raw);
        if (typeof s === "string") {
          try { s = JSON.parse(s); } catch (e0) { return null; }
        }
        if (!s || typeof s !== "object") return null;
        var tok = String(s.token || s.access_token || s.ghToken || "").replace(/^Bearer\s+/i, "").replace(/\s+/g, "");
        var login = s.login || s.user || s.username || "";
        if (!tok || !login) return null;
        if (!/^(ghp_|github_pat_|gho_|ghu_|ghs_)/.test(tok)) return null;
        s.token = tok; s.login = login;
        return s;
      }
      /* Invalid LS must not shadow a good SS Connect (same heal as core.js). */
      var sLs = null, sSs = null;
      try { sLs = parseOne(ls); } catch (e1) { sLs = null; }
      try { sSs = parseOne(ss); } catch (e2) { sSs = null; }
      var s = sLs || sSs;
      if (!s) return null;
      if (sLs && sSs) s = sLs;
      try {
        var healed = JSON.stringify(s);
        localStorage.setItem(KEY, healed);
        sessionStorage.setItem(KEY, healed);
      } catch (e3) {}
      return s;
    } catch (e) { return null; }
  }
  function wanted() { return location.hash === "#edit" || !!readSession(); }

  function load(file) {
    return new Promise(function (res, rej) {
      var el = document.createElement("script");
      el.src = new URL(file + (V ? "?" + V : ""), base).href;
      el.onload = res; el.onerror = rej;
      document.head.appendChild(el);
    });
  }

  /* Your own save from the last few minutes (edit/recent.js): hide the body until recent.js has
     compared it with the page the site served, so an out-of-date copy never flashes. Only with an
     edit session in this browser; without one the kept copy is simply dropped. */
  var RECENT = "elorae-edit-recent";
  function recentWait() {
    try {
      var raw = localStorage.getItem(RECENT);
      if (!raw) return;
      if (!readSession()) { localStorage.removeItem(RECENT); try { indexedDB.deleteDatabase("elorae-edit-recent-img"); } catch (e1) {} return; }
      var o = JSON.parse(raw), p = decodeURIComponent(location.pathname).replace(/^\//, ""), m;
      if (p === "" || /\/$/.test(p)) p += "index.html";
      else if (!/\.[a-z0-9]+$/i.test(p)) p += ".html";
      var alt = (m = /^(.+)\/index\.html$/.exec(p)) ? m[1] + ".html" : ((m = /^(.+)\.html$/.exec(p)) && !/(^|\/)index$/.test(m[1]) ? m[1] + "/index.html" : "");
      var f = o && o.files && (o.files[p] || o.files[alt]);
      if (!f || !(Date.now() - f.at < 180000)) return;
      var st = document.createElement("style");
      st.textContent = "html.ee-recent-wait main,html.ee-recent-wait section.art-hero{visibility:hidden}";
      document.head.appendChild(st);
      document.documentElement.classList.add("ee-recent-wait");
      setTimeout(function () { document.documentElement.classList.remove("ee-recent-wait"); }, 2500);
    } catch (e) {}
  }

  var started = false;
  function start() {
    if (started) return; started = true;
    var css = document.createElement("link");
    css.rel = "stylesheet"; css.href = new URL("edit.css" + (V ? "?" + V : ""), base).href;
    document.head.appendChild(css);
    ["core.js", "perms.js", "srcmap.js", "recent.js", "media.js", "crypto.js", "vis.js", "visset.js", "editor.js", "index-org.js"].reduce(function (p, f) {
      return p.then(function () { return load(f); });
    }, Promise.resolve()).catch(function () {});
  }

  // DASHBOARD link: only while a GitHub admin edit session is active (role/person
  // stamped at sign-in after profiles.json check). Friend login alone never grants it.
  // Prepend so the phone friends row shows it without swiping.
  function dash() {
    var s = readSession();
    var isAdmin = !!(s && (s.role === "admin" || s.person === "devin"));
    var existing = document.getElementById("ee-dash");
    if (!isAdmin) { if (existing) existing.remove(); var gl = document.getElementById("ee-gallery"); if (gl) gl.remove(); return; }
    if (existing) existing.remove();
    if (document.getElementById("ee-gallery")) return;
    var mark = document.querySelector(".mast .topbar > .mark") || document.querySelector(".mast .mark");
    if (!mark) return;
    var st = document.getElementById("ee-dash-style");
    if (!st) {
      st = document.createElement("style");
      st.id = "ee-dash-style";
      st.textContent = ".mast .topbar > .mark > .ee-dash,.mast .mark > .ee-dash{display:inline-flex;align-items:center;flex:0 0 auto;min-height:44px;margin-right:14px;font-family:\"Helvetica Neue\",Helvetica,Arial,sans-serif;font-size:calc((11px) * var(--fs,1.5094));font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:#f3eee6;text-decoration:none;background:none;border:0}.mast .topbar > .mark > .ee-dash:hover,.mast .mark > .ee-dash:hover,.mast .topbar > .mark > .ee-dash:focus-visible,.mast .mark > .ee-dash:focus-visible{color:#fff;outline:none;text-shadow:0 0 16px rgba(243,238,230,.95),0 0 32px rgba(243,238,230,.55)}";
      document.head.appendChild(st);
    }
    gallery(mark, null);
  }
  /* GALLERY link (admin only, every page), right after DASHBOARD: opens the gallery manager
     (editor.js openGalleryManager) without entering edit mode. Same styling as DASHBOARD. */
  function gallery(mark, dashEl) {
    if (document.getElementById("ee-gallery") || document.body.classList.contains("login-page")) return;
    var g = document.createElement("a");
    g.id = "ee-gallery";
    g.className = "ee-dash ee-gallery-link";
    g.href = "#gallery";
    g.textContent = "Gallery";
    g.setAttribute("aria-label", "Open the art gallery");
    g.addEventListener("click", function (e) {
      e.preventDefault();
      start();
      var n = 0, t = setInterval(function () {
        n++;
        var Ed = window.EloraeEditor;
        if (Ed && Ed.openGalleryManager) { clearInterval(t); Ed.openGalleryManager(); }
        else if (n > 100) clearInterval(t);
      }, 50);
    });
    mark.insertBefore(g, mark.firstChild);
  }


  /* nd2: Edit (nav, editor, #edit panel) exists only for Devin. */
  function devinOnly() {
    if (phraseIsDevin()) return true;
    var s = readSession();
    return !!(s && (s.role === "admin" || s.person === "devin"));
  }
  function phraseIsDevin() {
    try {
      if (document.body.classList.contains("login-devin")) return true;
      var w = localStorage.getItem("elorae-login") || localStorage.getItem("elorae-seal") || "";
      return w === "devin";
    } catch (e) { return false; }
  }

  /* On-page Edit in the top nav. Signed-in Devin (owner) gets it on every page from here, with no
     #edit URL typing or re-phrase. On article pages the editor (editor.js) also adds it for a player
     who may edit that article (EloraeEditNav.add) — it replaces the floating EDIT glyph there, which
     sat on the hero art over the Arts arrows. */
  function editAffordance() {
    var existing = document.getElementById("ee-edit");
    if (document.body.classList.contains("login-page")) {
      if (existing) existing.remove();
      return;
    }
    var allow = phraseIsDevin();
    if (!allow) {
      var s = readSession();
      allow = !!(s && (s.role === "admin" || s.person === "devin"));
    }
    if (!allow) { if (existing) existing.remove(); return; }
    if (existing) { existing.removeAttribute("data-ee-by-editor"); return; }
    navButton();
  }
  function navButton() {
    var existing = document.getElementById("ee-edit");
    if (existing) return existing;
    var mark = document.querySelector(".mast .topbar > .mark") || document.querySelector(".mast .mark");
    if (!mark) return;
    var a = document.createElement("a");
    a.id = "ee-edit";
    a.className = "ee-edit";
    a.href = "#edit";
    a.textContent = "Edit";
    a.setAttribute("aria-label", "Edit this page");
    a.addEventListener("click", function (e) {
      e.preventDefault();
      start();
      function kick() {
        var Ed = window.EloraeEditor;
        try {
          if (window.EloraeEdit && EloraeEdit.session && EloraeEdit.session.salvage) EloraeEdit.session.salvage();
        } catch (eSal) {}
        /* Prefer entering edit when login Connect already stored a token — never bounce to Make-token. */
        if (Ed && Ed.tryEnterEdit && Ed.tryEnterEdit()) return;
        if (Ed && Ed.onHash) {
          if (location.hash !== "#edit") location.hash = "#edit";
          Ed.onHash();
          return;
        }
        if (location.hash !== "#edit") location.hash = "#edit";
      }
      /* If editor already booted and hash is already #edit, hashchange will not fire — kick directly. */
      if (window.EloraeEditor) kick();
      else if (location.hash !== "#edit") location.hash = "#edit";
      else {
        var n = 0, t = setInterval(function () {
          n++;
          if (window.EloraeEditor || n > 40) { clearInterval(t); kick(); }
        }, 50);
      }
    });
    var st = document.getElementById("ee-edit-style");
    if (!st) {
      st = document.createElement("style");
      st.id = "ee-edit-style";
      st.textContent = ".mast .topbar > .mark > .ee-edit,.mast .mark > .ee-edit{display:inline-flex;align-items:center;flex:0 0 auto;min-height:44px;margin-right:14px;font-family:\"Helvetica Neue\",Helvetica,Arial,sans-serif;font-size:calc((11px) * var(--fs,1.5094));font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:#f3eee6;text-decoration:none;background:none;border:0;cursor:pointer}.mast .topbar > .mark > .ee-edit:hover,.mast .mark > .ee-edit:hover,.mast .topbar > .mark > .ee-edit:focus-visible,.mast .mark > .ee-edit:focus-visible{color:#fff;outline:none;text-shadow:0 0 16px rgba(243,238,230,.95),0 0 32px rgba(243,238,230,.55)}";
      document.head.appendChild(st);
    }
    /* Place Edit after Dashboard if present, else at start of mark. */
    var dashEl = document.getElementById("ee-gallery") || document.getElementById("ee-dash");
    if (dashEl && dashEl.nextSibling) mark.insertBefore(a, dashEl.nextSibling);
    else if (dashEl) mark.appendChild(a);
    else mark.insertBefore(a, mark.firstChild);
    return a;
  }
  window.EloraeEditNav = {
    add: function () {
      if (!devinOnly()) return null;
      var had = document.getElementById("ee-edit");
      var a = navButton();
      if (a && !had) a.setAttribute("data-ee-by-editor", "");
      return a;
    },
    remove: function () {
      var a = document.getElementById("ee-edit");
      if (a && a.hasAttribute("data-ee-by-editor")) a.remove();
    }
  };

  function init() {
    /* Login page: core.js is already loaded for Connect; do not boot editor.js here —
       loadProfile/expired() would clear a remembered token and re-show Connect on Welcome. */
    if (document.body && document.body.classList.contains("login-page")) {
      dash();
      editAffordance();
      return;
    }
    dash();
    editAffordance();
    recentWait();
    if (wanted() && devinOnly()) start();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
  window.addEventListener("hashchange", function () { if (location.hash === "#edit" && devinOnly()) start(); });
  window.addEventListener("elorae-edit-session", function () { dash(); editAffordance(); });
})();

/* eb2: press ripple on the editor bars' buttons (pure decoration, never saved). */
(function () {
  document.addEventListener("pointerdown", function (e) {
    var b = e.target && e.target.closest && e.target.closest("#ee-bar .ee-btn, #ee-stylebar .ee-glyph-btn");
    if (!b || (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches)) return;
    var r = b.getBoundingClientRect(), d = Math.max(r.width, r.height) * 2.2, s = document.createElement("span");
    s.className = "ee-ripple"; s.setAttribute("aria-hidden", "true");
    s.style.cssText = "width:" + d + "px;height:" + d + "px;left:" + (e.clientX - r.left - d / 2) + "px;top:" + (e.clientY - r.top - d / 2) + "px";
    b.appendChild(s); setTimeout(function () { s.remove(); }, 520);
  }, true);
})();
