/* Index rail: highlights the category and card in view, opens the active category's names,
   and lets the small glyph open or close any category by hand (nest1). */
(function () {
  var toc = document.querySelector("aside.toc");
  if (!toc) return;
  var desk = window.matchMedia("(min-width: 801px)");
  function byHref(a) { return document.getElementById(a.getAttribute("href").slice(1)); }
  var cats = Array.prototype.map.call(toc.querySelectorAll(".toc-cat"), function (box) {
    var link = box.querySelector(".toc-row > a");
    return {
      box: box, link: link, el: link && byHref(link), tog: box.querySelector(".toc-tog"),
      subs: Array.prototype.map.call(box.querySelectorAll(".toc-sub"), function (a) { return { a: a, el: byHref(a) }; }),
      names: Array.prototype.map.call(box.querySelectorAll(".toc-name"), function (a) { return { a: a, el: byHref(a) }; }).filter(function (n) { return n.el; })
    };
  }).filter(function (c) { return c.el; });
  if (!cats.length) return;
  var current = null, manual = {}, pinned = "";
  function layout() {
    cats.forEach(function (c) {
      if (!c.tog) return;
      var id = c.el.id;
      var open = id in manual ? manual[id] : (desk.matches && c === current);
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
  toc.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest("a.toc-name");
    if (a) pinned = a.getAttribute("href").slice(1);
  });
  function pickCard(c, line) {
    var hit = null;
    for (var i = 0; i < c.names.length; i++) {
      var r = c.names[i].el.getBoundingClientRect();
      if (r.bottom > line) { hit = c.names[i]; break; }
    }
    if (!hit) return c.names[c.names.length - 1] || null;
    if (pinned) {
      var top = hit.el.getBoundingClientRect().top;
      for (var j = 0; j < c.names.length; j++) {
        if (c.names[j].el.id === pinned && Math.abs(c.names[j].el.getBoundingClientRect().top - top) < 2) return c.names[j];
      }
    }
    return hit;
  }
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
    if (cat !== current) {
      current = cat;
      if (desk.matches) manual = {};
      cats.forEach(function (c) { c.link.classList.toggle("on", c === cat); });
      layout();
    }
    var card = pickCard(cat, line);
    cats.forEach(function (c) {
      c.names.forEach(function (n) { n.a.classList.toggle("on", n === card); });
      c.subs.forEach(function (s) { s.a.classList.toggle("on", !!card && c === cat && s.a.parentNode === card.a.parentNode); });
    });
    if (card) keepInView(card.a);
  }
  update();
  window.addEventListener("scroll", update, { passive: true });
  window.addEventListener("resize", update);
  if (desk.addEventListener) desk.addEventListener("change", function () { manual = {}; layout(); update(); });
  window.addEventListener("hashchange", function () { pinned = location.hash.slice(1); window.setTimeout(update, 0); });
  window.addEventListener("load", function () { if (location.hash) pinned = location.hash.slice(1); update(); });
})();

/* Previous flat category highlighter (replaced by the nested rail above, nest1):
(function () {
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
      var heading = item.el.querySelector("h2");
      if (!heading) return;
      if (heading.getBoundingClientRect().top <= line) id = item.el.id;
    });
    highlight(id);
  }
  update();
  window.addEventListener("scroll", update, { passive: true });
  window.addEventListener("resize", update);
  window.addEventListener("hashchange", function () { window.setTimeout(update, 0); });
  window.addEventListener("load", update);
})();
*/
