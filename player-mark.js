/* player-mark.js (ni2: engraved white glyphs, hover glow). Nav glyphs + profile link.
   - Every signed-in person (players, Devin) gets a profile glyph linking to /players/<who>/:
     inside their own mark (span.friend) when present, else at the end of the mast mark.
   - Main nav words (Atlas, Codex, Index, Journal) and the runtime Gallery / Edit / Log out
     links render as line icons (CSS mask, currentColor). Text stays in the DOM for saves;
     aria-label + title carry the name. Runtime nodes are data-ee-ui. */
(function () {
  "use strict";
  var ROOT = new URL("./", document.currentScript.src).href;
  var who = ""; try { who = localStorage.getItem("elorae-login") || ""; } catch (e) {}
  var S = 'fill="#000" fill-rule="evenodd"';
  function svg(d) { return 'url("data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" ' + S + '>' + d + '</svg>') + '")'; }
  var IC = {
    atlas: svg("<path d=\"M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 2.2a7.8 7.8 0 1 1 0 15.6 7.8 7.8 0 0 1 0-15.6z\"/><path d=\"M3.5 13.6l17-3.2.3 1.4-17 3.2zM11.3 4h1.4v16h-1.4z\"/><circle cx=\"12\" cy=\"12\" r=\"2.2\"/>"),
    codex: svg("<path d=\"M5 3h13a1 1 0 0 1 1 1v14H6.5a1 1 0 0 0 0 2H19v1H6.5A2.5 2.5 0 0 1 4 18.5V4a1 1 0 0 1 1-1zm4 4v1h7V7zm0 3v1h5v-1z\"/><path d=\"M17 10h3v4h-3z\"/>"),
    index: svg("<path d=\"M6 3h11a3 3 0 0 1 0 6h-1v9a3 3 0 0 1-3 3H5a2 2 0 0 1 0-4h1zm2 3v1h6V6zm0 3v1h6V9zm0 3v1h5v-1z\"/>"),
    journal: svg("<path d=\"M20 2c-5 1-9 5-11 11l1.5 1.5C16 12 19 7 20 2zM9.2 14.6L7 19l4.4-2.2z\"/><path d=\"M3 19h8v2H3z\"/>"),
    gallery: svg("<path d=\"M3 3h18v18H3zm2.5 2.5v13h13v-13z\"/><path d=\"M12 7a2.3 2.3 0 1 1 0 4.6A2.3 2.3 0 0 1 12 7zm-4.5 10c.5-3 2.3-4.4 4.5-4.4s4 1.4 4.5 4.4z\"/>"),
    edit: svg("<path d=\"M12 2l4 7-3 9h-2L8 9zm0 5.5a1.3 1.3 0 1 0 0 2.6 1.3 1.3 0 0 0 0-2.6z\"/><path d=\"M11 18h2v4h-2z\"/>"),
    logout: svg("<path d=\"M4 21V5l9-3v19zm6.5-10a1 1 0 1 0 0 2 1 1 0 0 0 0-2z\"/><path d=\"M14 4h5v17h-5v-2h3V6h-3z\"/>"),
    profile: svg("<path d=\"M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 1.8a8.2 8.2 0 1 1 0 16.4 8.2 8.2 0 0 1 0-16.4z\"/><path d=\"M12 6.2a3 3 0 1 1 0 6 3 3 0 0 1 0-6zM6.8 17.6c.8-2.8 2.8-4.2 5.2-4.2s4.4 1.4 5.2 4.2a7 7 0 0 1-10.4 0z\"/>")
  };
  var css = document.createElement("style");
  css.id = "nt-pmark-css";
  css.setAttribute("data-ee-ui", "");
  var t = "";
  for (var k in IC) t += "[data-ni=" + k + "]::after{-webkit-mask-image:" + IC[k] + ";mask-image:" + IC[k] + "}";
  css.textContent = t +
    ".mast [data-ni]{font-size:0!important;letter-spacing:0!important;line-height:0!important;display:inline-flex!important;align-items:center;justify-content:center;min-width:40px;min-height:44px;padding:0 4px!important;margin:0!important;text-shadow:none!important;color:rgba(243,238,230,.72)!important;transition:color .25s ease,filter .25s ease;text-decoration:none;background:none;border:0;cursor:pointer;vertical-align:middle}" +
    ".mast [data-ni]::after{content:\"\";display:block;width:26px;height:26px;background:currentColor;-webkit-mask-size:contain;mask-size:contain;-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-position:center;mask-position:center}" +
    ".mast .filters a[data-ni]::before,.mast .friend a[data-ni]::before{content:none!important;display:none!important}" +
    ".mast .filters a[data-ni]{color:rgba(243,238,230,.72)}" +
    ".mast .filters a[data-ni].active,.mast [data-ni][aria-current=page]{color:#fff!important;filter:drop-shadow(0 0 3px rgba(255,255,255,.35))}" +
    ".mast [data-ni]:hover,.mast [data-ni]:focus-visible{color:#fff!important;outline:none;filter:drop-shadow(0 0 5px rgba(255,255,255,.75)) drop-shadow(0 0 12px rgba(255,255,255,.35))}" +
    ".mast .filters:has(a[data-ni]){gap:10px!important}.mast .filters:has(a[data-ni]) .seek-glyph::before{content:none!important}" +
    ".mast [data-ni][hidden]{display:none!important}" +
    "@media (max-width:800px){.mast [data-ni]{min-width:36px;min-height:40px;padding:0 2px!important}.mast [data-ni]::after{width:22px;height:22px}.mast .filters:has(a[data-ni]){gap:6px!important}}";
  document.head.appendChild(css);

  function tag(el, key, label) {
    if (!el || el.getAttribute("data-ni") === key) return;
    el.setAttribute("data-ni", key);
    el.setAttribute("aria-label", label);
    el.title = label;
  }
  var NAV = { atlas: "Atlas", codex: "Codex", index: "Index", journal: "Journal" };
  function run() {
    var links = document.querySelectorAll(".mast .filters a");
    for (var i = 0; i < links.length; i++) {
      var n = (links[i].textContent || "").trim().toLowerCase();
      if (NAV[n]) tag(links[i], n, NAV[n]);
    }
    tag(document.getElementById("ee-gallery"), "gallery", "Gallery");
    tag(document.getElementById("ee-edit"), "edit", "Edit");
    tag(document.getElementById("login-logout"), "logout", "Log out");
    profile();
  }
  function profile() {
    if (!/^[a-z]+$/.test(who) || document.querySelector(".mast .nt-pmark")) return;
    var host = document.querySelector('.mast .friend[data-owner="' + who + '"]');
    var mark = document.querySelector(".mast .topbar > .mark") || document.querySelector(".mast .mark");
    if (!host) host = mark;
    if (!host) return;
    var a = document.createElement("a");
    a.className = "nt-pmark";
    a.setAttribute("data-ee-ui", "");
    a.href = ROOT + "players/" + who + "/";
    tag(a, "profile", "Profile");
    if (location.pathname.replace(/\/index\.html$|\.html$/, "/").replace(/\/?$/, "/").indexOf("/players/" + who + "/") >= 0) a.setAttribute("aria-current", "page");
    var lo = document.getElementById("login-logout");
    if (host === mark && lo && lo.parentNode === mark) mark.insertBefore(a, lo); else host.appendChild(a);
  }
  run();
  if (window.MutationObserver) {
    var m = document.querySelector(".mast") || document.body;
    var q = 0;
    new MutationObserver(function () { if (!q) { q = 1; setTimeout(function () { q = 0; run(); }, 0); } }).observe(m, { childList: true, subtree: true });
  }
  document.addEventListener("DOMContentLoaded", run);
})();
