/* tt1 (2026-11-03): on article pages the name + epithet travel from the art into the top of the
   rising text panel instead of being covered by it. A copy of the title (aria-hidden, runtime only:
   data-ee-ui, never saved) sits as the panel's first block, at 0.8 of the hero title's type. At
   scroll 0 it is moved / scaled (transform only) exactly onto the hero title, which is made
   transparent (it stays the one real, announced heading); as you scroll by R (the distance that
   brings the copy's own place up to the title's place) the transform runs to none: the title holds
   its height on screen while it glides sideways and shrinks into the text column, the dark panel
   rises in behind it, and from then on it scrolls with the text. Scrolling back reverses it.
   Motion: a CSS scroll-driven animation (compositor) where supported; elsewhere a rAF on scroll that
   writes only transform. Layout is read only on load / resize / font load / rail change.
   prefers-reduced-motion: no movement, the hero title fades out as the panel arrives and the copy is
   simply there in the panel. Off in edit mode (the editor edits the hero title). */
(function () {
  "use strict";
  var doc = document, root = doc.documentElement;
  if (!doc.body || !doc.body.classList.contains("article")) return;
  var SCALE = 0.8;
  var reduce = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : { matches: false };
  var sda = !!(window.CSS && CSS.supports && CSS.supports("animation-timeline: scroll()"));
  var hero, title, h1, ep, main, dup, R = 1, dx = 0, dy = 0, k = 1, ticking = false, ro = null;
  function editing() { return root.classList.contains("ee-editing"); }
  function els() {
    hero = doc.querySelector("body.article > section.art-hero");
    title = hero && hero.querySelector(":scope > .art-title");
    h1 = title && title.querySelector("h1");
    ep = title && title.querySelector(".art-epithet");
    main = doc.querySelector("body.article > main.art-body");
    return !!(hero && h1 && main && hero.getClientRects().length && main.getClientRects().length && h1.textContent.trim());
  }
  function px(v) { return parseFloat(v) || 0; }
  function copyType(from, to, s) {
    var c = getComputedStyle(from);
    to.style.fontFamily = c.fontFamily; to.style.fontWeight = c.fontWeight; to.style.fontStyle = c.fontStyle;
    to.style.fontSize = (px(c.fontSize) * s) + "px";
    to.style.lineHeight = c.lineHeight === "normal" ? "normal" : (px(c.lineHeight) * s) + "px";
    to.style.letterSpacing = c.letterSpacing === "normal" ? "normal" : (px(c.letterSpacing) * s) + "px";
    to.style.textTransform = c.textTransform; to.style.color = c.color; to.style.textShadow = c.textShadow;
    to.style.overflowWrap = c.overflowWrap;
  }
  function remove() {
    Array.prototype.forEach.call(doc.querySelectorAll(".art-tt"), function (n) { n.remove(); });
    dup = null;
    root.classList.remove("tt-on", "tt-sda", "tt-reduce");
  }
  function build() {
    remove();
    if (editing() || !els()) return;
    dup = doc.createElement("div");
    dup.className = "art-tt"; dup.setAttribute("aria-hidden", "true"); dup.setAttribute("data-ee-ui", "1");
    var n = doc.createElement("p"); n.className = "art-tt-name"; n.textContent = h1.textContent.trim();
    dup.appendChild(n);
    if (ep && ep.textContent.trim()) { var e = doc.createElement("p"); e.className = "art-tt-ep"; e.textContent = ep.textContent.trim(); dup.appendChild(e); }
    main.insertBefore(dup, main.firstChild);
    measure();
    root.classList.add("tt-on");
    if (reduce.matches) root.classList.add("tt-reduce");
    else if (sda) root.classList.add("tt-sda");
    frame();
  }
  function measure() {
    if (!dup || !els()) return;
    var n = dup.querySelector(".art-tt-name"), e = dup.querySelector(".art-tt-ep");
    copyType(h1, n, SCALE);
    var hr = h1.getBoundingClientRect();
    n.style.width = (hr.width * SCALE) + "px";
    if (e && ep) {
      copyType(ep, e, SCALE);
      e.style.width = (ep.getBoundingClientRect().width * SCALE) + "px";
      e.style.marginTop = ((ep.getBoundingClientRect().top - hr.bottom) * SCALE) + "px";
    }
    root.classList.add("tt-measure"); // transform / animation off while reading the copy's own place
    var d = n.getBoundingClientRect(), sy = window.scrollY || 0;
    root.classList.remove("tt-measure");
    var heroTop = hero.getBoundingClientRect().top; // pinned (aov1): 0
    var T0 = hr.top - heroTop, D0 = d.top + sy;     // title on screen; copy in the document
    k = 1 / SCALE; dx = hr.left - d.left; dy = T0 - D0; R = Math.max(1, D0 - T0);
    var s = dup.style;
    s.setProperty("--tt-dx", dx + "px"); s.setProperty("--tt-dy", dy + "px"); s.setProperty("--tt-k", String(k)); s.setProperty("--tt-r", R + "px");
    root.style.setProperty("--tt-fade", Math.max(24, hero.getBoundingClientRect().bottom - heroTop - (hr.bottom - heroTop) - 8) + "px");
  }
  // Fallback (no scroll timelines) and reduced motion: transform / opacity only.
  function frame() {
    ticking = false;
    if (!dup) return;
    var y = window.scrollY || 0;
    if (root.classList.contains("tt-reduce")) {
      if (!sda) title.style.opacity = String(Math.max(0, 1 - y / Math.max(24, px(root.style.getPropertyValue("--tt-fade")))));
      return;
    }
    // Scroll timeline running: the compositor drives it, nothing to write. A scroll timeline can be
    // briefly inactive (currentTime null, e.g. right after a jump or while the page was not yet
    // scrollable); the inline transform underneath (animations win over it when active) then
    // keeps the copy in the right pose.
    if (sda) { var an = dup.getAnimations ? dup.getAnimations()[0] : null; if (an && an.currentTime != null && an.timeline && an.timeline.currentTime != null) return; }
    var p = Math.min(1, Math.max(0, y / R)), q = 1 - p;
    dup.style.transform = p >= 1 ? "none" : "translate(" + (dx * q) + "px," + (dy * q) + "px) scale(" + (1 + (k - 1) * q) + ")";
  }
  function onScroll() { if (!ticking && dup) { ticking = true; requestAnimationFrame(frame); } }
  var mt = 0;
  function remeasure() { clearTimeout(mt); mt = setTimeout(function () { if (dup && !editing()) { measure(); frame(); } }, 60); }
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", remeasure);
  if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(remeasure);
  window.addEventListener("load", remeasure);
  if (window.ResizeObserver) {
    ro = new ResizeObserver(remeasure);
    var watch = function () { if (hero) ro.observe(hero); if (main) ro.observe(main); if (title) ro.observe(title); };
  }
  var wasEditing = editing();
  new MutationObserver(function () {
    var e = editing();
    if (e && !wasEditing) { remove(); if (title) title.style.opacity = ""; }
    else if (!e && wasEditing) setTimeout(function () { build(); if (ro) watch(); }, 0); // the editor may rebuild the hero / body
    else if (!e && dup) remeasure(); // rail pinned / unpinned and other class changes
    wasEditing = e;
  }).observe(root, { attributes: true, attributeFilter: ["class"] });
  if (reduce.addEventListener) reduce.addEventListener("change", build);
  function start() { build(); if (ro && dup) watch(); }
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", start); else start();
  window.EloraeTitleTravel = { rebuild: build, range: function () { return R; } };
})();
