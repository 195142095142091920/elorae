/* Article hero art carousel: arrows cycle the hero art; hovering reveals thumbnails.
   art9: any number of arts (the thumbnail row wraps when long), re-runnable
   (window.EloraeArtSwap.init() after the hero is rebuilt in place, e.g. by edit mode), and
   paused while the page is being edited. */
(function () {
  var cur = 0, btns = [], hero = null, bound = false;
  function editing() { return document.documentElement.classList.contains("ee-editing"); }
  function show(i) {
    if (!btns.length || !hero) return;
    cur = (i + btns.length) % btns.length;
    var b = btns[cur];
    hero.src = b.getAttribute("data-src");
    hero.alt = b.getAttribute("data-alt") || hero.alt;
    hero.style.objectPosition = b.getAttribute("data-pos") || "";
    btns.forEach(function (o, n) { o.classList.toggle("on", n === cur); o.setAttribute("aria-pressed", n === cur ? "true" : "false"); });
  }
  function init() {
    hero = document.querySelector(".art-hero > img");
    btns = Array.prototype.slice.call(document.querySelectorAll(".art-swap-thumbs button"));
    if (!hero || !btns.length) { btns = []; return; }
    cur = Math.max(0, btns.findIndex(function (b) { return b.classList.contains("on"); }));
    btns.forEach(function (b, n) {
      if (b.__eaSwap) return;
      b.__eaSwap = true;
      b.addEventListener("click", function () { if (!editing()) show(btns.indexOf(b)); });
    });
    var thumbs = document.querySelector(".art-swap-thumbs");
    if (thumbs && btns.length > 6) { thumbs.style.flexWrap = "wrap"; thumbs.style.justifyContent = "flex-end"; thumbs.style.maxWidth = "min(560px, calc(100vw - 56px))"; }
    var prev = document.querySelector(".art-swap .art-prev");
    var next = document.querySelector(".art-swap .art-next");
    if (prev && !prev.__eaSwap) { prev.__eaSwap = true; prev.addEventListener("click", function () { if (!editing()) show(cur - 1); }); }
    if (next && !next.__eaSwap) { next.__eaSwap = true; next.addEventListener("click", function () { if (!editing()) show(cur + 1); }); }
    bindTouch();
    if (bound) return;
    bound = true;
    /* Keyboard: ←/→ cycle hero arts (skip when typing in a field, or while editing). */
    document.addEventListener("keydown", function (e) {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      if (!btns.length || editing() || e.altKey || e.ctrlKey || e.metaKey) return;
      var t = e.target;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      e.preventDefault();
      show(e.key === "ArrowLeft" ? cur - 1 : cur + 1);
    });
  }
  function bindTouch() {
    /* Phone swipe on the hero art (horizontal, not chrome). */
    var heroBox = document.querySelector(".art-hero");
    if (!heroBox || heroBox.__eaSwap) return;
    heroBox.__eaSwap = true;
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
        if (!btns.length || editing() || !phone() || e.touches.length !== 1) { start = null; return; }
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
  }
  window.EloraeArtSwap = { init: init, show: function (i) { show(i); }, count: function () { return btns.length; } };
  init();
})();
