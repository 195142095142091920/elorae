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
      var raw = ls || ss;
      var s = raw ? JSON.parse(raw) : null;
      if (!s || !s.token || !s.login) return null;
      /* Promote remembered tab-only sessions so Edit survives a reload. */
      if (!ls && s.remember) { try { localStorage.setItem(KEY, raw); } catch (e2) {} }
      if (ls && ss && ls !== ss) { try { sessionStorage.setItem(KEY, ls); } catch (e2) {} }
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

  var started = false;
  function start() {
    if (started) return; started = true;
    var css = document.createElement("link");
    css.rel = "stylesheet"; css.href = new URL("edit.css" + (V ? "?" + V : ""), base).href;
    document.head.appendChild(css);
    ["core.js", "perms.js", "srcmap.js", "media.js", "crypto.js", "vis.js", "editor.js", "index-org.js"].reduce(function (p, f) {
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
    if (!isAdmin) { if (existing) existing.remove(); return; }
    if (existing) return;
    var mark = document.querySelector(".mast .topbar > .mark") || document.querySelector(".mast .mark");
    if (!mark) return;
    var a = document.createElement("a");
    a.id = "ee-dash";
    a.className = "ee-dash";
    a.href = "/edit/dashboard/";
    a.textContent = "Dashboard";
    var st = document.getElementById("ee-dash-style");
    if (!st) {
      st = document.createElement("style");
      st.id = "ee-dash-style";
      st.textContent = ".mast .topbar > .mark > .ee-dash,.mast .mark > .ee-dash{display:inline-flex;align-items:center;flex:0 0 auto;min-height:44px;margin-right:14px;font-family:\"Helvetica Neue\",Helvetica,Arial,sans-serif;font-size:11px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:#f3eee6;text-decoration:none;background:none;border:0}.mast .topbar > .mark > .ee-dash:hover,.mast .mark > .ee-dash:hover,.mast .topbar > .mark > .ee-dash:focus-visible,.mast .mark > .ee-dash:focus-visible{color:#fff;outline:none;text-shadow:0 0 16px rgba(243,238,230,.95),0 0 32px rgba(243,238,230,.55)}";
      document.head.appendChild(st);
    }
    mark.insertBefore(a, mark.firstChild);
  }


  function phraseIsDevin() {
    try {
      if (document.body.classList.contains("login-devin")) return true;
      var w = localStorage.getItem("elorae-login") || localStorage.getItem("elorae-seal") || "";
      return w === "devin";
    } catch (e) { return false; }
  }

  /* On-page Edit for signed-in Devin (owner). No #edit URL typing or re-phrase required. */
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
    if (existing) return;
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
        if (Ed && Ed.tryEnterEdit && Ed.tryEnterEdit()) return;
        if (Ed && Ed.onHash && location.hash === "#edit") { Ed.onHash(); return; }
        if (location.hash !== "#edit") location.hash = "#edit";
        else if (Ed && Ed.onHash) Ed.onHash();
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
      st.textContent = ".mast .topbar > .mark > .ee-edit,.mast .mark > .ee-edit{display:inline-flex;align-items:center;flex:0 0 auto;min-height:44px;margin-right:14px;font-family:\"Helvetica Neue\",Helvetica,Arial,sans-serif;font-size:11px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:#f3eee6;text-decoration:none;background:none;border:0;cursor:pointer}.mast .topbar > .mark > .ee-edit:hover,.mast .mark > .ee-edit:hover,.mast .topbar > .mark > .ee-edit:focus-visible,.mast .mark > .ee-edit:focus-visible{color:#fff;outline:none;text-shadow:0 0 16px rgba(243,238,230,.95),0 0 32px rgba(243,238,230,.55)}";
      document.head.appendChild(st);
    }
    /* Place Edit after Dashboard if present, else at start of mark. */
    var dashEl = document.getElementById("ee-dash");
    if (dashEl && dashEl.nextSibling) mark.insertBefore(a, dashEl.nextSibling);
    else if (dashEl) mark.appendChild(a);
    else mark.insertBefore(a, mark.firstChild);
  }

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
    if (wanted()) start();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
  window.addEventListener("hashchange", function () { if (location.hash === "#edit") start(); });
  window.addEventListener("elorae-edit-session", function () { dash(); editAffordance(); });
})();
