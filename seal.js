/* Old plaintext map (replaced by SHA-256 hashes below): var PHRASE = {light:"jack",arcana:"jon",succor:"julie",vigor:"sawyer",fatalis:"devin"}; */
var PHRASE_HASH = {
  "99a7026172d42714d0293e5598ec1c8e8260d7d0c4b8582ad002c1883494e216":"jack",
  "25f67f02357a90b9e703068227e71c7acb44b967da68cb69f039ba975be72fd2":"jon",
  "7d0823c4ca0c0bfefdc14e67786e5c6b41d517a36a8b1cce9e0bbaf1448ce0e5":"julie",
  "340bbcf62fb5b430085a948675b2b76a33f7eb855f94b538a077973a96571c61":"sawyer",
  "0eedbe39d20f666a54f9fd82e2a7b8c7673ade3d1f86f530d68b56d3e6500740":"devin"
};
/* Figure links for the top-nav friend marks (not the welcome line). */
var FRIENDS = {jack:[["Galand","articles/galand-helviath.html"]],jon:[["Telorin","figures/telorin.html"],["Silar","articles/silar-scorria.html"]],julie:[["Saoirse","articles/saoirse.html"]],sawyer:[["Vaerek","articles/vaerek.html"]]};
/* Player names shown on the seal welcome after a successful phrase. */
var NAMES = {jack:"Jack",jon:"Jon",julie:"Julie",sawyer:"Sawyer",devin:"Devin"};
function hexDigest(buf) {
  return Array.prototype.map.call(new Uint8Array(buf), function (b) {
    return (b < 16 ? "0" : "") + b.toString(16);
  }).join("");
}
function hashPhrase(text) {
  var data = new TextEncoder().encode(text);
  return crypto.subtle.digest("SHA-256", data).then(hexDigest);
}
function applySeal() {
  var who = "";
  try { who = localStorage.getItem("elorae-seal") || ""; } catch (e) {}
  ["seal-jack","seal-jon","seal-julie","seal-sawyer","seal-devin"].forEach(function (c) { document.body.classList.remove(c); });
  if (who) document.body.classList.add("seal-" + who);
  var note = document.getElementById("seal-note");
  var form = document.getElementById("seal-form");
  var welcome = document.getElementById("seal-welcome");
  var name = document.getElementById("seal-name");
  if (note && form) {
    note.hidden = !who;
    form.hidden = !!who;
  }
  if (welcome) welcome.hidden = !who;
  if (name) {
    name.hidden = !who;
    /* Welcome shows the player's name (Jack / Jon / …), not their figure (seal4).
       Old figure-link welcome (seal2): built FRIENDS[who] anchors into #seal-name. */
    name.textContent = NAMES[who] || "";
  }
  return who;
}
applySeal();
var form = document.getElementById("seal-form");
if (form) form.addEventListener("submit", function (e) {
  e.preventDefault();
  var key = (new FormData(form).get("phrase") || "").trim().toLowerCase();
  var err = document.getElementById("seal-err");
  /* Old plaintext lookup: var who = PHRASE[key]; if (!who) { if (err) err.hidden = false; return; } ... */
  hashPhrase(key).then(function (digest) {
    var who = PHRASE_HASH[digest];
    if (!who) { if (err) err.hidden = false; return; }
    try { localStorage.setItem("elorae-seal", who); } catch (err2) {}
    if (err) err.hidden = true;
    applySeal();
  }).catch(function () {
    if (err) err.hidden = false;
  });
});

var back = document.getElementById("seal-back");
if (back) back.addEventListener("click", function (e) {
  if (history.length > 1) { e.preventDefault(); history.back(); }
});
