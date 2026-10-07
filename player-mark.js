/* player-mark.js (nt35). When a player is signed in (login.js sets body.login-<who>) and their
   mark (span.friend[data-owner=<who>]) is in the mast, a small profile glyph after their
   character names links to players/<who>.html. Nav · dots (same as Atlas/Codex) come from
   html.css (.friend a + a::before). Nothing is added for visitors, the GM, or hidden marks. */
(function () {
  "use strict";
  var ROOT = new URL("./", document.currentScript.src).href;
  var who = ""; try { who = localStorage.getItem("elorae-login") || ""; } catch (e) {}
  if (!/^[a-z]+$/.test(who)) return;
  var mark = document.querySelector('.mast .friend[data-owner="' + who + '"]');
  if (!mark || mark.querySelector(".nt-pmark")) return;
  var css = document.createElement("style");
  css.id = "nt-pmark-css";
  css.textContent =
    ".friend a.nt-pmark{" +
      "margin-left:0;padding:0;border:0;background:none;" +
      "color:#8f8a82;opacity:1;text-decoration:none;text-shadow:none;line-height:1;" +
      "display:inline-flex;align-items:center;justify-content:center;vertical-align:middle;" +
    "}" +
    ".friend a.nt-pmark svg{display:block;width:0.92em;height:0.92em}" +
    "@media (min-width:801px){" +
      ".friend a.nt-pmark:hover,.friend a.nt-pmark:focus-visible{color:#f3eee6;outline:none}" +
    "}" +
    "@media (max-width:800px){" +
      ".friend a.nt-pmark{padding:8px 4px}" +
      ".friend a.nt-pmark svg{width:14px;height:14px}" +
    "}";
  document.head.appendChild(css);
  var a = document.createElement("a");
  a.className = "nt-pmark";
  a.href = ROOT + "players/" + who + ".html";
  /* Person silhouette — same stroke weight feel as seek-glyph. */
  a.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="5" r="2.6" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M3.2 13.2c.4-2.8 2.2-4.2 4.8-4.2s4.4 1.4 4.8 4.2" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>';
  var name = who.charAt(0).toUpperCase() + who.slice(1);
  a.setAttribute("aria-label", name + "\u2019s profile");
  a.title = name + "\u2019s profile";
  if (/\/players\/[a-z]+\.html$/.test(location.pathname) && location.pathname.indexOf("/players/" + who + ".html") >= 0) {
    a.setAttribute("aria-current", "page");
    a.style.color = "#f3eee6";
  }
  mark.appendChild(a);
})();
