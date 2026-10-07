/* player-mark.js (nt33). When a player is signed in (seal.js sets body.seal-<who>) and their
   mark (span.friend[data-owner=<who>]) is in the mast, a labeled PROFILE control after their
   character names links to players/<who>.html. Matches nav letter-spacing / uppercase. Nothing
   is added for visitors, for the GM (who has no mark) or where the mark is hidden. */
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
    ".friend a.nt-pmark{" +
      "margin-left:14px;padding:0;border:0;background:none;" +
      "font-family:\"Helvetica Neue\",Helvetica,Arial,sans-serif;" +
      "font-size:inherit;font-weight:400;letter-spacing:0.12em;text-transform:uppercase;" +
      "color:#8f8a82;opacity:1;text-decoration:none;text-shadow:none;line-height:1;" +
    "}" +
    "@media (min-width:801px){" +
      ".friend a.nt-pmark:hover,.friend a.nt-pmark:focus-visible{color:#f3eee6;outline:none}" +
    "}" +
    "@media (max-width:800px){" +
      ".friend a.nt-pmark{margin-left:10px;padding:8px 6px;font-size:11px;letter-spacing:0.1em}" +
    "}";
  document.head.appendChild(css);
  var a = document.createElement("a");
  a.className = "nt-pmark";
  a.href = ROOT + "players/" + who + ".html";
  a.textContent = "Profile";
  var name = who.charAt(0).toUpperCase() + who.slice(1);
  a.setAttribute("aria-label", name + "\u2019s profile");
  a.title = name + "\u2019s profile";
  if (/\/players\/[a-z]+\.html$/.test(location.pathname) && location.pathname.indexOf("/players/" + who + ".html") >= 0) {
    a.setAttribute("aria-current", "page");
    a.style.color = "#f3eee6";
  }
  mark.appendChild(a);
})();
