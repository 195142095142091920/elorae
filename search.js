var seek = document.getElementById("seek");
if (seek) seek.addEventListener("input", function () {
  var q = seek.value.trim().toLowerCase();
  document.querySelectorAll(".tile").forEach(function (tile) {
    var name = (tile.querySelector(".label") || {}).textContent || "";
    tile.classList.toggle("is-dim", q && name.toLowerCase().indexOf(q) === -1);
  });
});
