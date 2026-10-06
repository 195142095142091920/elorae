/* player-mark.js (nt21). When a player is signed in (seal.js sets body.seal-<who>) and their
   mark (span.friend[data-owner=<who>]) is in the mast, a bare glyph after their character
   names links to their page, players/<who>.html. Nothing is added for visitors, for the GM
   (who has no mark) or where the mark is hidden. Not part of the main nav. */
(function () {
  "use strict";
  var ROOT = new URL("./", document.currentScript.src).href;
  var who = ""; try { who = localStorage.getItem("elorae-seal") || ""; } catch (e) {}
  if (!/^[a-z]+$/.test(who)) return;
  var mark = document.querySelector('.mast .friend[data-owner="' + who + '"]');
  if (!mark || mark.querySelector(".nt-pmark")) return;
  var css = document.createElement("style");
  css.id = "nt-pmark-css";
  css.textContent =
    ".friend a.nt-pmark{margin-left:9px;font-size:12px;letter-spacing:0;color:inherit;opacity:.6;text-decoration:none;text-shadow:none}" +
    "@media (min-width:801px){.friend a.nt-pmark:hover,.friend a.nt-pmark:focus-visible{opacity:1;outline:none}}" +
    "@media (max-width:800px){.friend a.nt-pmark{margin-left:7px;padding:6px 4px}}";
  document.head.appendChild(css);
  var a = document.createElement("a");
  a.className = "nt-pmark"; a.href = ROOT + "players/" + who + ".html";
  a.textContent = "\u25e6";
  var name = who.charAt(0).toUpperCase() + who.slice(1);
  a.setAttribute("aria-label", name + "\u2019s page"); a.title = name + "\u2019s page";
  if (/\/players\/[a-z]+\.html$/.test(location.pathname) && location.pathname.indexOf("/players/" + who + ".html") >= 0) a.setAttribute("aria-current", "page");
  mark.appendChild(a);
})();
