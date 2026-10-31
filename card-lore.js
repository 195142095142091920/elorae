/* epi1 (2026-10-31): Index card hover = the title shifts up to reveal the card's epithet. The look
   is CSS (html.css "epi1"; the epithet is the card's data-epithet attribute, drawn by ::before).
   This script only measures each card's epithet height (a long one wraps to two lines) and sets
   that card's --epi-shift so the title clears it exactly. Values live in an adopted stylesheet keyed
   by card id, so nothing is written into the card markup (edit-mode saves stay clean).
   Replaces the art82-art97 hover preview face (no article fetches any more). */
(function () {
  if (!document.body || !document.body.classList.contains("index-page")) return;
  if (!window.matchMedia || !matchMedia("(hover: hover) and (pointer: fine)").matches) return;
  if (!("adoptedStyleSheets" in document) || typeof CSSStyleSheet !== "function") return;
  var sheet = new CSSStyleSheet();
  document.adoptedStyleSheets = document.adoptedStyleSheets.concat([sheet]);
  var GAP = 4, last = "";
  function esc(id) { return window.CSS && CSS.escape ? CSS.escape(id) : id.replace(/[^\w-]/g, "\\$&"); }
  function measure() {
    var rules = [];
    Array.prototype.forEach.call(document.querySelectorAll("a.index-card[data-epithet]"), function (a) {
      if (!a.id || !a.getAttribute("data-epithet") || !a.offsetParent) return;
      var h = parseFloat(getComputedStyle(a, "::before").height);
      if (h > 0) rules.push("body.index-page a.index-card#" + esc(a.id) + "{--epi-shift:" + (Math.round(h) + GAP) + "px}");
    });
    var css = rules.join("\n");
    if (css !== last) { last = css; sheet.replaceSync(css); }
  }
  var t = 0;
  function soon() { clearTimeout(t); t = setTimeout(measure, 120); }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", measure); else measure();
  window.addEventListener("resize", soon);
  window.addEventListener("load", measure);
  /* Rail open / close, filters, and edit-mode card changes all reflow the grid. */
  if (window.ResizeObserver) { var main = document.querySelector("main"); if (main) new ResizeObserver(soon).observe(main); }
  document.addEventListener("mouseover", function (e) {
    var a = e.target.closest && e.target.closest("a.index-card[data-epithet]");
    if (a && a.id && last.indexOf("#" + esc(a.id) + "{") < 0) measure();
  }, true);
})();
