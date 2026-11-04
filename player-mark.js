/* player-mark.js (ni1). Nav glyphs + profile link.
   - Every signed-in person (players, Devin) gets a profile glyph linking to /players/<who>/:
     inside their own mark (span.friend) when present, else at the end of the mast mark.
   - Main nav words (Atlas, Codex, Index, Journal) and the runtime Gallery / Edit / Log out
     links render as line icons (CSS mask, currentColor). Text stays in the DOM for saves;
     aria-label + title carry the name. Runtime nodes are data-ee-ui. */
(function () {
  "use strict";
  var ROOT = new URL("./", document.currentScript.src).href;
  var who = ""; try { who = localStorage.getItem("elorae-login") || ""; } catch (e) {}
  var S = 'fill="none" stroke="#000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"';
  function svg(d) { return 'url("data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" ' + S + '>' + d + '</svg>') + '")'; }
  var IC = {
    atlas: svg('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.6 2.6 3.8 5.6 3.8 9s-1.2 6.4-3.8 9M12 3C9.4 5.6 8.2 8.6 8.2 12s1.2 6.4 3.8 9"/>'),
    codex: svg('<path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5zM5 19.5A1.5 1.5 0 0 0 6.5 21H19v-3M9 7h6"/>'),
    index: svg('<path d="M14 3H6.5A1.5 1.5 0 0 0 5 4.5v15A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V8zM14 3v5h5M8.5 12.5h7M8.5 16h7"/>'),
    journal: svg('<path d="M12 6.5C10 5 7 4.5 3 5v13.5c4-.5 7 0 9 1.5 2-1.5 5-2 9-1.5V5c-4-.5-7 0-9 1.5zM12 6.5V20"/>'),
    gallery: svg('<rect x="3" y="4" width="18" height="16" rx="1.5"/><circle cx="8.5" cy="9.5" r="1.6"/><path d="M21 16l-5-5-8 9"/>'),
    edit: svg('<path d="M4 20l1-4.2L15.6 5.2a2 2 0 0 1 2.8 0l.4.4a2 2 0 0 1 0 2.8L8.2 19zM14 7l3 3"/>'),
    logout: svg('<path d="M10 4H5.5A1.5 1.5 0 0 0 4 5.5v13A1.5 1.5 0 0 0 5.5 20H10M15 8l4 4-4 4M19 12H9"/>'),
    profile: svg('<circle cx="12" cy="8" r="3.6"/><path d="M4.5 20c.6-4 3.4-6.2 7.5-6.2s6.9 2.2 7.5 6.2"/>')
  };
  var css = document.createElement("style");
  css.id = "nt-pmark-css";
  css.setAttribute("data-ee-ui", "");
  var t = "";
  for (var k in IC) t += "[data-ni=" + k + "]::after{-webkit-mask-image:" + IC[k] + ";mask-image:" + IC[k] + "}";
  css.textContent = t +
    ".mast [data-ni]{font-size:0!important;letter-spacing:0!important;line-height:0!important;display:inline-flex!important;align-items:center;justify-content:center;min-width:40px;min-height:44px;padding:0 4px!important;margin:0!important;text-shadow:none!important;color:#8f8a82;text-decoration:none;background:none;border:0;cursor:pointer;vertical-align:middle}" +
    ".mast [data-ni]::after{content:\"\";display:block;width:21px;height:21px;background:currentColor;-webkit-mask-size:contain;mask-size:contain;-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-position:center;mask-position:center}" +
    ".mast .filters a[data-ni]::before,.mast .friend a[data-ni]::before{content:none!important;display:none!important}" +
    ".mast .filters a[data-ni]{color:#8f8a82}" +
    ".mast .filters a[data-ni].active,.mast [data-ni][aria-current=page]{color:#f3eee6}" +
    ".mast [data-ni]:hover,.mast [data-ni]:focus-visible{color:#f3eee6;outline:none}" +
    ".mast .filters:has(a[data-ni]){gap:10px!important}.mast .filters:has(a[data-ni]) .seek-glyph::before{content:none!important}" +
    ".mast [data-ni][hidden]{display:none!important}" +
    "@media (max-width:800px){.mast [data-ni]{min-width:36px;min-height:40px;padding:0 2px!important}.mast [data-ni]::after{width:19px;height:19px}.mast .filters:has(a[data-ni]){gap:6px!important}}";
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
