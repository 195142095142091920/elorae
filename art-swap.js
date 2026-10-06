/* Article hero art carousel: arrows cycle the hero art; hovering reveals thumbnails. */
(function () {
  var hero = document.querySelector(".art-hero > img");
  var btns = Array.prototype.slice.call(document.querySelectorAll(".art-swap-thumbs button"));
  if (!hero || !btns.length) return;
  var cur = Math.max(0, btns.findIndex(function (b) { return b.classList.contains("on"); }));
  function show(i) {
    cur = (i + btns.length) % btns.length;
    var b = btns[cur];
    hero.src = b.getAttribute("data-src");
    hero.alt = b.getAttribute("data-alt") || hero.alt;
    hero.style.objectPosition = b.getAttribute("data-pos") || "";
    btns.forEach(function (o, n) { o.classList.toggle("on", n === cur); o.setAttribute("aria-pressed", n === cur ? "true" : "false"); });
  }
  btns.forEach(function (b, n) { b.addEventListener("click", function () { show(n); }); });
  var prev = document.querySelector(".art-swap .art-prev");
  var next = document.querySelector(".art-swap .art-next");
  if (prev) prev.addEventListener("click", function () { show(cur - 1); });
  if (next) next.addEventListener("click", function () { show(cur + 1); });
  /* Keyboard: ←/→ cycle hero arts (skip when typing in a field). */
  document.addEventListener("keydown", function (e) {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    var t = e.target;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
    e.preventDefault();
    show(e.key === "ArrowLeft" ? cur - 1 : cur + 1);
  });
  /* Phone swipe on the hero art (horizontal, not chrome). */
  var heroBox = document.querySelector(".art-hero");
  var start = null;
  var MIN = 48;
  function phone() {
    return window.innerWidth <= 800 || window.matchMedia("(pointer: coarse)").matches;
  }
  function inChrome(el) {
    return !!(el && el.closest && el.closest(".art-swap, .art-index, .topbar, .mast, button, a, input"));
  }
  if (heroBox) {
    heroBox.addEventListener("touchstart", function (e) {
      if (!phone() || e.touches.length !== 1) { start = null; return; }
      if (inChrome(e.target)) { start = null; return; }
      var t = e.touches[0];
      start = { x: t.clientX, y: t.clientY, t: Date.now() };
    }, { passive: true });
    heroBox.addEventListener("touchmove", function (e) {
      if (!start || e.touches.length !== 1) return;
      var t = e.touches[0];
      var dx = t.clientX - start.x;
      var dy = t.clientY - start.y;
      if (Math.abs(dx) > 24 && Math.abs(dx) > Math.abs(dy) * 1.2) {
        if (e.cancelable) e.preventDefault();
      }
    }, { passive: false });
    heroBox.addEventListener("touchend", function (e) {
      if (!start) return;
      var t = e.changedTouches[0];
      var dx = t.clientX - start.x;
      var dy = t.clientY - start.y;
      var dt = Date.now() - start.t;
      start = null;
      if (!phone()) return;
      if (dt > 700) return;
      if (Math.abs(dx) < MIN) return;
      if (Math.abs(dx) < Math.abs(dy) * 1.25) return;
      show(dx < 0 ? cur + 1 : cur - 1);
    }, { passive: true });
  }
  /* Previous thumbnail-only handler (replaced by show() above, art5):
  var btns = document.querySelectorAll(".art-swap button");
  btns.forEach(function (b) {
    b.addEventListener("click", function () {
      hero.src = b.getAttribute("data-src");
      hero.alt = b.getAttribute("data-alt") || hero.alt;
      hero.style.objectPosition = b.getAttribute("data-pos") || "";
      btns.forEach(function (o) { o.classList.toggle("on", o === b); o.setAttribute("aria-pressed", o === b ? "true" : "false"); });
    });
  });
  */
})();
