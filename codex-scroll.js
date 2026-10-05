/* Codex Contents: highlight the section whose heading has reached the highlight line.
   Same approach and threshold as journal-scroll.js / index/index-scroll.js. */
(function () {
  var toc = document.querySelector("aside.toc");
  if (!toc) return;
  /* Contents dropdown (tocdrop1): desktop rail always open; phone starts collapsed,
     closes after a pick, on an outside tap, or Escape. */
  var drop = toc.querySelector("details.toc-drop");
  var phone = window.matchMedia("(max-width: 800px)");
  if (drop) {
    var syncDrop = function () { drop.open = !phone.matches; };
    syncDrop();
    if (phone.addEventListener) phone.addEventListener("change", syncDrop);
    else if (phone.addListener) phone.addListener(syncDrop);
    toc.addEventListener("click", function (e) {
      if (phone.matches && e.target.closest && e.target.closest("a[href^='#']")) drop.open = false;
    });
    document.addEventListener("click", function (e) {
      if (phone.matches && drop.open && !toc.contains(e.target)) drop.open = false;
    });
    document.addEventListener("keydown", function (e) {
      if (phone.matches && drop.open && e.key === "Escape") drop.open = false;
    });
    drop.addEventListener("toggle", function () {
      if (!phone.matches || !drop.open) return;
      var list = drop.querySelector(".toc-list"), on = drop.querySelector("a.on");
      if (list && on) list.scrollTop = Math.max(0, on.offsetTop - list.clientHeight / 2);
    });
  }
  var items = Array.prototype.map.call(toc.querySelectorAll("a[href^='#']"), function (a) {
    return { a: a, el: document.getElementById(a.getAttribute("href").slice(1)) };
  }).filter(function (item) { return item.el; });
  if (!items.length) return;
  var current = "";
  /* jump: section a Contents click / hash just sent the reader to. Near page bottom the last
     sections can never reach the highlight line, so the jumped-to one wins until the reader
     scrolls by hand (same idea as index-scroll.js). */
  var jump = "";
  function dropJump() { jump = ""; }
  ["wheel", "touchstart", "keydown", "mousedown"].forEach(function (t) {
    window.addEventListener(t, function (e) {
      if (t === "mousedown" && e.target.closest && e.target.closest("aside.toc a")) return;
      dropJump();
    }, { passive: true });
  });
  toc.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest("a[href^='#']");
    if (!a) return;
    jump = a.getAttribute("href").slice(1);
  });
  if (location.hash && location.hash.length > 1) jump = location.hash.slice(1);
  function highlight(id) {
    if (id === current) return;
    current = id;
    items.forEach(function (item) {
      item.a.classList.toggle("on", item.el.id === id);
    });
  }
  function keepInView(a) {
    if (window.innerWidth <= 800 || toc.scrollHeight <= toc.clientHeight) return;
    var t = a.getBoundingClientRect(), r = toc.getBoundingClientRect();
    if (t.top < r.top + 24) toc.scrollTop -= r.top + 24 - t.top;
    else if (t.bottom > r.bottom - 24) toc.scrollTop += t.bottom - (r.bottom - 24);
  }
  function update() {
    var mast = document.querySelector(".mast");
    var bar = document.getElementById("section-bar");
    var line = mast ? mast.getBoundingClientRect().bottom + 72 : 180;
    if (bar) {
      var bb = bar.getBoundingClientRect();
      if (bb.bottom > 0) line = Math.max(line, bb.bottom + 40);
    }
    if (drop && phone.matches) line = Math.max(line, toc.getBoundingClientRect().bottom + 40);
    var id = items[0].el.id;
    items.forEach(function (item) {
      if (item.el.getBoundingClientRect().top <= line) id = item.el.id;
    });
    var atEnd = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
    if (jump && atEnd) {
      var jumped = items.find(function (item) { return item.el.id === jump; });
      if (jumped) id = jump;
    }
    highlight(id);
    var on = items.find(function (item) { return item.el.id === id; });
    if (on) keepInView(on.a);
  }
  update();
  window.addEventListener("scroll", update, { passive: true });
  window.addEventListener("resize", update);
  window.addEventListener("hashchange", function () {
    if (location.hash && location.hash.length > 1) jump = location.hash.slice(1);
    window.setTimeout(update, 0);
  });
  window.addEventListener("load", update);
})();
