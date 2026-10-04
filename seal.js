var PHRASE = {light:"jack",arcana:"jon",succor:"julie",vigor:"sawyer",fatalis:"devin"};
function applySeal() {
  var who = "";
  try { who = localStorage.getItem("elorae-seal") || ""; } catch (e) {}
  document.body.className = document.body.className.replace(/seal-\w+/g, "").trim();
  if (who) document.body.classList.add("seal-" + who);
}
applySeal();
var form = document.getElementById("seal");
if (form) form.addEventListener("submit", function (e) {
  e.preventDefault();
  var key = (new FormData(form).get("phrase") || "").trim().toLowerCase();
  var who = PHRASE[key];
  var msg = document.getElementById("seal-msg");
  if (!who) { msg.textContent = "Try again."; return; }
  try { localStorage.setItem("elorae-seal", who); } catch (err) {}
  applySeal();
  msg.textContent = "You may now view your private material.";
});
