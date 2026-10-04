var seek = document.getElementById("seek");
if (seek) seek.addEventListener("input", function () {
  var q = seek.value.trim().toLowerCase();
  document.querySelectorAll(".tile").forEach(function (tile) {
    var name = (tile.querySelector(".label") || {}).textContent || "";
    tile.classList.toggle("is-dim", q && name.toLowerCase().indexOf(q) === -1);
  });
});

var params = new URLSearchParams(location.search);
if (params.get("q") && seek) {
  seek.value = params.get("q");
  seek.dispatchEvent(new Event("input"));
}

if (seek) document.addEventListener("keydown", function (e) {
  var t = e.target;
  if (t && t !== seek && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
  if (e.metaKey || e.ctrlKey || e.altKey) return;

  if (e.key === "Escape" && seek.value) {
    seek.value = "";
    seek.dispatchEvent(new Event("input"));
    e.preventDefault();
    e.stopPropagation();
    return;
  }

  if (e.key === "Enter" && seek.value.trim()) {
    var hit = document.querySelector(".tile:not(.is-dim)");
    if (hit && hit.getAttribute("href")) {
      e.preventDefault();
      location.href = hit.getAttribute("href");
      return;
    }
    if (t !== seek && seek.form) {
      e.preventDefault();
      seek.form.submit();
    }
    return;
  }

  if (t === seek) return;
  if (e.key.length !== 1) return;
  if (e.key === " " && !seek.value) return;
  seek.focus();
  seek.value += e.key;
  seek.dispatchEvent(new Event("input"));
  e.preventDefault();
}, true);
