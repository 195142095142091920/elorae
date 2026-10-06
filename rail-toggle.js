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
      fixed/sticky #section-bar) so desktop rails sit flush under it. */
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
  ready(function () {
    var rail = document.querySelector("aside.index-toc, aside.art-index") ||
      document.querySelector("aside.toc:not(.private-journal)") || document.querySelector("aside.toc");
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
      if (sec) {
        var cs = getComputedStyle(sec), r = sec.getBoundingClientRect();
        if (cs.display !== "none" && cs.visibility !== "hidden" && r.height > 0 &&
            (cs.position === "fixed" || cs.position === "sticky") && r.top <= b + 1) b = Math.max(b, r.bottom);
      }
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
})();
