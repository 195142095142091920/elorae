var PHRASE = {light:"jack",arcana:"jon",succor:"julie",vigor:"sawyer",fatalis:"devin"};
/* Profile names shown on the seal page, matching the data-owner friend links (seal2). */
var FRIENDS = {jack:[["Galand","articles/galand-helviath.html"]],jon:[["Telorin","figures/telorin.html"],["Silar","articles/silar-scorria.html"]],julie:[["Saoirse","articles/saoirse.html"]],sawyer:[["Vaerek","articles/vaerek.html"]]};
var NAMES = {jack:"Jack",jon:"Jon",julie:"Julie",sawyer:"Sawyer",devin:"Devin"};
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
    /* Old plain name (replaced by the friend links below, seal2): name.textContent = NAMES[who] || ""; */
    name.textContent = "";
    var links = FRIENDS[who];
    if (!links) name.textContent = NAMES[who] || "";
    else links.forEach(function (f, i) {
      if (i) name.appendChild(document.createTextNode(" \u00b7 "));
      var a = document.createElement("a");
      a.href = f[1];
      a.textContent = f[0];
      name.appendChild(a);
    });
  }
  return who;
}
applySeal();
var form = document.getElementById("seal-form");
if (form) form.addEventListener("submit", function (e) {
  e.preventDefault();
  var key = (new FormData(form).get("phrase") || "").trim().toLowerCase();
  var who = PHRASE[key];
  var err = document.getElementById("seal-err");
  if (!who) { if (err) err.hidden = false; return; }
  try { localStorage.setItem("elorae-seal", who); } catch (err2) {}
  if (err) err.hidden = true;
  applySeal();
});

var back = document.getElementById("seal-back");
if (back) back.addEventListener("click", function (e) {
  if (history.length > 1) { e.preventDefault(); history.back(); }
});
