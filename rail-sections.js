/* rd1/rd2 (2026-11-03): one shared expand / collapse handler for the Categories rail sections, on the
   Index (aside.toc.index-toc) and on article pages (aside.art-index). The whole header row (the
   section title and its arrow) is a single toggle: role="button" on the title, aria-expanded,
   Enter / Space, no navigation (the title used to jump to the Index section). Entries inside the
   dropdown still navigate. A section with nothing to expand keeps its plain link.
   Why: art-index.js re-centred the panel on the current article on every focus change, so pressing
   an arrow could scroll the panel between press and release and the click landed on something
   else ("works only sometimes" on article pages); the two pages also had separate handlers. The
   row now never takes mouse focus, and the panel is only re-centred when the rail opens.
   The Index organizer's own capture-phase title clicks (move selected card) still win. */
(function () {
  "use strict";
  if (window.__railSections) return; window.__railSections = 1;
  var SEL = "#index-toc-panel .toc-row, #art-index-panel .toc-row";
  var n = 0;
  function parts(row) {
    var box = row.parentElement;
    var nest = null;
    for (var c = row.nextElementSibling; c; c = c.nextElementSibling) if (c.classList.contains("toc-nest")) { nest = c; break; }
    var a = null;
    for (var k = row.firstElementChild; k; k = k.nextElementSibling) if (k.tagName === "A") { a = k; break; }
    return { box: box, row: row, nest: nest, a: a, tog: row.querySelector(".toc-tog") };
  }
  function expandable(p) { return !!(p.box && p.box.classList.contains("toc-cat") && p.nest && p.nest.children.length); }
  function mark(p) {
    var on = p.box.classList.contains("open") ? "true" : "false";
    if (p.a) p.a.setAttribute("aria-expanded", on);
    if (p.tog) p.tog.setAttribute("aria-expanded", on);
  }
  function prep(row) {
    var p = parts(row);
    if (!expandable(p) || row.__rs) return p;
    row.__rs = 1;
    if (!p.nest.id) p.nest.id = "toc-nest-" + (++n);
    if (p.a) { p.a.setAttribute("role", "button"); p.a.setAttribute("aria-controls", p.nest.id); }
    // One keyboard stop per row: the title is the button, the arrow is its picture.
    if (p.tog) { p.tog.tabIndex = -1; p.tog.setAttribute("aria-hidden", "true"); }
    mark(p);
    return p;
  }
  function prepAll() { Array.prototype.forEach.call(document.querySelectorAll(SEL), prep); }
  function toggle(p) {
    var on = !p.box.classList.contains("open");
    p.box.classList.toggle("open", on);
    mark(p);
    try { document.dispatchEvent(new CustomEvent("elorae-rail-section", { detail: { box: p.box, open: on } })); } catch (e) {}
  }
  function rowFrom(t) { return t && t.closest ? t.closest(SEL) : null; }
  // No mouse focus on the row: focus would make the rail re-sync and can move the panel mid-click.
  document.addEventListener("mousedown", function (e) {
    var row = rowFrom(e.target);
    if (!row || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (expandable(prep(row))) e.preventDefault();
  });
  document.addEventListener("click", function (e) {
    if (e.defaultPrevented) return;
    var row = rowFrom(e.target);
    if (!row) return;
    var p = prep(row);
    if (!expandable(p)) return;
    if (e.target.closest(".toc-row > a") && (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)) return; // new tab etc.
    e.preventDefault();
    toggle(p);
  });
  document.addEventListener("keydown", function (e) {
    if (e.key !== " " && e.key !== "Spacebar") return;
    var a = e.target && e.target.closest && e.target.closest(".toc-row > a[role='button']");
    if (!a || !rowFrom(a)) return;
    e.preventDefault();
    toggle(parts(rowFrom(a)));
  });
  /* rd2: article-page rails are a copy of the Index rail (/index/ancients/, the one source). The
     copies baked into article pages went stale when cards were added straight to the Index (the
     25 Divines: no entries, so no arrow). build() turns the Index rail into the article rail:
     section links -> /index/ancients/#<section>, card links -> the card's article URL, privacy
     marks (private-group, .private[data-owner]) kept as they are on the Index, the current article
     and its section marked on / open. tools/sync-article-rails.js writes it into every article page
     (both copies); at runtime an article page refreshes its rail from the Index when they differ,
     so a new card shows everywhere straight away. */
  var INDEX_URL = "/index/ancients/";
  function railKey(panel) {
    return Array.prototype.map.call(panel.querySelectorAll(".toc-cat a[href]"), function (a) {
      var c = (a.getAttribute("class") || "").split(/\s+/).filter(function (x) { return x && x !== "on"; }).join(".");
      var box = a.closest(".toc-cat"), g = box && /private-group/.test(box.className) ? "!" : "";
      return g + c + "|" + (a.getAttribute("data-owner") || "") + "|" + a.getAttribute("href") + "|" + a.textContent.trim();
    }).join("\n");
  }
  function build(indexDoc, path, prevOnSection) {
    var src = indexDoc.getElementById("index-toc-panel");
    if (!src) return null;
    var frag = document.createDocumentFragment(), onBox = null, hits = [];
    Array.prototype.forEach.call(src.querySelectorAll(":scope > .toc-cat"), function (cat) {
      var box = document.importNode(cat, true);
      box.classList.remove("open");
      Array.prototype.forEach.call(box.querySelectorAll("a[href]"), function (a) {
        a.classList.remove("on"); a.removeAttribute("role"); a.removeAttribute("aria-expanded"); a.removeAttribute("aria-controls");
        var h = a.getAttribute("href") || "";
        if (h.charAt(0) !== "#") return;
        var id = h.slice(1), card = indexDoc.getElementById(id);
        var to = card && card.matches && card.matches("a.index-card") ? card.getAttribute("href") : "";
        a.setAttribute("href", to && /^\/articles\//.test(to) ? to : INDEX_URL + h);
        if (a.matches(".toc-name") && to && to === path) hits.push([box, a]);
      });
      Array.prototype.forEach.call(box.querySelectorAll(".toc-tog"), function (t) { t.setAttribute("aria-expanded", "false"); t.removeAttribute("tabindex"); t.removeAttribute("aria-hidden"); });
      Array.prototype.forEach.call(box.querySelectorAll(".toc-nest[id^='toc-nest-']"), function (n) { n.removeAttribute("id"); });
      frag.appendChild(box);
    });
    // Listed in more than one section: the one this page already marked, else the first.
    var rowHref = function (b) { var r = b.querySelector(".toc-row > a"); return r && r.getAttribute("href"); };
    var hit = hits.filter(function (h) { return prevOnSection && rowHref(h[0]) === prevOnSection; })[0] || hits[0];
    if (hit) { onBox = hit[0]; hit[1].classList.add("on"); }
    if (!onBox && prevOnSection) {
      Array.prototype.forEach.call(frag.querySelectorAll(":scope > .toc-cat"), function (b) { var r = b.querySelector(".toc-row > a"); if (r && r.getAttribute("href") === prevOnSection) onBox = b; });
    }
    if (onBox) {
      var row = onBox.querySelector(".toc-row > a"); if (row) row.classList.add("on");
      if (onBox.querySelector(".toc-nest a")) { onBox.classList.add("open"); var tg = onBox.querySelector(".toc-tog"); if (tg) tg.setAttribute("aria-expanded", "true"); }
    }
    return frag;
  }
  function syncArticleRail() {
    var panel = document.getElementById("art-index-panel");
    if (!panel || !window.fetch || !window.DOMParser) return;
    fetch(INDEX_URL, { credentials: "same-origin" }).then(function (r) { return r.ok ? r.text() : null; }).then(function (t) {
      if (!t) return;
      var idoc = new DOMParser().parseFromString(t, "text/html");
      var prev = panel.querySelector(".toc-cat > .toc-row > a.on");
      var frag = build(idoc, location.pathname, prev && prev.getAttribute("href"));
      if (!frag || !frag.childNodes.length) return;
      var probe = document.createElement("div"); probe.appendChild(frag.cloneNode(true));
      if (railKey(probe) === railKey(panel)) return; // up to date: leave the page's own rail alone
      // Keep what the reader opened / closed.
      var open = {};
      Array.prototype.forEach.call(panel.querySelectorAll(".toc-cat"), function (b) { var r = b.querySelector(".toc-row > a"); if (r) open[r.getAttribute("href")] = b.classList.contains("open"); });
      Array.prototype.forEach.call(frag.querySelectorAll(":scope > .toc-cat"), function (b) {
        var r = b.querySelector(".toc-row > a"), k = r && r.getAttribute("href");
        if (k in open && b.querySelector(".toc-nest a")) { b.classList.toggle("open", open[k]); var tg = b.querySelector(".toc-tog"); if (tg) tg.setAttribute("aria-expanded", open[k] ? "true" : "false"); }
      });
      var st = panel.scrollTop;
      Array.prototype.forEach.call(panel.querySelectorAll(":scope > .toc-cat"), function (b) { b.remove(); });
      panel.appendChild(frag);
      panel.scrollTop = st;
      prepAll();
      try { document.dispatchEvent(new CustomEvent("elorae-rail-synced")); } catch (e) {}
    }).catch(function () {});
  }
  function boot() {
    prepAll();
    if (document.getElementById("art-index-panel")) {
      var go = function () { (window.requestIdleCallback || function (f) { setTimeout(f, 300); })(syncArticleRail); };
      if (document.readyState === "complete") go(); else window.addEventListener("load", go);
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
  window.EloraeRailSections = { prep: prepAll, build: build, railKey: railKey, sync: syncArticleRail, toggle: function (box) { var r = box && box.querySelector(".toc-row"); if (r) toggle(prep(r)); } };
})();

/* re1 (2026-11-03; was ix1 in index/index-scroll.js): empty sections are hidden for everyone but
   Devin, on the Index and in every article-page rail, by one rule. A section / subsection with
   nothing this viewer can see (after the private / owner gating in html.css, so a group holding
   only someone else's private entries counts as empty) is hidden, with its Categories entry; a
   section whose subsections are all empty goes too. Devin, the Index organizer and edit mode see
   every section. The Index counts its visible cards; an article page, which has no cards, counts the
   rail entries, which are the Index's cards with the same privacy marks (rd2 keeps them in sync).
   Recomputed on sign-in/out (body class), organizer / edit mode, card or rail changes. */
(function () {
  "use strict";
  var HIDE = "ix-hide";
  if (!document.getElementById("ix-hide-style")) {
    var st = document.createElement("style"); st.id = "ix-hide-style";
    st.textContent = "." + HIDE + "{display:none!important}";
    document.head.appendChild(st);
  }
  function seesAll() {
    return document.body.classList.contains("login-devin") || document.documentElement.classList.contains("ee-index-org") || document.documentElement.classList.contains("ee-editing");
  }
  // The rule, shared: sections [{ n, nodes, groups: [{ n, nodes }] }] -> nodes to hide.
  function emptyRule(secs) {
    var hide = [];
    secs.forEach(function (s) {
      if (!s.n) { hide.push.apply(hide, s.nodes); return; }
      s.groups.forEach(function (g) { if (!g.n) hide.push.apply(hide, g.nodes); });
      hide.push.apply(hide, s.extra || []);
    });
    return hide;
  }
  function esc(id) { return window.CSS && CSS.escape ? CSS.escape(id) : id; }
  // Index: count the cards a viewer can see.
  function indexSpec(main, toc) {
    function tocFor(id) {
      if (!toc) return null;
      var a = toc.querySelector('a[href="#' + esc(id) + '"]');
      return a ? (a.closest(".toc-group") || a.closest(".toc-cat")) : null;
    }
    function visible(card) { return card.getClientRects().length > 0; }
    return Array.prototype.map.call(main.querySelectorAll("section.index-cat"), function (sec) {
      var total = 0, groups = [], cur = null, extra = [];
      Array.prototype.forEach.call(sec.children, function (ch) {
        if (ch.matches("h3.index-sub")) { cur = { h: ch, boxes: [], n: 0 }; groups.push(cur); return; }
        if (ch.matches(".index-cards")) {
          var n = Array.prototype.filter.call(ch.querySelectorAll("a.index-card"), visible).length;
          total += n;
          if (cur) { cur.boxes.push(ch); cur.n += n; }
          else if (!n && groups.length === 0 && sec.querySelector("h3.index-sub")) extra.push(ch); // empty lead-in box above subsections
        }
      });
      var t = tocFor(sec.id);
      return {
        n: total, nodes: [sec].concat(t ? [t] : []), extra: extra,
        groups: groups.map(function (g) { var gt = g.h.id && tocFor(g.h.id); return { n: g.n, nodes: [g.h].concat(g.boxes, gt ? [gt] : []) }; })
      };
    });
  }
  // Article rail: count the entries a viewer can see (hidden by their own privacy mark).
  function railSpec(panel) {
    function seen(a) { return getComputedStyle(a).display !== "none"; }
    return Array.prototype.map.call(panel.querySelectorAll(":scope > .toc-cat"), function (cat) {
      var nest = cat.querySelector(":scope > .toc-nest"), total = 0, groups = [];
      if (nest) Array.prototype.forEach.call(nest.children, function (ch) {
        if (ch.matches(".toc-group")) {
          var n = Array.prototype.filter.call(ch.querySelectorAll("a.toc-name"), seen).length;
          total += n; groups.push({ n: n, nodes: [ch] });
        } else if (ch.matches("a.toc-name") && seen(ch)) total++;
      });
      return { n: total, nodes: [cat], groups: groups };
    });
  }
  var busy = false;
  function run() {
    busy = true;
    try {
      Array.prototype.forEach.call(document.querySelectorAll("." + HIDE), function (n) { n.classList.remove(HIDE); });
      if (seesAll()) return;
      var main = document.querySelector("main.index-flow"), specs = [];
      if (main) specs = indexSpec(main, document.getElementById("index-toc-panel"));
      else { var panel = document.getElementById("art-index-panel"); if (panel) specs = railSpec(panel); }
      emptyRule(specs).forEach(function (n) { n.classList.add(HIDE); });
    } finally { setTimeout(function () { busy = false; }, 0); }
  }
  var queued = false;
  function soon() { if (queued || busy) return; queued = true; requestAnimationFrame(function () { queued = false; run(); }); }
  if (!document.querySelector("main.index-flow") && !document.getElementById("art-index-panel")) return;
  run();
  window.addEventListener("load", soon);
  new MutationObserver(soon).observe(document.body, { attributes: true, attributeFilter: ["class"] });
  var modeKey = function () { var c = document.documentElement.classList; return c.contains("ee-index-org") + "|" + c.contains("ee-editing"); }, lastMode = modeKey();
  new MutationObserver(function () { var m = modeKey(); if (m !== lastMode) { lastMode = m; soon(); } }).observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  var watchEl = document.querySelector("main.index-flow") || document.getElementById("art-index-panel");
  new MutationObserver(function () { if (!busy) soon(); }).observe(watchEl, { childList: true, subtree: true });
  document.addEventListener("elorae-rail-synced", soon);
  window.addEventListener("elorae-edit-session", soon);
  document.addEventListener("elorae-vis", soon); // vt1: vis-gate revealed shared cards / a visibility save
  window.EloraeEmptySections = { run: run, rule: emptyRule };
})();
