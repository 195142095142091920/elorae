/* Article Index: slide-in nested category list. Desktop opens on hover; phone taps the cue. */
(function () {
  var root = document.getElementById("art-index");
  if (!root) return;
  var cue = root.querySelector(".art-index-cue");
  var desk = window.matchMedia("(min-width: 801px)");

  function setOpen(on) {
    root.classList.toggle("open", !!on);
    if (cue) cue.setAttribute("aria-expanded", on ? "true" : "false");
  }

  if (cue) {
    cue.addEventListener("click", function (e) {
      if (desk.matches) return;
      e.preventDefault();
      e.stopPropagation();
      setOpen(!root.classList.contains("open"));
    });
  }

  document.addEventListener("click", function (e) {
    if (desk.matches) return;
    if (!root.classList.contains("open")) return;
    if (e.target.closest && e.target.closest("#art-index")) return;
    setOpen(false);
  }, true);

  root.querySelectorAll(".toc-tog").forEach(function (btn) {
    btn.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      var box = btn.closest(".toc-cat");
      if (!box) return;
      var on = !box.classList.contains("open");
      box.classList.toggle("open", on);
      btn.setAttribute("aria-expanded", on ? "true" : "false");
    });
  });

  if (desk.addEventListener) {
    desk.addEventListener("change", function () { setOpen(false); });
  }
})();
