/* Sidebar toggle glyph, top-left of the main nav (art87). Loaded in <head> on every page.
   1) Before first paint: restores the Codex/Journal TOC collapsed state (elorae-toc-rail,
      default open) as html.toc-rail-collapsed.
   2) After parse: if the page has a sidebar (aside.toc or aside.art-index — detected, no page
      list), adds a bare glyph button at the left of the .topbar; pages without one get
      nothing (no reserved space). Desktop only (CSS hides it on phone).
      Index + articles: calls window.__railToggle (index-scroll.js / art-index.js): the same
      pinned state, push and elorae-cats-rail persistence as the Index pin / article arrow.
      Codex/Journal TOCs: toggles html.toc-rail-collapsed and persists it.
   3) Sets --rail-top on <html> to the measured bottom of the nav chrome (mast + a visible
      fixed/sticky #section-bar) so desktop rails sit flush under it.
   4) nfs1 content fade: the nav bars end in a hard edge; content fades under them through one
      viewport-fixed strip (html.css body::after, 48px desktop / 40px phone) placed at
      --nav-bottom, the measured bottom of the nav stack (incl. a phone Contents row). Measured
      on resize / layout changes only; nothing runs per scroll frame, so the fade cannot lag. */
(function () {
  var KEY = "elorae-toc-rail";
  var h = document.documentElement;
  try { if (localStorage.getItem(KEY) === "collapsed") h.classList.add("toc-rail-collapsed"); } catch (e) {}

  var ICON = '<svg viewBox="0 0 16 12" aria-hidden="true">' +
    '<rect x="0.5" y="0.5" width="15" height="11" rx="1" fill="none" stroke="currentColor" stroke-width="1" vector-effect="non-scaling-stroke"/>' +
    '<path d="M5.5 0.5v11" fill="none" stroke="currentColor" stroke-width="1" vector-effect="non-scaling-stroke"/></svg>';

  function ready(fn) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn);
    else fn();
  }
  ready(navFade);
  ready(function () {
    var rail = document.querySelector("aside.index-toc, aside.art-index") ||
      document.querySelector("aside.toc");
    var bar = document.querySelector(".mast .topbar") || document.querySelector(".topbar");
    if (!rail || !bar) { h.classList.remove("toc-rail-collapsed"); return; }
    var cats = rail.matches("aside.index-toc, aside.art-index");
    h.classList.add("has-rail-toggle");
    if (cats) h.classList.remove("toc-rail-collapsed");

    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "rail-toggle";
    btn.innerHTML = ICON;
    if (rail.id) btn.setAttribute("aria-controls", rail.id);
    bar.insertBefore(btn, bar.firstChild);

    function isOpen() {
      if (cats) return typeof window.__railIsOpen === "function" ? !!window.__railIsOpen() : h.classList.contains("cats-rail-pinned");
      return !h.classList.contains("toc-rail-collapsed");
    }
    function paint() {
      var on = isOpen();
      btn.setAttribute("aria-expanded", on ? "true" : "false");
      btn.setAttribute("aria-label", on ? "Hide sidebar" : "Show sidebar");
      btn.classList.toggle("is-on", on);
    }
    btn.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      if (cats) {
        if (typeof window.__railToggle === "function") window.__railToggle();
      } else {
        var collapse = !h.classList.contains("toc-rail-collapsed");
        h.classList.toggle("toc-rail-collapsed", collapse);
        try { localStorage.setItem(KEY, collapse ? "collapsed" : "open"); } catch (err) {}
      }
      paint();
    });
    /* Stay in sync with the pin / article arrow / Escape (they flip html classes). */
    if (window.MutationObserver) new MutationObserver(paint).observe(h, { attributes: true, attributeFilter: ["class"] });
    paint();

    /* Flush rails: measured chrome bottom. */
    var mast = document.querySelector(".mast"), sec = document.getElementById("section-bar");
    function measure() {
      var b = mast ? mast.getBoundingClientRect().bottom : 0;
      /* ra1: rails sit flush under the mast on every page (the Codex section bar no longer pushes
         the rail down), so the first rail header is at the same height site-wide. */
      if (b > 0) h.style.setProperty("--rail-top", Math.round(b * 100) / 100 + "px");
    }
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("load", measure);
    if (window.ResizeObserver) {
      var ro = new ResizeObserver(measure);
      if (mast) ro.observe(mast);
      if (sec) ro.observe(sec);
    }
  });

  /* ---- art89/nt26: content dissolves under the hard nav edge (veil stays solid) ---- */
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
  function navFade() {
    var mast = document.querySelector(".mast");
    if (!mast || getComputedStyle(mast).display === "none" || !document.querySelector("body > main")) return;
    /* nfs1: the fade is one viewport-fixed strip (html.css body::after) at --nav-bottom. Only the
       chrome height is measured here, on resize / layout changes, never on scroll. */
    var last = "";
    function measure() {
      var v = Math.round(chromeBottom() * 100) / 100 + "px";
      if (v !== last) { last = v; h.style.setProperty("--nav-bottom", v); }
    }
    measure();
    h.classList.add("nav-fade-on");
    window.addEventListener("resize", measure);
    window.addEventListener("load", measure);
    if (window.ResizeObserver) {
      var ro = new ResizeObserver(measure);
      ro.observe(mast);
      var sb = document.getElementById("section-bar");
      if (sb) ro.observe(sb);
      var tr = null; try { tr = document.querySelector("aside.toc:has(> .toc-drop)"); } catch (e) {}
      if (tr) ro.observe(tr);
    }
    /* Rail / dropdown toggles can change the chrome without a resize. */
    document.addEventListener("click", function () { setTimeout(measure, 0); setTimeout(measure, 320); }, true);
    /* Browsers without scroll-driven animations: hide the strip at the very top only (a class
       flip when crossing 0, not a per-frame position). */
    if (!(window.CSS && CSS.supports && CSS.supports("animation-timeline: scroll()"))) {
      var top = null;
      var flip = function () { var t = (window.scrollY || window.pageYOffset || 0) < 1; if (t !== top) { top = t; h.classList.toggle("nfs1-top", t); } };
      flip();
      window.addEventListener("scroll", flip, { passive: true });
    }
  }
})();
