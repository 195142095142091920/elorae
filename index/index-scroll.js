/* Index rail: highlight the category in view only (categories-only on scroll).
   Nests stay closed until the chevron is tapped; no card highlight while scrolling. */
(function () {
  var toc = document.querySelector("aside.toc");
  if (!toc) return;
  var desk = window.matchMedia("(min-width: 801px)");
  function byHref(a) { return document.getElementById(a.getAttribute("href").slice(1)); }
  var cats = Array.prototype.map.call(toc.querySelectorAll(".toc-cat"), function (box) {
    var link = box.querySelector(".toc-row > a");
    return {
      box: box, link: link, el: link && byHref(link), tog: box.querySelector(".toc-tog")
    };
  }).filter(function (c) { return c.el; });
  if (!cats.length) return;
  var current = null, manual = {}, jump = "";
  /* jump: the section a link or hash just sent the reader to. Near the page bottom the last
     sections can never reach the highlight line, so the jumped-to one wins there until the
     reader scrolls by hand (end1). */
  function dropJump() { jump = ""; }
  ["wheel", "touchstart", "keydown", "mousedown"].forEach(function (t) {
    window.addEventListener(t, function (e) {
      if (t === "mousedown" && e.target.closest && e.target.closest("aside.toc a")) return;
      dropJump();
    }, { passive: true });
  });
  function jumpCat() {
    if (!jump) return null;
    var el = document.getElementById(jump);
    var sec = el && el.closest && el.closest(".index-cat");
    for (var i = 0; i < cats.length; i++) if (cats[i].el === sec) return cats[i];
    return null;
  }
  function layout() {
    cats.forEach(function (c) {
      if (!c.tog) return;
      var id = c.el.id;
      /* Categories-only on scroll: open only from the chevron (manual), never from scroll. */
      var open = id in manual ? manual[id] : false;
      c.box.classList.toggle("open", open);
      c.tog.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }
  cats.forEach(function (c) {
    if (!c.tog) return;
    c.tog.addEventListener("click", function () {
      manual[c.el.id] = !c.box.classList.contains("open");
      layout();
    });
  });
  function keepInView(a) {
    if (!desk.matches || toc.scrollHeight <= toc.clientHeight) return;
    var t = a.getBoundingClientRect(), r = toc.getBoundingClientRect();
    if (t.top < r.top + 24) toc.scrollTop -= r.top + 24 - t.top;
    else if (t.bottom > r.bottom - 24) toc.scrollTop += t.bottom - (r.bottom - 24);
  }
  function update() {
    var mast = document.querySelector(".mast");
    var line = mast ? mast.getBoundingClientRect().bottom + 72 : 180;
    var cat = cats[0];
    var atEnd = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
    cats.forEach(function (c) {
      var h = c.el.querySelector("h2");
      if (!h) return;
      var top = h.getBoundingClientRect().top;
      if (top <= line || (atEnd && top < window.innerHeight)) cat = c;
    });
    var jc = atEnd && jumpCat();
    if (jc && jc.el.getBoundingClientRect().bottom > 0 && jc.el.getBoundingClientRect().top < window.innerHeight) cat = jc;
    if (cat !== current) {
      current = cat;
      cats.forEach(function (c) { c.link.classList.toggle("on", c === cat); });
      layout();
      if (cat && cat.link) keepInView(cat.link);
    }
  }
  layout();
  update();
  window.addEventListener("scroll", update, { passive: true });
  window.addEventListener("resize", update);
  if (desk.addEventListener) desk.addEventListener("change", function () { layout(); update(); });
  toc.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest("a[href^='#']");
    if (a) { jump = a.getAttribute("href").slice(1); window.setTimeout(update, 0); }
  });
  window.addEventListener("hashchange", function () { jump = location.hash.slice(1); window.setTimeout(update, 0); });
  window.addEventListener("load", function () { if (location.hash) jump = location.hash.slice(1); update(); });
})();
