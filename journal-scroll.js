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
  }
  update();
  window.addEventListener("scroll", update, { passive: true });
  window.addEventListener("resize", update);
  window.addEventListener("hashchange", function () { fixOld(); window.setTimeout(update, 0); });
  window.addEventListener("load", update);
})();
