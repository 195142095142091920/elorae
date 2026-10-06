/* atlas-hotspots.js (nt19), on atlas.html. Bare ring glyphs on the map's own printed place
   names (positions are % of assets/EloraeLowRes.png, checked against the printed labels).
   Choosing one lists, under the map: the place's Atlas page (if any), the articles whose
   search-index text names it or one of its regions, and the Journal chapters that name it.
   Sealed articles are never listed. Clicking the map itself still opens the zoom view.
   Built at runtime only (the info panel is an <aside>, which edit mode's srcmap skips), and not
   at all during an edit session. */
(function () {
  "use strict";
  var img = document.querySelector("main.read figure img.atlas-map");
  if (!img || document.getElementById("nt-place")) return;
  function editing() {
    try { if (sessionStorage.getItem("elorae-edit-session") || localStorage.getItem("elorae-edit-session")) return true; } catch (e) {}
    return /(^|#)edit\b/.test(location.hash) || document.documentElement.classList.contains("ee-editing");
  }
  if (editing()) return;
  var ROOT = new URL("./", document.currentScript.src).href;
  var PLACES = [
    { name: "The Winterlands", x: 49, y: 6, terms: ["Winterlands"] },
    { name: "Syr Sable", x: 58, y: 39, terms: ["Syr Sable"] },
    { name: "Corranth", x: 74, y: 27, terms: ["Corranth"] },
    { name: "Hesk", x: 83, y: 40, atlas: "atlas/hesk.html", terms: ["Hesk", "Archwood", "Greenrealm"] },
    { name: "Ilium Aghor", x: 23, y: 54, terms: ["Ilium Aghor"] },
    { name: "Uma Sura", x: 39.5, y: 47, terms: ["Uma Sura"] },
    { name: "Essen Revir", x: 55, y: 73, atlas: "atlas/essen-revir.html", terms: ["Essen Revir", "Tumunz", "Jatar", "Elen Asva"] },
    { name: "Far Nybei", x: 88, y: 83, atlas: "atlas/far-nybei.html", terms: ["Nybei", "Kaiden", "Kanta Masa", "Kuroishi", "Redroot"] },
    { name: "Cosm", x: 55, y: 92, atlas: "atlas/cosm.html", terms: ["Cosm", "Gem Waste"] }
  ];
  function text(n) { return n ? n.textContent.replace(/\s+/g, " ").trim() : ""; }
  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  function link(href, t) { var a = el("a", null, t); a.href = ROOT + href; return a; }
  function re(terms) { return new RegExp("\\b(" + terms.map(function (t) { return t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }).join("|") + ")\\b"); }

  var css = document.createElement("style");
  css.id = "nt-hot-css";
  css.textContent =
    ".nt-map{position:relative;display:block}" +
    ".nt-hot{position:absolute;transform:translate(-50%,-50%);padding:0;margin:0;border:0;background:none;color:rgba(255,250,240,.92);" +
    "cursor:pointer;filter:drop-shadow(0 0 3px rgba(0,0,0,.85))}" +
    ".nt-hot svg{width:100%;height:100%;display:block}" +
    ".nt-hot.on{color:#f6d58a}" +
    "#nt-place:empty{display:none}" +
    "#nt-place{margin:18px 0 28px;text-align:left}" +
    "#nt-place .nt-place-name{font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:#f3eee6;margin:0 0 10px}" +
    "#nt-place .nt-place-row{display:flex;gap:14px;align-items:baseline;margin:0 0 6px;font-size:15px;line-height:1.55}" +
    "#nt-place .nt-place-k{flex:0 0 5.5em;font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:#8f8a82}" +
    "#nt-place a{color:#cfc6b8}" +
    "html.ee-editing .nt-hot,html.ee-editing #nt-place{display:none !important}" +
    "@media (min-width:801px){.nt-hot{width:30px;height:30px}.nt-hot:hover,.nt-hot:focus-visible{color:#f6d58a;outline:none}#nt-place a:hover{color:#fff}}" +
    "@media (max-width:800px){.nt-hot{width:26px;height:26px}#nt-place .nt-place-row{flex-direction:column;gap:2px;margin-bottom:10px}#nt-place .nt-place-k{flex:none}}";
  document.head.appendChild(css);

  var wrap = el("span", "nt-map");
  img.parentNode.insertBefore(wrap, img); wrap.appendChild(img);
  var info = el("aside"); info.id = "nt-place"; info.setAttribute("aria-live", "polite");
  var fig = img.closest("figure"); fig.parentNode.insertBefore(info, fig.nextSibling);

  Promise.all([
    fetch(ROOT + "search-index.js").then(function (r) { return r.text(); }),
    fetch(ROOT + "journal.html").then(function (r) { return r.text(); })
  ]).then(function (res) {
    if (editing()) return;
    var t = res[0], arts = JSON.parse(t.slice(t.indexOf("["), t.lastIndexOf("]") + 1))
      .filter(function (e) { return e.kind === "article" && !e.private; });
    var d = new DOMParser().parseFromString(res[1], "text/html"), chs = [], cur = null;
    Array.prototype.forEach.call((d.querySelector("main") || d.body).children, function (n) {
      if (n.tagName === "H1" && n.id) { cur = { id: n.id, title: text(n), text: "" }; chs.push(cur); return; }
      if (cur && !/^(NAV|ASIDE|SCRIPT)$/.test(n.tagName)) cur.text += " " + text(n);
    });
    PLACES.forEach(function (pl, i) {
      var rx = re(pl.terms);
      pl.articles = arts.filter(function (a) { return rx.test(a.text || "") || rx.test(a.title); });
      pl.chapters = chs.filter(function (c) { return rx.test(c.text); });
      var b = el("button", "nt-hot"); b.type = "button";
      b.style.left = pl.x + "%"; b.style.top = (pl.y - 4) + "%";   /* the ring sits just above the printed label */
      b.setAttribute("aria-label", pl.name); b.setAttribute("aria-controls", "nt-place");
      b.innerHTML = '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="6" fill="none" stroke="currentColor" stroke-width="1.2"/><circle cx="10" cy="10" r="1.6" fill="currentColor"/></svg>';
      b.addEventListener("click", function (e) { e.stopPropagation(); show(pl, b); });
      wrap.appendChild(b);
    });
  }).catch(function () {});

  function show(pl, btn) {
    var again = btn.classList.contains("on");
    Array.prototype.forEach.call(wrap.querySelectorAll(".nt-hot"), function (x) { x.classList.toggle("on", !again && x === btn); x.setAttribute("aria-expanded", String(!again && x === btn)); });
    info.textContent = "";
    if (again) return;
    info.appendChild(el("div", "nt-place-name", pl.name));
    function row(label, nodes) {
      if (!nodes.length) return;
      var r = el("div", "nt-place-row"); r.appendChild(el("span", "nt-place-k", label));
      var v = el("span", "nt-place-v");
      nodes.forEach(function (n, i) { if (i) v.appendChild(document.createTextNode(" \u00b7 ")); v.appendChild(n); });
      r.appendChild(v); info.appendChild(r);
    }
    row("Atlas", pl.atlas ? [link(pl.atlas, pl.name)] : []);
    row("Articles", pl.articles.map(function (a) { return link(a.href, a.title); }));
    row("Chapters", pl.chapters.map(function (c) { return link("journal.html#" + c.id, c.title.replace(/^Act ([IVX]+), Chapter /, "$1. ")); }));
    if (info.children.length === 1) info.appendChild(el("div", "nt-place-row", "\u2014"));
  }
  window.addEventListener("elorae-edit-session", function () {
    Array.prototype.forEach.call(wrap.querySelectorAll(".nt-hot"), function (b) { b.remove(); });
    info.remove();
  });
})();
