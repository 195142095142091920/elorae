/* Session gate: no valid elorae-seal cookie/localStorage → redirect to phrase sign-in.
   Valid session → free navigation (no forced profile redirect). Seal page is exempt.
   Profile redirect remains only after Connect to GitHub success (seal.js). */
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
  if (readWho()) return;

  var script = document.currentScript;
  var seal = script ? new URL("seal.html", script.src).href : "seal.html";
  location.replace(seal);
})();
