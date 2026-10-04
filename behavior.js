document.addEventListener('click', function (e) {
  var life = e.target.closest('.life-toggle');
  if (!life) return;
  var sheet = document.getElementById('life');
  if (!sheet) return;
  var open = sheet.classList.toggle('open');
  life.textContent = open ? '- Lore' : '+ Lore';
});

document.addEventListener("click", function (e) {
  var fit = e.target.closest(".fit-toggle");
  if (fit) {
    var hero = document.querySelector(".hero");
    if (hero) hero.classList.toggle("full");
    return;
  }
  var swap = e.target.closest("#art-swap button");
  if (swap) document.getElementById("art-swap").classList.toggle("open");
});
