/* Mention cards (nt15). Loaded with ?v= on journal.html. Ported from the lab prototype.
   - Every link to articles/*.html inside the Journal opens that article's dossier card: hover
     (desktop, after a short pause) or first tap (phone, docked at the bottom; tapping the
     card's name or ARTICLE navigates, tapping elsewhere closes). Keyboard: focus opens,
     Escape closes.
   - Plain-text names are wrapped sparingly: only the FIRST mention of each subject per
     chapter, and only if the chapter does not already link that subject. Names are the
     article titles plus the short forms the Journal already uses as link text.
   - Card data uses the same fields as card-lore.js extract() (name, epithet, lore quote,
     dossier rows, lore opening) read from the article page, with the blurred backdrop from
     card-lore-palette.js when that is loaded.
   Private subjects: names come from search-index.js; entries marked private are used only when
   this viewer has unlocked that owner (body.login-<owner>, or login-devin). A card is never shown
   for an article whose body is private for this viewer.
   Edit safety: wrappers are runtime-only <a class="nt-mention"> around unchanged text, so
   edit/'s srcmap sees the same blocks and text; startEdit also resets each edited block to its
   source HTML. On top of that, no plain-text wrapping happens while an editor session exists,
   and any wrappers are removed when one starts (elorae-edit-session). */
(function () {
  "use strict";
  var main = document.querySelector("body.journal-page main.read");
  if (!main) return;
  var me = document.currentScript;
  var ROOT = new URL("./", me ? me.src : location.href).href;
  var phone = window.matchMedia("(max-width: 800px)");
  var cache = {}, card = null, openFor = null, hoverT = 0, hideT = 0;

  function editing() {
    try { return location.hash === "#edit" || !!(sessionStorage.getItem("elorae-edit-session") || localStorage.getItem("elorae-edit-session")); }
    catch (e) { return false; }
  }
  function unlocked(owner) {
    var c = document.body.classList;
    return !!owner && (c.contains("login-devin") || c.contains("login-" + owner));
  }
  function text(el) { return el ? el.textContent.replace(/\s+/g, " ").trim() : ""; }
  function opening(t) {
    t = t.replace(/\s+/g, " ").trim();
    var re = /[.!?]["\u201d\u2019)]*(?=\s+["\u201c\u2018(]?[A-Z0-9])/g, ends = [], m;
    while ((m = re.exec(t))) ends.push(m.index + m[0].length);
    if (!ends.length || ends[ends.length - 1] < t.length) ends.push(t.length);
    var cut = ends[0];
    for (var i = 1; i < ends.length && i < 3; i++) { if (ends[i] > 260) break; cut = ends[i]; }
    return t.slice(0, cut).trim();
  }
  function extract(html) {
    var doc = new DOMParser().parseFromString(html, "text/html");
    var body = doc.querySelector("main.art-body");
    if (body && body.classList.contains("private") && !unlocked(body.getAttribute("data-owner"))) return null;
    var lore = doc.querySelector("#lore"), firstLife = lore && lore.querySelector("p.art-life");
    var q = lore && lore.querySelector("blockquote.art-quote"), rows = [], dt = null;
    var dl = doc.querySelector("#dossier dl.art-dossier");
    if (dl) Array.prototype.forEach.call(dl.children, function (n) {
      if (n.tagName === "DT") dt = text(n); else if (n.tagName === "DD") rows.push([dt || "", text(n)]);
    });
    return { name: text(doc.querySelector(".art-title h1")), epithet: text(doc.querySelector(".art-title .art-epithet")),
      quote: q ? text(q.querySelector("p")) : "", cite: q ? text(q.querySelector("cite")) : "", rows: rows,
      desc: firstLife ? opening(firstLife.textContent) : text(doc.querySelector("#description .art-line")) };
  }
  function slugOf(href) { var m = /articles\/([^\/?#]+)\.html/.exec(href || ""); return m ? m[1] : ""; }
  function load(slug) {
    if (!cache[slug]) cache[slug] = fetch(ROOT + "articles/" + slug + ".html").then(function (r) {
      if (!r.ok) throw new Error(r.status); return r.text(); }).then(extract);
    return cache[slug];
  }

  /* ---------- styles ---------- */
  var css = document.createElement("style");
  css.id = "nt-mention-css";
  css.textContent =
    "main.read a.nt-mention{color:inherit;text-decoration:underline dotted rgba(243,238,230,.38);text-decoration-thickness:1px;text-underline-offset:3px;border:0}" +
    ".nt-mcard{position:fixed;z-index:45;color:#f3eee6;opacity:0;visibility:hidden;pointer-events:none;overflow:hidden;" +
    "transition:opacity .16s ease,visibility 0s linear .16s;font-family:\"Iowan Old Style\",\"Palatino Linotype\",Palatino,serif}" +
    ".nt-mcard.on{opacity:1;visibility:visible;pointer-events:auto;transition:opacity .16s ease,visibility 0s}" +
    ".nt-mcard-bg{position:absolute;inset:-20px;background:#15130f center/cover;filter:blur(14px) saturate(1.1)}" +
    ".nt-mcard-veil{position:absolute;inset:0;background:rgba(7,7,7,.76)}" +
    ".nt-mcard-face{position:relative}" +
    ".nt-mcard-name{display:block;font-size:13px;letter-spacing:.18em;text-transform:uppercase;color:#f3eee6;text-decoration:none}" +
    ".nt-mcard p.nt-mcard-epithet{margin:4px 0 10px;font-size:14px;font-style:italic;color:var(--nt-accent,#b9b2a6);line-height:1.4}" +
    ".nt-mcard blockquote{margin:0 0 10px;padding:0;border:0}" +
    ".nt-mcard blockquote p{margin:0;font-size:14px;line-height:1.45;color:#e6dfd3}" +
    ".nt-mcard cite{display:block;margin-top:4px;font-size:12px;color:#8f8a82;font-style:normal}" +
    ".nt-mcard dl{display:grid;grid-template-columns:max-content 1fr;gap:3px 14px;margin:0 0 10px}" +
    ".nt-mcard dt{font-family:Helvetica,Arial,sans-serif;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--nt-accent,#8f8a82);align-self:baseline}" +
    ".nt-mcard dd{margin:0;font-size:14px}" +
    ".nt-mcard p.nt-mcard-desc{margin:0 0 10px;font-size:14px;line-height:1.5;color:#e6dfd3;text-shadow:none}" +
    ".nt-mcard-go{display:block;text-align:right;font-family:Helvetica,Arial,sans-serif;font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:#8f8a82;text-decoration:none}" +
    ".nt-mcard-name:focus-visible,.nt-mcard-go:focus-visible{outline:none;text-decoration:underline;text-underline-offset:4px}" +
    "html.ee-editing .nt-mcard{display:none}" +
    "@media (min-width:801px){.nt-mcard{width:340px}.nt-mcard-face{padding:18px 20px 16px}.nt-mcard-go:hover,.nt-mcard-name:hover{color:#fff}}" +
    "@media (max-width:800px){.nt-mcard{left:0!important;right:0;bottom:0;top:auto!important;max-height:62vh;overflow-y:auto;" +
    "padding-bottom:env(safe-area-inset-bottom);transform:translateY(12px);transition:opacity .16s ease,transform .16s ease,visibility 0s linear .16s}" +
    ".nt-mcard.on{transform:none;transition:opacity .16s ease,transform .16s ease,visibility 0s}.nt-mcard-face{padding:18px 22px 22px}}" +
    "@media (prefers-reduced-motion:reduce){.nt-mcard,.nt-mcard.on{transition:none;transform:none}}";
  document.head.appendChild(css);

  /* ---------- 1. sparse plain-text wrapping (first mention per chapter) ---------- */
  function chapters() {
    var heads = Array.prototype.slice.call(main.querySelectorAll(":scope > h1[id]"));
    return heads.map(function (h) {
      var nodes = [], n = h.nextElementSibling;
      while (n && !(n.tagName === "H1" && n.id)) { nodes.push(n); n = n.nextElementSibling; }
      return nodes;
    });
  }
  function unwrapAll() {
    Array.prototype.forEach.call(main.querySelectorAll("a.nt-mention"), function (a) {
      a.parentNode.replaceChild(document.createTextNode(a.textContent), a);
    });
    main.normalize();
  }
  function wrap(names) {
    var keys = Object.keys(names).sort(function (a, b) { return b.length - a.length; });
    if (!keys.length) return;
    var rx = new RegExp("(^|[^\\w\u2019'])(" + keys.map(function (k) { return k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }).join("|") + ")(?![\\w\u2019'])");
    chapters().forEach(function (nodes) {
      var done = {};
      nodes.forEach(function (n) {
        Array.prototype.forEach.call(n.querySelectorAll ? n.querySelectorAll('a[href*="articles/"]') : [], function (a) { done[slugOf(a.getAttribute("href"))] = 1; });
      });
      nodes.forEach(function (blk) {
        if (blk.tagName !== "P") return;
        var walker = document.createTreeWalker(blk, NodeFilter.SHOW_TEXT, { acceptNode: function (t) {
          return t.parentNode.closest("a") ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT; } });
        var list = []; while (walker.nextNode()) list.push(walker.currentNode);
        list.forEach(function (t) {
          var node = t, m;
          while (node && (m = rx.exec(node.data))) {
            var href = names[m[2]], slug = slugOf(href);
            var start = m.index + m[1].length;
            if (done[slug]) { node = node.splitText(start + m[2].length); continue; }
            done[slug] = 1;
            var mid = node.splitText(start), rest = mid.splitText(m[2].length);
            var a = document.createElement("a");
            a.className = "nt-mention"; a.href = ROOT + href; a.textContent = mid.data;
            mid.parentNode.replaceChild(a, mid);
            node = rest;
          }
        });
      });
    });
  }
  if (!editing()) {
    fetch(ROOT + "search-index.js").then(function (r) { return r.ok ? r.text() : ""; }).then(function (t) {
      if (!t || editing()) return;
      var all = JSON.parse(t.slice(t.indexOf("["), t.lastIndexOf("]") + 1));
      var places = {};
      all.forEach(function (e) { if (e.kind !== "article") places[e.title] = 1; });
      var list = all.filter(function (e) { return e.kind === "article" && (!e.private || unlocked(e.owner)); });
      /* Full article titles, plus the short forms the Journal itself already uses as link text
         (e.g. "Silar" for Silar Scorria); no guessed aliases, so common words never match. */
      var names = {}, ok = {};
      list.forEach(function (e) {
        ok[slugOf(e.href)] = e.href;
        if (!places[e.title]) names[e.title] = e.href;                 /* e.g. Hesk: Ancient and Atlas region */
      });
      Array.prototype.forEach.call(main.querySelectorAll('a[href*="articles/"]'), function (a) {
        var sl = slugOf(a.getAttribute("href")), t = text(a);
        if (ok[sl] && t.length >= 3 && !places[t] && !names[t]) names[t] = ok[sl];
      });
      wrap(names);
    }).catch(function () {});
  }
  window.addEventListener("elorae-edit-session", function () { if (editing()) { hide(); unwrapAll(); } });

  /* ---------- 2. cards ---------- */
  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  function render(slug, d, href) {
    if (!card) {
      card = el("div", "nt-mcard"); card.setAttribute("role", "dialog"); card.setAttribute("aria-label", "Dossier");
      document.body.appendChild(card);
      card.addEventListener("mouseenter", function () { clearTimeout(hideT); });
      card.addEventListener("mouseleave", function () { if (!phone.matches) hideSoon(); });
    }
    card.innerHTML = "";
    var p = (window.__lorePalette || {})[slug] || {};
    var bg = el("div", "nt-mcard-bg"); if (p.blur) bg.style.backgroundImage = 'url("' + ROOT + p.blur + '")'; card.appendChild(bg);
    card.appendChild(el("div", "nt-mcard-veil"));
    var face = el("div", "nt-mcard-face"); card.appendChild(face);
    if (p.label) face.style.setProperty("--nt-accent", "rgb(" + p.label + ")");
    var nm = el("a", "nt-mcard-name", d.name || slug); nm.href = href; face.appendChild(nm);
    if (d.epithet) face.appendChild(el("p", "nt-mcard-epithet", d.epithet));
    if (d.quote) { var q = el("blockquote"); q.appendChild(el("p", null, d.quote)); if (d.cite) q.appendChild(el("cite", null, d.cite)); face.appendChild(q); }
    if (d.rows && d.rows.length) { var dl = el("dl"); d.rows.forEach(function (r) { dl.appendChild(el("dt", null, r[0])); dl.appendChild(el("dd", null, r[1])); }); face.appendChild(dl); }
    if (d.desc && d.desc !== d.epithet) face.appendChild(el("p", "nt-mcard-desc", d.desc));
    var go = el("a", "nt-mcard-go", "Article \u2192"); go.href = href; face.appendChild(go);
  }
  function place(a) {
    var r = a.getBoundingClientRect();
    card.classList.add("on");
    if (phone.matches) { card.style.left = ""; card.style.top = ""; return; }
    var w = card.offsetWidth, h = card.offsetHeight, x = Math.min(Math.max(12, r.left), innerWidth - w - 12);
    var y = r.bottom + 10; if (y + h > innerHeight - 12) y = Math.max(12, r.top - h - 10);
    card.style.left = x + "px"; card.style.top = y + "px";
  }
  function open(a) {
    if (document.documentElement.classList.contains("ee-editing")) return;
    var href = a.href, slug = slugOf(href); if (!slug) return;
    openFor = a;
    load(slug).then(function (d) { if (openFor !== a) return; if (!d) { hide(); return; } render(slug, d, href); place(a); },
      function () { if (openFor === a) hide(); });
  }
  function hide() { openFor = null; if (card) card.classList.remove("on"); }
  function hideSoon() { clearTimeout(hideT); hideT = setTimeout(hide, 220); }
  function target(e) {
    var a = e.target.closest && e.target.closest("a");
    return a && main.contains(a) && !a.closest("nav") && /articles\/[^\/]+\.html/.test(a.getAttribute("href") || "") ? a : null;
  }
  main.addEventListener("mouseover", function (e) { if (phone.matches) return; var a = target(e); if (!a) return;
    clearTimeout(hideT); clearTimeout(hoverT); hoverT = setTimeout(function () { open(a); }, 260); });
  main.addEventListener("mouseout", function (e) { if (phone.matches) return; if (target(e)) { clearTimeout(hoverT); hideSoon(); } });
  main.addEventListener("click", function (e) {
    if (!phone.matches) return; var a = target(e); if (!a) return;
    if (document.documentElement.classList.contains("ee-editing")) return;
    if (e.ctrlKey || e.metaKey || e.shiftKey) return;
    if (openFor === a && card && card.classList.contains("on")) return;          /* second tap: navigate */
    e.preventDefault(); open(a);
  });
  document.addEventListener("click", function (e) { if (!phone.matches || !card) return;
    if (!card.contains(e.target) && !target(e)) hide(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") hide(); });
  main.addEventListener("focusin", function (e) { var a = target(e); if (a && !phone.matches) open(a); });
  main.addEventListener("focusout", function (e) { if (target(e) && !phone.matches) hideSoon(); });
  window.addEventListener("scroll", function () { if (!phone.matches) hide(); }, { passive: true });
})();
