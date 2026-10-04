/* Behavior only. The page markup is HTML. This does not create bars, cards, or panels. */
document.addEventListener("click", function (e) {
  var life = e.target.closest(".life-toggle");
  if (life) {
    var sheet = document.getElementById("life");
    if (!sheet) return;
    var open = sheet.classList.toggle("open");
    life.textContent = open ? "- Lore" : "+ Lore";
    return;
  }
  var fit = e.target.closest(".fit-toggle");
  if (fit) {
    var hero = document.querySelector(".hero");
    if (hero) hero.classList.toggle("full");
  }
});
document.addEventListener("keydown", function (e) {
  if (e.key !== "Escape") return;
  var sheet = document.getElementById("life");
  if (sheet && sheet.classList.contains("open")) {
    sheet.classList.remove("open");
    var life = document.querySelector(".life-toggle");
    if (life) life.textContent = "+ Lore";
    return;
  }
  var back = document.querySelector(".topbar a");
  if (back) location.href = back.getAttribute("href");
});
