/* rd1 (2026-11-03): one shared expand / collapse handler for the Categories rail sections, on the
   Index (aside.toc.index-toc) and on article pages (aside.art-index). The whole header row (the
   section title and its arrow) is a single toggle: role="button" on the title, aria-expanded,
   Enter / Space, no navigation (the title used to jump to the Index section). Entries inside the
   dropdown still navigate. A section with nothing to expand keeps its plain link.
   Why: art-index.js re-centred the panel on the current article on every focus change, so pressing
   an arrow could scroll the panel between press and release and the click landed on something
   else ("works only sometimes" on article pages); the two pages also had separate handlers. The
   row now never takes mouse focus, and the panel is only re-centred when the rail opens.
   The Index organizer's own capture-phase title clicks (move selected card) still win. */
(function () {
  "use strict";
  if (window.__railSections) return; window.__railSections = 1;
  var SEL = "#index-toc-panel .toc-row, #art-index-panel .toc-row";
  var n = 0;
  function parts(row) {
    var box = row.parentElement;
    var nest = null;
    for (var c = row.nextElementSibling; c; c = c.nextElementSibling) if (c.classList.contains("toc-nest")) { nest = c; break; }
    var a = null;
    for (var k = row.firstElementChild; k; k = k.nextElementSibling) if (k.tagName === "A") { a = k; break; }
    return { box: box, row: row, nest: nest, a: a, tog: row.querySelector(".toc-tog") };
  }
  function expandable(p) { return !!(p.box && p.box.classList.contains("toc-cat") && p.nest && p.nest.children.length); }
  function mark(p) {
    var on = p.box.classList.contains("open") ? "true" : "false";
    if (p.a) p.a.setAttribute("aria-expanded", on);
    if (p.tog) p.tog.setAttribute("aria-expanded", on);
  }
  function prep(row) {
    var p = parts(row);
    if (!expandable(p) || row.__rs) return p;
    row.__rs = 1;
    if (!p.nest.id) p.nest.id = "toc-nest-" + (++n);
    if (p.a) { p.a.setAttribute("role", "button"); p.a.setAttribute("aria-controls", p.nest.id); }
    // One keyboard stop per row: the title is the button, the arrow is its picture.
    if (p.tog) { p.tog.tabIndex = -1; p.tog.setAttribute("aria-hidden", "true"); }
    mark(p);
    return p;
  }
  function prepAll() { Array.prototype.forEach.call(document.querySelectorAll(SEL), prep); }
  function toggle(p) {
    var on = !p.box.classList.contains("open");
    p.box.classList.toggle("open", on);
    mark(p);
    try { document.dispatchEvent(new CustomEvent("elorae-rail-section", { detail: { box: p.box, open: on } })); } catch (e) {}
  }
  function rowFrom(t) { return t && t.closest ? t.closest(SEL) : null; }
  // No mouse focus on the row: focus would make the rail re-sync and can move the panel mid-click.
  document.addEventListener("mousedown", function (e) {
    var row = rowFrom(e.target);
    if (!row || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (expandable(prep(row))) e.preventDefault();
  });
  document.addEventListener("click", function (e) {
    if (e.defaultPrevented) return;
    var row = rowFrom(e.target);
    if (!row) return;
    var p = prep(row);
    if (!expandable(p)) return;
    if (e.target.closest(".toc-row > a") && (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)) return; // new tab etc.
    e.preventDefault();
    toggle(p);
  });
  document.addEventListener("keydown", function (e) {
    if (e.key !== " " && e.key !== "Spacebar") return;
    var a = e.target && e.target.closest && e.target.closest(".toc-row > a[role='button']");
    if (!a || !rowFrom(a)) return;
    e.preventDefault();
    toggle(parts(rowFrom(a)));
  });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", prepAll); else prepAll();
  window.EloraeRailSections = { prep: prepAll, toggle: function (box) { var r = box && box.querySelector(".toc-row"); if (r) toggle(prep(r)); } };
})();
