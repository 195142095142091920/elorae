/* reading-progress.js (nt17). On long lore pages (main.read at least 3 viewports tall):
   - a 1px hairline that grows left to right, drawn just BELOW the hard bottom edge of the
     nav chrome (.mast plus any fixed/sticky secondary bar, measured the way rail-toggle.js
     does); the edge itself is never touched;
   - resume where you left off: the position and nearest heading are kept in localStorage per
     page; on return near the top, a bare glyph "↓ Resume <section>" offers to jump back.
     It hides on use, on dismiss (×) or once you scroll past it. Nothing is sent anywhere.
   Appended to <body>, outside main, so edit mode never sees it. */
(function () {
  "use strict";
  var main = document.querySelector("main.read");
  if (!main || document.getElementById("nt-progress")) return;
  var KEY = "elorae-read:" + location.pathname;
  var css = document.createElement("style");
  css.id = "nt-progress-css";
  css.textContent =
    "#nt-progress{position:fixed;left:0;right:0;top:var(--nt-pt,56px);height:1px;z-index:40;pointer-events:none;" +
    "transform-origin:0 50%;transform:scaleX(0);background:rgba(243,238,230,.55)}" +
    ".nt-resume{position:fixed;z-index:40;display:flex;align-items:baseline;gap:10px}" +
    ".nt-resume button{background:none;border:0;padding:6px 2px;color:#c9c2b6;cursor:pointer;" +
    "font-family:\"Iowan Old Style\",\"Palatino Linotype\",Palatino,serif;text-shadow:0 1px 10px rgba(0,0,0,.9)}" +
    ".nt-resume-go{font-size:12px;letter-spacing:.16em;text-transform:uppercase}" +
    ".nt-resume-go .g{font-size:15px;letter-spacing:0;margin-right:4px}" +
    ".nt-resume-go .s{color:#8f8a82;letter-spacing:.1em;margin-left:6px}" +
    ".nt-resume-x{font-size:16px;color:#8f8a82 !important}" +
    "html.ee-editing #nt-progress,html.ee-editing .nt-resume{display:none !important}" +
    "@media (min-width:801px){.nt-resume{left:28px;bottom:24px}.nt-resume button:hover,.nt-resume button:focus-visible{color:#fff;outline:none}}" +
    "@media (max-width:800px){.nt-resume{left:0;right:0;justify-content:center;bottom:calc(18px + env(safe-area-inset-bottom))}}";
  document.head.appendChild(css);
  var line = document.createElement("div");
  line.id = "nt-progress"; line.setAttribute("aria-hidden", "true");
  document.body.appendChild(line);

  function chromeBottom() {
    var b = 0, mast = document.querySelector(".mast");
    if (mast && getComputedStyle(mast).display !== "none") b = mast.getBoundingClientRect().bottom;
    var toc = null;
    try { toc = document.querySelector("aside.toc:has(> .toc-drop)"); } catch (e) {}
    [document.getElementById("section-bar"), toc].forEach(function (el) {
      if (!el) return;
      var cs = getComputedStyle(el), r = el.getBoundingClientRect();
      if (cs.display === "none" || cs.visibility === "hidden" || r.height <= 0 || r.height > 120) return;
      if (cs.position !== "fixed" && cs.position !== "sticky") return;
      if (r.top <= b + 1) b = Math.max(b, r.bottom);
    });
    return b;
  }
  function long() { return main.getBoundingClientRect().height > innerHeight * 3; }
  function ratio() {
    var r = main.getBoundingClientRect(), span = r.height - innerHeight;
    return span > 0 ? Math.min(1, Math.max(0, -r.top / span)) : 0;
  }
  function nearest() {
    var best = null;
    Array.prototype.forEach.call(main.querySelectorAll("h1[id], h2[id]"), function (h) {
      var t = h.getBoundingClientRect().top;
      if (t < innerHeight * .35 && (!best || t > best.getBoundingClientRect().top)) best = h;
    });
    return best;
  }
  var raf = 0, saveT = 0, ready = false;
  function tick() {
    raf = 0;
    var on = long(); line.style.display = on ? "" : "none"; if (!on) return;
    line.style.setProperty("--nt-pt", Math.ceil(chromeBottom()) + "px");
    line.style.transform = "scaleX(" + ratio().toFixed(4) + ")";
    if (ready) { clearTimeout(saveT); saveT = setTimeout(save, 400); }
  }
  function save() {
    var h = nearest();
    try {
      localStorage.setItem(KEY, JSON.stringify({ r: ratio(), id: h ? h.id : "",
        dy: h ? Math.round(-h.getBoundingClientRect().top) : 0, label: h ? h.textContent.trim() : "" }));
    } catch (e) {}
  }
  function q() { if (!raf) raf = requestAnimationFrame(tick); }
  addEventListener("scroll", q, { passive: true });
  addEventListener("resize", q);

  var saved = null; try { saved = JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) {}
  function target() {
    var h = saved.id && document.getElementById(saved.id);
    if (h) return Math.round(h.getBoundingClientRect().top + scrollY + (saved.dy || 0));
    var r = main.getBoundingClientRect();
    return Math.round(r.top + scrollY + saved.r * (r.height - innerHeight));
  }
  function offer() {
    if (!saved || saved.r < .08 || !long() || (location.hash && location.hash.length > 1)) return;
    if (scrollY > innerHeight * .5 || document.documentElement.classList.contains("ee-editing")) return;
    var b = document.createElement("div"); b.className = "nt-resume";
    var go = document.createElement("button"); go.type = "button"; go.className = "nt-resume-go";
    go.innerHTML = '<span class="g" aria-hidden="true">\u2193</span> Resume' + (saved.label ? ' <span class="s"></span>' : "");
    if (saved.label) go.querySelector(".s").textContent = saved.label.replace(/^Act ([IVXLC]+), Chapter /, "$1. ");
    var x = document.createElement("button"); x.type = "button"; x.className = "nt-resume-x";
    x.setAttribute("aria-label", "Dismiss"); x.textContent = "\u00d7";
    b.appendChild(go); b.appendChild(x); document.body.appendChild(b);
    function done() { b.remove(); removeEventListener("scroll", past); }
    function past() { if (scrollY >= target() - 40) done(); }
    go.addEventListener("click", function () { scrollTo({ top: target(), behavior: "smooth" }); done(); });
    x.addEventListener("click", done);
    addEventListener("scroll", past, { passive: true });
  }
  function start() { setTimeout(function () { tick(); offer(); ready = true; }, 300); }
  if (document.readyState === "complete") start(); else addEventListener("load", start);
})();
