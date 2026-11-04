/* Auto-links (al1, 2026-11-04). Every article's name — and every Capitalised Gallery tag on its
   hero/Art pictures — links to that article wherever the word appears in page text, site-wide.
   Map: /autolink.json (built by edit/autolink.js; admin saves keep it current, so a Gallery
   tag edit is picked up by every page on its next load — fetched fresh, nothing is rewritten).
   - Whole words, case-sensitive, longest name first ("Vaerek Rathkin" before "Vaerek");
     possessives work (Vaerek’s -> link on "Vaerek").
   - Body text only: never headings, nav, rails/TOC, asides, the art hero, buttons, existing links,
     or the page's own article.
   - Only articles this viewer may see (same rule as peek.js): private articles for their owner /
     Devin, secret pages per the visibility manifest. Hidden names stay plain text.
   - Runtime only: links are <a class="al-link">, removed before edit mode reads the
     page (editor.js calls EloraeAutolink.off()) and never while editing, so saves never contain them. */
(function () {
  "use strict";
  var doc = document, root = doc.documentElement;
  var MAP_URL = "/autolink.json";
  var SCOPE = "main.art-body, main.read";
  var SKIP = "a, h1, h2, h3, h4, h5, h6, nav, aside, header, footer, .toc, #section-bar, .art-hero, .art-index, .art-swap, " +
    "#related, .nt-related, .nt-siblings, .nt-chapnav, .art-title, button, input, textarea, select, label, code, pre, " +
    "script, style, svg, [contenteditable], [data-ee-ui], .cx-gen, .hover-card, #peek, .peek";
  var PLAYERS = { jack: 1, jon: 1, julie: 1, sawyer: 1, sylum: 1, jason: 1, devin: 1 };
  var stats = {}, map = null, rx = null, bySlug = null, stopped = false, scheduled = 0;

  function me() {
    var b = doc.body; if (b) for (var p in PLAYERS) if (b.classList.contains("login-" + p)) return p;
    try { var m = doc.cookie.match(/(?:^|;\s*)elorae-(?:login|seal)=([a-z]+)/); if (m && PLAYERS[m[1]]) return m[1]; } catch (e) {}
    try { var w = localStorage.getItem("elorae-login") || ""; if (PLAYERS[w]) return w; } catch (e) {}
    return "";
  }
  function manifest() { try { return (JSON.parse(sessionStorage.getItem("elorae-vis-man") || "null") || {}).secrets || {}; } catch (e) { return {}; } }
  // Same rule as peek.js: Devin sees all; owners see their private articles; secrets per manifest.
  function sees(slug, a) {
    var w = me(), sec = null, m = manifest();
    for (var id in m) { var s = m[id]; if (s && (s.path === "articles/" + slug + ".html" || s.path === "articles/" + slug + "/index.html")) { sec = s; break; } }
    if (!a.o && !sec) return true;
    if (w === "devin" || (a.o && a.o === w)) return true;
    return !!(sec && (sec.everyone || (w && (sec.owner === w || (sec.allowed || []).indexOf(w) >= 0))));
  }
  function editing() { return root.classList.contains("ee-editing") || root.classList.contains("ee-index-org") || location.hash === "#edit"; }
  function here() { var m = /^\/articles\/([^\/]+?)(?:\.html|\/(?:index\.html)?)?$/.exec(location.pathname); return m ? m[1] : ""; }
  function esc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/['\u2019]/g, "['\u2019]"); }

  function build() {
    if (!map) return false;
    var self = here(), terms = map.terms || {}, arts = map.articles || {}, keys = [];
    bySlug = {};
    Object.keys(terms).forEach(function (t) {
      var s = terms[t], a = arts[s];
      if (!a || s === self || !sees(s, a)) return;
      keys.push(t);
    });
    if (!keys.length) { rx = null; return false; }
    keys.sort(function (a, b) { return b.length - a.length; });
    // (^|non-word)(Term)(?!word) — no lookbehind, for older Safari.
    rx = new RegExp("(^|[^\\w\\u00C0-\\u024F])(" + keys.map(esc).join("|") + ")(?![\\w\\u00C0-\\u024F])", "g");
    return true;
  }
  function slugFor(word) {
    var t = map.terms, k = word.replace(/\u2019/g, "'");
    return t[word] || t[k] || t[word.replace(/'/g, "\u2019")] || "";
  }
  function linkIn(scope) {
    var list = [], w = doc.createTreeWalker(scope, NodeFilter.SHOW_TEXT, { acceptNode: function (t) {
      if (!t.nodeValue || t.nodeValue.length < 3 || !/[A-Z\u00C0-\u00DE]/.test(t.nodeValue)) return NodeFilter.FILTER_REJECT;
      var p = t.parentElement;
      return !p || p.closest(SKIP) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
    } });
    while (w.nextNode()) list.push(w.currentNode);
    var n = 0;
    list.forEach(function (t) {
      var s = t.nodeValue, m, last = 0, frag = null;
      rx.lastIndex = 0;
      while ((m = rx.exec(s))) {
        var start = m.index + m[1].length, word = m[2], slug = slugFor(word);
        if (!slug) continue;
        frag = frag || doc.createDocumentFragment();
        if (start > last) frag.appendChild(doc.createTextNode(s.slice(last, start)));
        var a = doc.createElement("a");
        a.className = "al-link"; a.href = "/articles/" + slug + "/";
        a.textContent = word;
        frag.appendChild(a); n++;
        last = start + word.length;
        rx.lastIndex = last;
      }
      if (!frag) return;
      if (last < s.length) frag.appendChild(doc.createTextNode(s.slice(last)));
      t.parentNode.replaceChild(frag, t);
    });
    return n;
  }
  function run() {
    scheduled = 0;
    if (stopped || editing() || !map) return;
    var t0 = performance.now();
    if (!build()) return;
    var n = 0;
    Array.prototype.forEach.call(doc.querySelectorAll(SCOPE), function (s) { n += linkIn(s); });
    root.setAttribute("data-autolinked", String(n + (+root.getAttribute("data-autolinked") || 0)));
    stats.links = n; stats.ms = Math.round((performance.now() - t0) * 10) / 10;
  }
  function later() {
    if (scheduled) return;
    var ric = window.requestIdleCallback || function (f) { return setTimeout(f, 1); };
    scheduled = ric(run, { timeout: 400 });
  }
  // Remove every generated link (text is put back exactly as it was).
  function off() {
    var parents = [];
    Array.prototype.forEach.call(doc.querySelectorAll("a.al-link"), function (a) {
      var p = a.parentNode; if (!p) return;
      p.replaceChild(doc.createTextNode(a.textContent), a);
      if (parents.indexOf(p) < 0) parents.push(p);
    });
    parents.forEach(function (p) { p.normalize(); });
    root.removeAttribute("data-autolinked");
  }
  function stop() { stopped = true; off(); }
  function resume() { stopped = false; if (!editing()) later(); }

  window.EloraeAutolink = { off: stop, on: resume, refresh: function () { off(); later(); }, map: function () { return map; }, stats: stats };

  if (!doc.querySelector(SCOPE) || doc.body && doc.body.classList.contains("index-page")) return;
  var st = doc.createElement("style");
  // Quieter than hand-made links: the text's own colour, a faint dotted underline (beats the Journal's link rule).
  st.textContent = "a.al-link{color:inherit!important;border-bottom:0!important;text-decoration:underline dotted rgba(214,190,140,.45)!important;text-decoration-thickness:1px!important;text-underline-offset:.22em;transition:color .15s,text-decoration-color .15s}" +
    "a.al-link:hover,a.al-link:focus-visible{color:#e6cf9a!important;text-decoration-color:rgba(230,207,154,.9)!important}";
  (doc.head || root).appendChild(st);

  fetch(MAP_URL, { cache: "no-cache" }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
    if (!j || !j.terms) return;
    map = j; later();
  }).catch(function () {});

  // Edit mode: never link while editing; link again after it ends.
  var wasEditing = editing();
  new MutationObserver(function () {
    var e = editing();
    if (e && !wasEditing) off();
    else if (!e && wasEditing) { stopped = false; later(); }
    wasEditing = e;
  }).observe(root, { attributes: true, attributeFilter: ["class"] });
  // New content (private journal tabs, visibility manifest arriving, login changes).
  window.addEventListener("elorae-content-swapped", function () { off(); later(); });
  doc.addEventListener("elorae-vis", function () { off(); later(); });
})();
