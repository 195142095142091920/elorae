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
    var line = mast ? mast.getBoundingClientRect().bottom + 72 : 180;
    var id = items[0].el.id;
    items.forEach(function (item) {
      if (item.el.getBoundingClientRect().top <= line) id = item.el.id;
    });
    highlight(id);
    follow(line);
  }
  /* Background art follows the chapter heading: when a chapter h1 reaches the highlight
     line, the fixed background crossfades to that chapter's first in-column image so
     the art is present for the whole chapter while reading (not delayed until the art). */
  var layer = document.querySelector(".journal-bg img");
  var marks = [];
  if (layer) {
    var heads = Array.prototype.slice.call(document.querySelectorAll("main.read > h1[id]"));
    heads.forEach(function (h, i) {
      var next = heads[i + 1], node = h.nextElementSibling, src = null;
      while (node && node !== next) {
        var art = node.matches("figure") ? node.querySelector("img") : null;
        if (art) { src = art.getAttribute("src"); break; }
        node = node.nextElementSibling;
      }
      if (src) marks.push({ el: h, src: src });
    });
    var back = layer.cloneNode(false);
    back.classList.add("bg-off");
    layer.parentNode.appendChild(back);
    var layers = [layer, back], front = 0, shown = layer.getAttribute("src"), base = shown, want = shown;
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
    if (next.getAttribute("src") === src && next.complete) { show(); return; }
    next.onload = show;
    next.setAttribute("src", src);
  }
  function follow(line) {
    if (!marks.length) return;
    var src = base;
    marks.forEach(function (m) {
      if (m.el.getBoundingClientRect().top <= line) src = m.src;
    });
    if (src !== want) swapTo(src);
  }
  update();
  window.addEventListener("scroll", update, { passive: true });
  window.addEventListener("resize", update);
  window.addEventListener("hashchange", function () { fixOld(); window.setTimeout(update, 0); });
  window.addEventListener("load", update);
})();
