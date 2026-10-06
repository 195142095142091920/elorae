/* Elorae edit mode bootstrap (the only file referenced from site pages).
   For anonymous visitors this does nothing: no DOM, no styles, no network requests.
   It wakes up only when the URL hash is #edit or an editor session already exists in this
   browser, and (for Devin) adds a bare DASHBOARD link to the top nav. */
(function () {
  "use strict";
  var KEY = "elorae-edit-session";
  var me = document.currentScript;
  var src = me ? me.getAttribute("src") : "edit/edit.js";
  var base = new URL(src, location.href);
  var V = (base.search || "").replace(/^\?/, "");

  function readSession() {
    try {
      var raw = sessionStorage.getItem(KEY) || localStorage.getItem(KEY);
      var s = raw ? JSON.parse(raw) : null;
      return s && s.token && s.login ? s : null;
    } catch (e) { return null; }
  }
  function seal() { try { return localStorage.getItem("elorae-seal") || ""; } catch (e) { return ""; } }
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
    ["core.js", "perms.js", "srcmap.js", "editor.js"].reduce(function (p, f) {
      return p.then(function () { return load(f); });
    }, Promise.resolve()).catch(function () {});
  }

  // Devin's DASHBOARD link (seal "devin", or an admin edit session for Devin).
  function dash() {
    var s = readSession();
    var isDevin = seal() === "devin" || (s && (s.person === "devin" || s.role === "admin"));
    if (!isDevin || document.getElementById("ee-dash")) return;
    var mark = document.querySelector(".mast .topbar > .mark") || document.querySelector(".mast .mark");
    if (!mark) return;
    var a = document.createElement("a");
    a.id = "ee-dash";
    a.className = "ee-dash";
    a.href = new URL("dashboard.html", base).href;
    a.textContent = "Dashboard";
    var st = document.getElementById("ee-dash-style");
    if (!st) {
      st = document.createElement("style");
      st.id = "ee-dash-style";
      st.textContent = ".mast .mark > .ee-dash{display:inline-flex;align-items:center;min-height:44px;margin-right:18px;font-family:\"Helvetica Neue\",Helvetica,Arial,sans-serif;font-size:11px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:#f3eee6;text-decoration:none;background:none;border:0}.mast .mark > .ee-dash:hover,.mast .mark > .ee-dash:focus-visible{color:#fff;outline:none;text-shadow:0 0 16px rgba(243,238,230,.95),0 0 32px rgba(243,238,230,.55)}";
      document.head.appendChild(st);
    }
    var logout = document.getElementById("seal-logout");
    if (logout && logout.parentNode === mark) mark.insertBefore(a, logout);
    else mark.appendChild(a);
  }

  function init() {
    dash();
    if (wanted()) start();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
  window.addEventListener("hashchange", function () { if (location.hash === "#edit") start(); });
  window.addEventListener("elorae-edit-session", function () { dash(); });
})();
