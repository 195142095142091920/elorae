/* Journal chapter prev/next (nt4). Additive; loaded with ?v= on journal.html only.
   The continuous Journal lists chapters newest first, so reading forward means scrolling up.
   At the end of every chapter (just before the next h1, or at the end of main.read) this adds
   a bare text row: "‹ III. XXX" (the earlier chapter) on the left and "III. XLI ›" (the later
   chapter) on the right, labelled from the Chapters rail. In-page #anchors only, so the
   existing journal-scroll.js highlight and scroll offsets apply. Rendered as <nav> (never an
   editable block for edit/), no boxes, no borders. Does nothing if there is <2 chapters. */
(function () {
  var main = document.querySelector("body.journal-flow main.read");
  if (!main || main.querySelector(".nt-chapnav")) return;
  var heads = Array.prototype.slice.call(main.querySelectorAll(":scope > h1[id]"));
  if (heads.length < 2) return;
  function label(h) {
    var a = document.querySelector('aside.toc a[href="#' + h.id + '"]');
    return (a && a.textContent.trim()) || h.textContent.trim();
  }
  var css = document.createElement("style");
  css.id = "nt-chapnav-css";
  css.textContent =
    ".nt-chapnav{display:flex;justify-content:space-between;align-items:baseline;gap:24px;clear:both}" +
    ".nt-chapnav a{font-family:Helvetica,Arial,sans-serif;font-size:11px;font-weight:400;font-style:normal;letter-spacing:.14em;" +
    "text-transform:uppercase;color:#8f8a82;text-decoration:none;border:0;background:none;text-shadow:0 1px 2px rgba(0,0,0,.85)}" +
    ".nt-chapnav a:hover,.nt-chapnav a:focus-visible{color:#f3eee6;outline:none}" +
    ".nt-chapnav a:focus-visible{text-decoration:underline;text-underline-offset:4px}" +
    ".nt-chapnav .nt-later{margin-left:auto;text-align:right}" +
    "@media (min-width:801px){.nt-chapnav{margin:44px 0 8px;padding:10px 0}}" +
    "@media (max-width:800px){.nt-chapnav{margin:34px 0 6px;padding:12px 0}.nt-chapnav a{padding:6px 0}}";
  document.head.appendChild(css);
  heads.forEach(function (h, i) {
    var later = heads[i - 1], earlier = heads[i + 1];
    var nav = document.createElement("nav");
    nav.className = "nt-chapnav";
    nav.setAttribute("aria-label", "Chapter navigation");
    if (earlier) {
      var e = document.createElement("a");
      e.className = "nt-earlier"; e.href = "#" + earlier.id; e.rel = "prev";
      e.setAttribute("aria-label", "Previous chapter, " + label(earlier));
      e.textContent = "\u2039\u2002" + label(earlier);
      nav.appendChild(e);
    }
    if (later) {
      var l = document.createElement("a");
      l.className = "nt-later"; l.href = "#" + later.id; l.rel = "next";
      l.setAttribute("aria-label", "Next chapter, " + label(later));
      l.textContent = label(later) + "\u2002\u203a";
      nav.appendChild(l);
    }
    var next = heads[i + 1];
    if (next) main.insertBefore(nav, next); else main.appendChild(nav);
  });
})();
