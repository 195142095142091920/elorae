/* Back to top (nt5). Additive; loaded with ?v= on the long reading pages (Journal, Codex,
   Atlas, Timeline). A bare chevron glyph, bottom right, that appears once the reader is
   1.5 screens down and returns to the top (smooth unless prefers-reduced-motion). No box,
   no border; same quiet grey as the nav, brightening on hover / keyboard focus. Sits above
   the edit/ "Edit" glyph when that is present (body:has(#ee-glyph)). Appended to <body>
   (outside main, so never an edit/ block and never under the nav content-fade mask). */
(function () {
  if (document.getElementById("nt-top")) return;
  var css = document.createElement("style");
  css.id = "nt-top-css";
  css.textContent =
    "#nt-top{position:fixed;z-index:9000;appearance:none;-webkit-appearance:none;background:none;border:0;margin:0;padding:0;" +
    "display:flex;align-items:center;justify-content:center;color:#8f8a82;cursor:pointer;opacity:0;visibility:hidden;" +
    "transition:opacity .25s ease,visibility 0s linear .25s,color .2s ease;filter:drop-shadow(0 1px 2px rgba(0,0,0,.9)) drop-shadow(0 0 10px rgba(0,0,0,.7))}" +
    "#nt-top.is-shown{opacity:1;visibility:visible;transition:opacity .25s ease,visibility 0s,color .2s ease}" +
    "#nt-top:hover,#nt-top:focus-visible{color:#f3eee6;outline:none}" +
    "#nt-top svg{display:block;width:14px;height:8px;overflow:visible}" +
    "@media (prefers-reduced-motion:reduce){#nt-top,#nt-top.is-shown{transition:none}}" +
    "@media (min-width:801px){#nt-top{right:24px;bottom:22px;width:36px;height:36px}body:has(#ee-glyph) #nt-top{bottom:64px}}" +
    "@media (max-width:800px){#nt-top{right:8px;bottom:calc(10px + env(safe-area-inset-bottom));width:44px;height:44px}" +
    "body:has(#ee-glyph) #nt-top{bottom:calc(58px + env(safe-area-inset-bottom))}}" +
    "@media print{#nt-top{display:none}}";
  document.head.appendChild(css);

  var btn = document.createElement("button");
  btn.type = "button";
  btn.id = "nt-top";
  btn.setAttribute("aria-label", "Back to top");
  btn.title = "Back to top";
  btn.tabIndex = -1;
  btn.innerHTML = '<svg viewBox="0 0 14 8" aria-hidden="true"><polyline points="1,7 7,1 13,7" fill="none" ' +
    'stroke="currentColor" stroke-width="1.2" vector-effect="non-scaling-stroke"/></svg>';
  function mount() { document.body.appendChild(btn); update(); }

  var shown = false, ticking = false;
  function update() {
    ticking = false;
    var on = (window.scrollY || document.documentElement.scrollTop || 0) > window.innerHeight * 1.5;
    if (on === shown) return;
    shown = on;
    btn.classList.toggle("is-shown", on);
    btn.tabIndex = on ? 0 : -1;
    btn.setAttribute("aria-hidden", on ? "false" : "true");
  }
  window.addEventListener("scroll", function () {
    if (!ticking) { ticking = true; requestAnimationFrame(update); }
  }, { passive: true });
  window.addEventListener("resize", update);
  btn.addEventListener("click", function (e) {
    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, left: window.scrollX, behavior: reduce ? "auto" : "smooth" });
    var target = e.detail === 0 && document.querySelector(".topbar nav.filters a");
    if (target && target.focus) { try { target.focus({ preventScroll: true }); } catch (e) {} }
  });
  btn.setAttribute("aria-hidden", "true");
  if (document.body) mount(); else document.addEventListener("DOMContentLoaded", mount);
})();
