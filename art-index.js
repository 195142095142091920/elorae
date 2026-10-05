/* Article Index: desktop slide-in rail; phone Categories opens from #section-bar .sec-toggle.
   Current article is marked .on in HTML; keep it in view when the panel is used. */
(function () {
  var root = document.getElementById("art-index");
  if (!root) return;
  var cue = root.querySelector(".art-index-cue");
  var panel = root.querySelector(".art-index-panel");
  var secToggle = document.querySelector('#section-bar .sec-toggle[data-sec-for="art-index"]');
  var desk = window.matchMedia("(min-width: 801px)");

  function setOpen(on) {
    root.classList.toggle("open", !!on);
    if (cue) cue.setAttribute("aria-expanded", on ? "true" : "false");
    if (secToggle) secToggle.setAttribute("aria-expanded", on ? "true" : "false");
    if (on) keepCurrentInView();
  }

  function keepCurrentInView() {
    if (!panel) return;
    var on = panel.querySelector(".toc-name.on");
    if (!on) return;
    var t = on.getBoundingClientRect(), r = panel.getBoundingClientRect();
    if (t.top < r.top + 24) panel.scrollTop -= r.top + 24 - t.top;
    else if (t.bottom > r.bottom - 24) panel.scrollTop += t.bottom - (r.bottom - 24);
  }

  if (cue) {
    cue.addEventListener("click", function (e) {
      if (desk.matches) return;
      e.preventDefault();
      e.stopPropagation();
      setOpen(!root.classList.contains("open"));
    });
  }
  if (secToggle) {
    secToggle.addEventListener("click", function (e) {
      if (desk.matches) return;
      e.preventDefault();
      e.stopPropagation();
      setOpen(!root.classList.contains("open"));
    });
  }

  document.addEventListener("click", function (e) {
    if (desk.matches) return;
    if (!root.classList.contains("open")) return;
    if (e.target.closest && (e.target.closest("#art-index") || e.target.closest("#section-bar .sec-toggle"))) return;
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
      if (on) keepCurrentInView();
    });
  });

  /* Esc closes the slide-in, whether it was tapped open or held open by keyboard focus (esc1). */
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    var held = root.contains(document.activeElement);
    if (!root.classList.contains("open") && !held) return;
    setOpen(false);
    if (held && document.activeElement.blur) document.activeElement.blur();
  });

  if (desk.addEventListener) {
    desk.addEventListener("change", function () { setOpen(false); });
  }

  /* Desktop hover opens via CSS :hover / :focus-within; still bring the current article into view. */
  root.addEventListener("mouseenter", keepCurrentInView);
  window.addEventListener("load", keepCurrentInView);
  keepCurrentInView();
})();
