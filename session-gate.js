/* Session gate: no valid elorae-seal → redirect to phrase sign-in, unless guest browse
   (localStorage elorae-guest=1). Valid session or guest → free navigation (no forced profile).
   Seal page is exempt. Guest never opens edit/secret or edit/dashboard (no hint).
   After phrase sign-in, seal shows Welcome (+ Connect if needed); profile redirect
   remains only after Connect to GitHub success (seal.js). Guests never see Connect. */
(function () {
  "use strict";
  var PLAYERS = { jack: 1, jon: 1, julie: 1, sawyer: 1, devin: 1 };
  var path = location.pathname || "";
  if (/(^|\/)seal\.html$/i.test(path)) return;

  function readWho() {
    try {
      var m = document.cookie.match(/(?:^|;\s*)elorae-seal=([a-z]+)/);
      if (m && PLAYERS[m[1]]) return m[1];
    } catch (e) {}
    try {
      var w = localStorage.getItem("elorae-seal") || "";
      if (PLAYERS[w]) return w;
    } catch (e) {}
    return "";
  }
  function isGuest() {
    try { return localStorage.getItem("elorae-guest") === "1"; } catch (e) { return false; }
  }
  /* Restricted: guests and unsigned must not see these at all. */
  var restricted = /(^|\/)edit\/(secret|dashboard)\.html$/i.test(path);

  if (readWho()) return;
  if (isGuest() && !restricted) return;

  var script = document.currentScript;
  var seal = script ? new URL("seal.html", script.src).href : "seal.html";
  location.replace(seal);
})();
