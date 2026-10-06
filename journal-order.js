/* Journal order toggle (nt14). Loaded with ?v= on journal.html, after journal-chapnav.js.
   The continuous Journal is written newest chapter first. A bare "⇅" glyph at the head of the
   Chapters rail flips the page to oldest first (and back); the choice is kept in localStorage
   (elorae-journal-order). Only whole chapter blocks move (each <h1 id> with everything up to
   the next one, including its nt4 prev/next row); no prose is touched. The rail links are
   reordered to match. journal-scroll.js (nt14 change) picks the reached heading by position,
   so highlight and background art follow either order.
   Edit safety: edit/ pairs live blocks with the page source by position, so while an editor
   session exists (or #edit) the natural order is kept and the glyph is not shown. */
(function () {
  var KEY = "elorae-journal-order";
  var main = document.querySelector("body.journal-flow main.read");
  var list = document.getElementById("toc-list") || document.querySelector("aside.toc");
  if (!main || !list) return;
  var heads = Array.prototype.slice.call(main.querySelectorAll(":scope > h1[id]"));
  if (heads.length < 2) return;
  function editing() {
    try {
      if (location.hash === "#edit") return true;
      return !!(sessionStorage.getItem("elorae-edit-session") || localStorage.getItem("elorae-edit-session"));
    } catch (e) { return false; }
  }
  /* Natural blocks, captured once in source order. */
  var blocks = heads.map(function (h, i) {
    var nodes = [h], n = h.nextSibling, next = heads[i + 1] || null;
    while (n && n !== next) { nodes.push(n); n = n.nextSibling; }
    return nodes;
  });
  var links = Array.prototype.slice.call(list.querySelectorAll('a[href^="#"]'));
  var linkParent = links.length ? links[0].parentNode : null;
  var order = "newest";

  function currentHead() {
    var line = (document.querySelector(".mast") || document.body).getBoundingClientRect().bottom + 80, best = null, bt = -Infinity;
    heads.forEach(function (h) { var t = h.getBoundingClientRect().top; if (t <= line && t > bt) { bt = t; best = h; } });
    return best;
  }
  function apply(o, keepPlace) {
    if (o !== "oldest") o = "newest";
    if (o === order && !keepPlace) { paint(); return; }
    var anchor = keepPlace && window.scrollY > 80 ? currentHead() : null;
    var seq = o === "oldest" ? blocks.slice().reverse() : blocks;
    var frag = document.createDocumentFragment();
    seq.forEach(function (nodes) { nodes.forEach(function (n) { frag.appendChild(n); }); });
    main.appendChild(frag);
    if (linkParent) {
      var ls = o === "oldest" ? links.slice().reverse() : links;
      ls.forEach(function (a) { linkParent.appendChild(a); });
    }
    order = o;
    document.documentElement.classList.toggle("journal-oldest-first", o === "oldest");
    paint();
    if (anchor) anchor.scrollIntoView({ block: "start" });
    else if (keepPlace) window.scrollTo(0, 0);
    window.dispatchEvent(new Event("scroll"));
  }

  var btn = document.createElement("button");
  btn.type = "button";
  btn.className = "nt-order";
  btn.innerHTML = '<span class="nt-order-glyph" aria-hidden="true">\u21c5</span><span class="nt-order-label"></span>';
  function paint() {
    var old = order === "oldest";
    btn.setAttribute("aria-pressed", old ? "true" : "false");
    btn.setAttribute("aria-label", old ? "Showing oldest chapter first. Show newest first" : "Showing newest chapter first. Show oldest first");
    btn.title = old ? "Oldest first" : "Newest first";
    btn.querySelector(".nt-order-label").textContent = old ? "Oldest first" : "Newest first";
  }
  btn.addEventListener("click", function (e) {
    e.preventDefault(); e.stopPropagation();
    var o = order === "oldest" ? "newest" : "oldest";
    try { localStorage.setItem(KEY, o); } catch (x) {}
    apply(o, true);
  });

  var css = document.createElement("style");
  css.id = "nt-order-css";
  css.textContent =
    ".nt-order{appearance:none;-webkit-appearance:none;background:none;border:0;margin:0;padding:0;cursor:pointer;display:flex;align-items:baseline;gap:8px;" +
    "font-family:Helvetica,Arial,sans-serif;font-size:11px;font-weight:400;letter-spacing:.14em;text-transform:uppercase;color:#8f8a82;text-align:left}" +
    ".nt-order:hover,.nt-order:focus-visible{color:#f3eee6;outline:none}" +
    ".nt-order:focus-visible .nt-order-label{text-decoration:underline;text-underline-offset:4px}" +
    ".nt-order-glyph{font-size:13px;letter-spacing:0}" +
    "html.nt-order-off .nt-order{display:none}" +
    "@media (min-width:801px){.nt-order{margin:0 0 14px}}" +
    "@media (max-width:800px){.nt-order{padding:12px 0 10px;width:100%}}";
  document.head.appendChild(css);
  var h3 = list.querySelector("h3");
  if (h3 && h3.parentNode === list) list.insertBefore(btn, h3.nextSibling);
  else list.insertBefore(btn, list.firstChild);

  if (editing()) { document.documentElement.classList.add("nt-order-off"); paint(); }
  else {
    var saved = "newest";
    try { saved = localStorage.getItem(KEY) || "newest"; } catch (e) {}
    if (saved === "oldest" && !location.hash) apply("oldest", false);
    else if (saved === "oldest") { apply("oldest", false); var t = document.getElementById(location.hash.slice(1)); if (t) t.scrollIntoView(); }
    else paint();
  }
  /* An editor signs in on this page: back to source order, hide the glyph. */
  window.addEventListener("elorae-edit-session", function () {
    if (!editing()) return;
    if (order !== "newest") apply("newest", true);
    document.documentElement.classList.add("nt-order-off");
  });
})();
