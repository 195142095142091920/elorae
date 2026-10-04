var PHRASE = {light:"jack",arcana:"jon",succor:"julie",vigor:"sawyer",fatalis:"devin"};
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
    name.textContent = NAMES[who] || "";
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
