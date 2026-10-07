/* related-articles.js (nt16): adds two quiet rows to an article's existing "Related" section,
   in the site's own .art-rel-head / .art-related markup:
     - Place · <name>: other articles naming the same Atlas place this article names.
     - Seen together in the Journal: articles linked in the same Journal chapters as this one.
   Private subjects are never listed (search-index "private" entries, and anything the rails
   mark private), so nothing hidden is revealed. Links already in Related are not repeated.
   Runs at runtime only, inside #related (which edit mode's srcmap excludes), and not at all
   during an edit session. Private articles themselves get nothing. */
(function () {
  "use strict";
  if (!document.body.classList.contains("article")) return;
  var me = document.currentScript, ROOT = new URL("./", me.src).href;
  var here = (/articles\/([^\/?#]+)\.html/.exec(location.pathname) || [])[1]; if (!here) return;
  function editing() {
    try { if (sessionStorage.getItem("elorae-edit-session") || localStorage.getItem("elorae-edit-session")) return true; } catch (e) {}
    return /(^|#)edit\b/.test(location.hash) || document.documentElement.classList.contains("ee-editing");
  }
  var main = document.querySelector("main.art-body"), sec = document.getElementById("related");
  if (!main || !sec || main.classList.contains("private") || editing()) return;
  var PLACES = ["Winterlands", "Syr Sable", "Corranth", "Ilium Aghor", "Uma Sura", "Essen Revir", "Tumunz", "Jatar", "Elen Asva",
    "Far Nybei", "Kaiden", "Kanta Masa", "Gem Waste", "Celestial Sands", "Heartroot", "Shasir", "Nathalor"];
  function text(n) { return n ? n.textContent.replace(/\s+/g, " ").trim() : ""; }
  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  function has(t, w) { return new RegExp("\\b" + w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b").test(t); }
  var myText = text(main) + " " + text(document.querySelector(".art-title"));

  Promise.all([
    fetch(ROOT + "search-index.js").then(function (r) { return r.text(); }),
    fetch(ROOT + "journal.html").then(function (r) { return r.text(); })
  ]).then(function (res) {
    if (editing()) return;
    var t = res[0], all = JSON.parse(t.slice(t.indexOf("["), t.lastIndexOf("]") + 1));
    var private = {};
    all.forEach(function (e) { if (e.private) private[e.href] = 1; });
    Array.prototype.forEach.call(document.querySelectorAll(".private a[href], a.private[href], .private-group a[href], a[data-owner]"), function (a) {
      var m = /articles\/[^\/?#]+\.html/.exec(a.getAttribute("href") || ""); if (m) private[m[0]] = 1;
    });
    var others = all.filter(function (e) { return e.kind === "article" && !e.private && !private[e.href] && e.href !== "articles/" + here + ".html"; });
    var shown = {};
    Array.prototype.forEach.call(document.querySelectorAll("#related a[href], .nt-siblings a[href]"), function (a) { shown[new URL(a.getAttribute("href"), location.href).pathname] = 1; });
    function add(head, items) {
      items = items.filter(function (e) { var p = new URL(ROOT + e.href).pathname; if (shown[p]) return false; shown[p] = 1; return true; }).slice(0, 8);
      if (!items.length) return;
      sec.appendChild(el("p", "art-rel-head nt-rel-head", head));
      var ul = el("ul", "art-related nt-related");
      items.forEach(function (e) { var li = el("li"), a = el("a", null, e.title); a.href = ROOT + e.href; li.appendChild(a); ul.appendChild(li); });
      sec.appendChild(ul);
    }
    PLACES.filter(function (p) { return has(myText, p); }).slice(0, 2).forEach(function (p) {
      add("Place · " + p, others.filter(function (e) { return has(e.text || "", p) || has(e.title, p); }));
    });
    var d = new DOMParser().parseFromString(res[1], "text/html"), counts = {}, cur = null;
    function flush() { if (cur && cur["articles/" + here + ".html"]) Object.keys(cur).forEach(function (h) { counts[h] = (counts[h] || 0) + 1; }); }
    Array.prototype.forEach.call((d.querySelector("main") || d.body).children, function (n) {
      if (n.tagName === "H1") { flush(); cur = {}; return; }
      if (!cur) return;
      Array.prototype.forEach.call(n.querySelectorAll('a[href^="articles/"]'), function (a) { cur[a.getAttribute("href").split("#")[0]] = 1; });
    });
    flush();
    add("Seen together in the Journal", others.filter(function (e) { return counts[e.href]; })
      .sort(function (a, b) { return counts[b.href] - counts[a.href] || a.title.localeCompare(b.title); }));
  }).catch(function () {});
  window.addEventListener("elorae-edit-session", function () {
    Array.prototype.forEach.call(document.querySelectorAll(".nt-rel-head, .nt-related"), function (n) { n.remove(); });
  });
})();
