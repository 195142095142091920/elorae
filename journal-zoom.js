/* Journal image viewer (shared): click any image in a journal page to see it full screen.
   Same look as the Atlas map viewer and the Ghostly Wanderer journal (#map-zoom in html.css).
   Click/tap anywhere, the close glyph or Escape closes. Event delegation on the document, so
   any chapter added to the page (or swapped in by seamless nav) is covered with no extra
   markup: just load /journal-zoom.js on the page. Skips the Atlas map (atlas-zoom.js), the
   Ghostly Wanderer pages (main.gw has its own viewer), banners and anything inside a link. */
(function () {
  if (window.__journalZoom) return; window.__journalZoom = 1;
  var css = document.createElement("style");
  css.textContent =
    "body.journal-page main.read:not(.gw) figure img:not(.atlas-map){cursor:zoom-in}" +
    "#map-zoom.jr-zoom,#map-zoom.jr-zoom img{cursor:zoom-out;touch-action:manipulation}" +
    "#map-zoom.jr-zoom img{transform:none;-webkit-tap-highlight-color:transparent}";
  document.head.appendChild(css);
  var box = null, big = null, opener = null;
  function pick(t) {
    if (!t || t.tagName !== "IMG") return null;
    if (t.classList.contains("atlas-map") || t.closest("a, .gw-banner, .journal-bg")) return null;
    var m = t.closest("main.read");
    if (!m || m.classList.contains("gw") || !document.body.classList.contains("journal-page")) return null;
    return t;
  }
  function build() {
    box = document.createElement("div");
    box.id = "map-zoom"; box.className = "jr-zoom"; box.hidden = true;
    box.setAttribute("role", "dialog"); box.setAttribute("aria-label", "Image");
    box.innerHTML = '<button type="button" class="map-zoom-close" aria-label="Close"><svg viewBox="0 0 14 14" aria-hidden="true"><path d="M1 1L13 13M13 1L1 13" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" vector-effect="non-scaling-stroke"/></svg></button>';
    big = document.createElement("img"); big.alt = ""; big.draggable = false; box.appendChild(big);
    document.body.appendChild(box);
    box.addEventListener("click", function (e) { e.stopPropagation(); close(); });
  }
  function open(im) {
    var cur = im.currentSrc || im.src; if (!cur) return;
    if (!box || !box.isConnected) build();
    opener = im;
    /* sharper than the inline size: ask the resizer for 1920px (originals can be huge) */
    var s = im.getAttribute("src") || cur;
    big.src = /\/cdn-cgi\/image\/[^\/]*width=\d+/.test(s) ? s.replace(/(\/cdn-cgi\/image\/[^\/]*?)width=\d+/, "$1width=1920") : cur;
    big.alt = im.alt || "";
    box.hidden = false; document.documentElement.classList.add("map-zoom-open");
    box.querySelector(".map-zoom-close").focus({ preventScroll: true });
  }
  function close() {
    if (!box || box.hidden) return;
    box.hidden = true; document.documentElement.classList.remove("map-zoom-open");
    if (opener && opener.isConnected) opener.focus({ preventScroll: true });
  }
  document.addEventListener("click", function (e) {
    if (document.documentElement.classList.contains("ee-editing")) return; // ic1: edit mode (caption tools) never zooms
    var im = pick(e.target); if (!im) return;
    e.preventDefault(); open(im);
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") { close(); return; }
    if ((e.key === "Enter" || e.key === " ") && pick(e.target) && !document.documentElement.classList.contains("ee-editing")) { e.preventDefault(); open(e.target); }
  });
  /* keyboard reach: make journal images focusable (also for chapters added later) */
  function tab(root) {
    Array.prototype.forEach.call((root || document).querySelectorAll("body.journal-page main.read:not(.gw) figure img:not(.atlas-map)"), function (im) { if (pick(im) && !im.hasAttribute("tabindex")) im.tabIndex = 0; });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { tab(); }); else tab();
  new MutationObserver(function () { tab(); }).observe(document.documentElement, { childList: true, subtree: true });
})();
