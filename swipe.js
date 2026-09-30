(function () {
  const MIN = 48;
  let start = null;

  function mobile() {
    return window.innerWidth <= 800 || window.matchMedia("(pointer: coarse)").matches;
  }

  function blocked() {
    if (!document.body.classList.contains("entry")) return true;
    if (!mobile()) return true;
    if (document.querySelector(".lore.open, .life-sheet.open")) return true;
    return false;
  }

  function inChrome(el) {
    return !!(el && el.closest && el.closest(".topbar, .dock, .life-dock, .lore, .life-sheet, .pager, button, a"));
  }

  function inBand(y) {
    const h = window.innerHeight || 1;
    return y > h * 0.16 && y < h * 0.68;
  }

  function go(dir) {
    const sel = dir > 0 ? ".pager .arrow.next" : ".pager .arrow.prev";
    const a = document.querySelector(sel);
    const href = a && a.getAttribute("href");
    if (href) location.hash = href;
  }

  document.addEventListener("touchstart", function (e) {
    if (blocked() || e.touches.length !== 1) { start = null; return; }
    const t = e.touches[0];
    if (inChrome(e.target) || !inBand(t.clientY)) { start = null; return; }
    start = { x: t.clientX, y: t.clientY, t: Date.now() };
  }, { passive: true });

  document.addEventListener("touchmove", function (e) {
    if (!start || e.touches.length !== 1) return;
    const t = e.touches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dx) > 24 && Math.abs(dx) > Math.abs(dy) * 1.2) {
      if (e.cancelable) e.preventDefault();
    }
  }, { passive: false });

  document.addEventListener("touchend", function (e) {
    if (!start) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    const dt = Date.now() - start.t;
    start = null;
    if (blocked()) return;
    if (dt > 700) return;
    if (Math.abs(dx) < MIN) return;
    if (Math.abs(dx) < Math.abs(dy) * 1.25) return;
    go(dx < 0 ? 1 : -1);
  }, { passive: true });
})();
