/* Continuous Journal: highlight the chapter whose heading has been reached.
   Same approach and threshold as index/index-scroll.js. */
(function () {
  function fixOld() {
    var old = /^#\/?journal\/(iii-[a-z]+)$/.exec(location.hash || "");
    var el = old && document.getElementById(old[1]);
    if (!el) return;
    history.replaceState(null, "", "#" + old[1]);
    el.scrollIntoView();
  }
  fixOld();
  var toc = document.querySelector("aside.toc");
  if (!toc) return;
  /* Chapters dropdown (tocdrop1): desktop rail always open; phone starts collapsed,
     closes after a pick, on an outside tap, or Escape — same as Codex Contents. */
  var drop = toc.querySelector("details.toc-drop");
  var phone = window.matchMedia("(max-width: 800px)");
  if (drop) {
    var secToggle = document.querySelector('#section-bar .sec-toggle[data-sec-for="toc-drop"]');
    var syncAria = function () {
      if (secToggle) secToggle.setAttribute("aria-expanded", drop.open ? "true" : "false");
    };
    var syncDrop = function () {
      drop.open = !phone.matches;
      syncAria();
    };
    syncDrop();
    if (phone.addEventListener) phone.addEventListener("change", syncDrop);
    else if (phone.addListener) phone.addListener(syncDrop);
    if (secToggle) {
      secToggle.addEventListener("click", function (e) {
        if (!phone.matches) return;
        e.preventDefault();
        e.stopPropagation();
        drop.open = !drop.open;
        syncAria();
      });
    }
    toc.addEventListener("click", function (e) {
      if (phone.matches && e.target.closest && e.target.closest("a[href^='#']")) {
        drop.open = false;
        syncAria();
      }
    });
    document.addEventListener("click", function (e) {
      if (!phone.matches || !drop.open) return;
      if (toc.contains(e.target)) return;
      if (e.target.closest && e.target.closest("#section-bar .sec-toggle")) return;
      drop.open = false;
      syncAria();
    });
    document.addEventListener("keydown", function (e) {
      if (phone.matches && drop.open && e.key === "Escape") {
        drop.open = false;
        syncAria();
      }
    });
  }
  var items = Array.prototype.map.call(toc.querySelectorAll("a[href^='#']"), function (a) {
    return { a: a, el: document.getElementById(a.getAttribute("href").slice(1)) };
  }).filter(function (item) { return item.el; });
  if (!items.length) return;
  var current = "";
  function highlight(id) {
    if (id === current) return;
    current = id;
    items.forEach(function (item) {
      item.a.classList.toggle("on", item.el.id === id);
    });
  }
  function update() {
    var mast = document.querySelector(".mast");
    var mastBottom = mast ? mast.getBoundingClientRect().bottom : 108;
    /* TOC highlight stays near the mast; bg art switches when art is near viewport center. */
    var line = mastBottom + 72;
    var artLine = window.innerHeight * 0.5;
    /* nt14: order-independent (the Journal can be shown oldest-first): the reached heading
       lowest on the page wins; before any is reached, the first on the page. */
    var id = "", best = -Infinity, first = "", firstTop = Infinity;
    items.forEach(function (item) {
      var t = item.el.getBoundingClientRect().top;
      if (t <= line && t > best) { best = t; id = item.el.id; }
      if (t < firstTop) { firstTop = t; first = item.el.id; }
    });
    highlight(id || first);
    follow(artLine);
  }
  /* Background art: chapter h1 → that chapter's first figure; then each later in-column
     figure switches the fixed bg as it crosses the highlight line (scroll order). */
  var layer = document.querySelector(".journal-bg img");
  var marks = [];
  if (layer) {
    var heads = Array.prototype.slice.call(document.querySelectorAll("main.read > h1[id]"));
    heads.forEach(function (h, i) {
      var next = heads[i + 1], node = h.nextElementSibling, first = true;
      while (node && node !== next) {
        var art = node.matches("figure") ? node.querySelector("img") : null;
        if (art) {
          var src = art.getAttribute("src");
          if (src && window.eloraeImg) src = window.eloraeImg.orig(src); /* img-resize: bg sized on its own */
          if (src) {
            /* Heading triggers first chapter art; later figures trigger on their own. */
            marks.push({ el: first ? h : art, src: src });
            first = false;
          }
        }
        node = node.nextElementSibling;
      }
    });
    var back = layer.cloneNode(false);
    back.classList.add("bg-off");
    layer.parentNode.appendChild(back);
    var cur0 = layer.getAttribute("src");
    if (window.eloraeImg) cur0 = window.eloraeImg.orig(cur0);
    back.setAttribute("data-eimg-orig", cur0);
    layer.setAttribute("data-eimg-orig", cur0);
    var layers = [layer, back], front = 0, shown = cur0, base = shown, want = shown;
  }
  /* img-resize: fixed full-viewport cover backdrop; ~7:3 art (/img.js). */
  var BG = { sizes: "(max-aspect-ratio: 7/3) 234vh, 100vw", min: 640, max: 2560, fallback: 1920 };
  function setLayer(img, src) {
    if (window.eloraeImg) window.eloraeImg.set(img, src, BG);
    else { img.setAttribute("src", src); img.setAttribute("data-eimg-orig", src); }
  }
  function swapTo(src) {
    if (src === want) return;
    want = src;
    var next = layers[1 - front];
    function show() {
      if (want !== src) return;
      next.classList.remove("bg-off");
      layers[front].classList.add("bg-off");
      front = 1 - front;
      shown = src;
    }
    if (next.getAttribute("data-eimg-orig") === src && next.complete) { show(); return; }
    next.onload = show;
    setLayer(next, src);
  }
  function follow(line) {
    if (!marks.length) return;
    var src = base, best = -Infinity;
    marks.forEach(function (m) {
      var t = m.el.getBoundingClientRect().top;
      if (t <= line && t > best) { best = t; src = m.src; }
    });
    if (src !== want) swapTo(src);
  }
  update();
  window.addEventListener("scroll", update, { passive: true });
  window.addEventListener("resize", update);
  window.addEventListener("hashchange", function () { fixOld(); window.setTimeout(update, 0); });
  window.addEventListener("load", update);
})();
