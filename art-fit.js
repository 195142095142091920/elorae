/* af1 (2026-11-03): click / tap the article hero art to see the whole picture inside the same hero
   frame, again to go back to the cover crop. The hero box never changes size; the image box
   shrinks (width / height / offset, ~350ms ease) from filling the hero (object-fit: cover, with
   its object-position, e.g. Filibeth's inline 62% 20%) to the picture's own proportions centred in
   it, so the crop opens up smoothly into the full image (object-fit itself cannot animate). The
   hero's black shows around it, with soft fades at the picture's top and bottom (html.css).
   Art-swap: switching art keeps the current mode (the new picture is fitted as soon as it loads).
   Not on clicks on the art-swap thumbnails / arrows, the name / epithet, links, buttons or the
   Categories rail; off in edit mode and on heroes without art. Mode is per visit (not saved).
   Replaces fa1 (full-art.js: icon + lightbox). */
(function () {
  "use strict";
  var doc = document, root = doc.documentElement;
  if (!doc.body || !doc.body.classList.contains("article")) return;
  var hero = null, img = null, full = false, ro = null;
  var reduce = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : { matches: false };
  function editing() { return root.classList.contains("ee-editing"); }
  function usable() { return hero && img && img.getAttribute("src") && !hero.classList.contains("no-art") && !editing(); }
  function label() { return full ? "Show the art cropped to the frame" : "Show the whole art"; }
  function fitBox() {
    var W = hero.clientWidth, H = hero.clientHeight;
    var nw = img.naturalWidth, nh = img.naturalHeight;
    if (!W || !H || !nw || !nh) return null;
    var r = nw / nh, w, h;
    if (W / H > r) { h = H; w = H * r; } else { w = W; h = W / r; }
    return { left: (W - w) / 2, top: (H - h) / 2, width: w, height: h };
  }
  function apply(animate) {
    if (!img) return;
    img.classList.toggle("art-fit-anim", !!animate && !reduce.matches);
    if (full) {
      var b = fitBox(); if (!b) return;
      img.style.inset = "auto";
      img.style.left = b.left + "px"; img.style.top = b.top + "px";
      img.style.width = b.width + "px"; img.style.height = b.height + "px";
    } else {
      ["inset", "left", "top", "width", "height"].forEach(function (k) { img.style[k] = ""; });
    }
    hero.classList.toggle("art-fit-full", full);
    img.setAttribute("aria-pressed", full ? "true" : "false");
    img.setAttribute("aria-label", label());
  }
  function prepareCrop() {
    // Start the animation from the exact cover box in px (transitions need concrete values).
    if (img.style.width) return;
    img.style.inset = "auto"; img.style.left = "0px"; img.style.top = "0px";
    img.style.width = hero.clientWidth + "px"; img.style.height = hero.clientHeight + "px";
    void img.offsetWidth;
  }
  function toggle() {
    if (!usable()) return;
    if (!img.naturalWidth) return;
    full = !full;
    if (full) { prepareCrop(); apply(true); }
    else {
      // Animate back to the full hero box, then hand back to the stylesheet (inset 0, 100%).
      img.classList.toggle("art-fit-anim", !reduce.matches);
      img.style.left = "0px"; img.style.top = "0px";
      img.style.width = hero.clientWidth + "px"; img.style.height = hero.clientHeight + "px";
      hero.classList.remove("art-fit-full");
      img.setAttribute("aria-pressed", "false"); img.setAttribute("aria-label", label());
      var done = function () { if (!full) { img.classList.remove("art-fit-anim"); ["inset", "left", "top", "width", "height"].forEach(function (k) { img.style[k] = ""; }); } };
      if (reduce.matches) done(); else setTimeout(done, 380);
    }
  }
  function ignored(t) {
    return !!(t && t.closest && t.closest(".art-swap, .art-title h1, .art-title .art-epithet, a, button, input, select, textarea, label, .art-index, #art-index, [contenteditable='true']"));
  }
  function mark(on) {
    if (!img) return;
    if (on) { img.setAttribute("role", "button"); img.tabIndex = 0; img.setAttribute("aria-pressed", full ? "true" : "false"); img.setAttribute("aria-label", label()); img.classList.add("art-fit-on"); }
    else { ["role", "tabindex", "aria-pressed", "aria-label"].forEach(function (a) { img.removeAttribute(a); }); img.classList.remove("art-fit-on"); }
  }
  function bind() {
    var h = doc.querySelector("body.article > section.art-hero, section.art-hero");
    var im = h && h.querySelector(":scope > img");
    if (h !== hero || im !== img) {
      if (img && img !== im) mark(false);
      hero = h; img = im;
      if (hero && !hero.__artFit) {
        hero.__artFit = 1;
        hero.addEventListener("click", function (e) {
          if (e.defaultPrevented || e.button !== 0 || ignored(e.target) || !usable()) return;
          toggle();
        });
        if (window.ResizeObserver) { ro = new ResizeObserver(function () { if (full) apply(false); }); ro.observe(hero); }
      }
      if (img && !img.__artFit) {
        img.__artFit = 1;
        img.addEventListener("load", function () { if (full && usable()) apply(false); });
        img.addEventListener("keydown", function (e) {
          if ((e.key === "Enter" || e.key === " " || e.key === "Spacebar") && usable()) { e.preventDefault(); toggle(); }
        });
      }
    }
    var ok = usable();
    mark(ok);
    if (!ok && full) { full = false; img && apply(false); }
  }
  new MutationObserver(bind).observe(root, { attributes: true, attributeFilter: ["class"] });
  bind();
  window.addEventListener("load", bind);
  window.EloraeArtFit = { toggle: toggle, isFull: function () { return full; } };
})();
