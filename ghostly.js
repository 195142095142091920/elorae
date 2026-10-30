/* The Journal of the Ghostly Wanderer: page script, image viewer, sidebar chapter refresh. */
/* The Journal of the Ghostly Wanderer: on phone the tab row scrolls sideways; bring the
   active tab into view on load. */
(function () {
  var bar = document.getElementById("section-bar"), on = bar && bar.querySelector("a.active");
  if (!on || bar.scrollWidth <= bar.clientWidth) return;
  bar.scrollLeft = Math.max(0, on.offsetLeft - (bar.clientWidth - on.offsetWidth) / 2);
})();

/* Image viewer: click an image to see it full screen (same look as the Atlas map viewer,
   #map-zoom in html.css). Click/tap anywhere, the close glyph or Escape closes.
   Delegated + idempotent, so tab swaps (swap.js) need no re-binding. */
(function () {
  if (window.__gwLightbox) return; window.__gwLightbox = 1;
  var box = null, big = null, opener = null;
  function pick(t) {
    if (!t || t.tagName !== "IMG" || t.closest(".gw-banner")) return null;
    return t.closest("main.read.gw") ? t : null;
  }
  function mark() {
    Array.prototype.forEach.call(document.querySelectorAll("main.read.gw img"), function (im) {
      if (im.closest(".gw-banner") || im.classList.contains("gw-zoomable")) return;
      im.classList.add("gw-zoomable"); im.tabIndex = 0;
    });
  }
  window.gwLightboxMark = mark;
  function build() {
    box = document.createElement("div");
    box.id = "map-zoom"; box.className = "gw-zoom"; box.hidden = true;
    box.setAttribute("role", "dialog"); box.setAttribute("aria-label", "Image");
    box.innerHTML = '<button type="button" class="map-zoom-close" aria-label="Close"><svg viewBox="0 0 14 14" aria-hidden="true"><path d="M1 1L13 13M13 1L1 13" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" vector-effect="non-scaling-stroke"/></svg></button>';
    big = document.createElement("img"); big.alt = ""; big.draggable = false; box.appendChild(big);
    document.body.appendChild(box);
    box.addEventListener("click", function (e) { e.stopPropagation(); close(); });
  }
  function open(src) {
    if (!(src.currentSrc || src.src)) return;
    if (!box || !box.isConnected) build();
    opener = src;
    big.src = src.currentSrc || src.src; big.alt = src.alt || "";
    box.hidden = false; document.documentElement.classList.add("map-zoom-open");
    box.querySelector(".map-zoom-close").focus({ preventScroll: true });
  }
  function close() {
    if (!box || box.hidden) return;
    box.hidden = true; document.documentElement.classList.remove("map-zoom-open");
    if (opener && opener.isConnected) opener.focus({ preventScroll: true });
  }
  window.gwLightboxClose = close;
  document.addEventListener("click", function (e) { var im = pick(e.target); if (im) open(im); });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") { close(); return; }
    if ((e.key === "Enter" || e.key === " ") && pick(e.target)) { e.preventDefault(); open(e.target); }
  });
  mark();
})();

/* Journal chapter list: refresh from the live Journal page so new chapters show up here too. */
(function () {
  var list = document.querySelector("aside.toc .toc-list");
  var old = list && list.querySelectorAll("a[data-jc]");
  if (!old || !old.length) return;
  fetch("/journal/", { cache: "no-cache" }).then(function (r) { return r.ok ? r.text() : ""; }).then(function (t) {
    var src = t && new DOMParser().parseFromString(t, "text/html").getElementById("toc-list");
    if (!src) return;
    var fresh = [];
    for (var n = src.firstElementChild; n && !n.classList.contains("toc-more"); n = n.nextElementSibling) {
      var h = n.tagName === "A" && n.getAttribute("href");
      if (!h || h.charAt(0) !== "#") continue;
      var a = document.createElement("a");
      a.href = "/journal/" + h; a.textContent = n.textContent; a.setAttribute("data-jc", "");
      fresh.push(a);
    }
    if (!fresh.length) return;
    var at = old[0];
    fresh.forEach(function (a) { list.insertBefore(a, at); });
    Array.prototype.forEach.call(old, function (a) { a.remove(); });
  }).catch(function () {});
})();
