/* pk1 (2026-10-31): Index peek panel + article hover cards.
   1) Index: a plain click / tap on a card opens a peek (desktop: panel from the right, below the
      nav; phone: sheet) with the article's art, name, epithet, filled Dossier fields, the first Lore
      paragraph and "Read full article". The card's href stays the article, so Ctrl/Cmd/Shift/
      middle-click still open it normally. Close: X, Esc, a click outside, or Back (one history
      entry, same URL). Another card swaps in place; Left/Right (and the panel arrows) step through
      the visible cards of the same section. Off in the Index organizer / edit mode.
   2) Article, Journal and Codex text: hovering a link to /articles/<slug>/ with a mouse shows a
      small card (art, name, epithet, up to 3 filled Dossier fields) after 250ms. Touch never.
   Data: the article page is fetched once (on hover / touch / open) and cached; only what this
   viewer may see is used: private (owner-gated) parts are dropped exactly as html.css + vis-gate
   hide them on the article itself, and a secret page this viewer is not allowed to see gives
   nothing. Empty template fields are skipped. */
(function () {
  "use strict";
  if (window.__eloraePeek) return; window.__eloraePeek = 1;
  var doc = document, root = doc.documentElement;
  var PLAYERS = { jack: 1, jon: 1, julie: 1, sawyer: 1, sylum: 1, jason: 1, devin: 1 };
  function me() {
    var b = doc.body; if (b) for (var p in PLAYERS) if (b.classList.contains("login-" + p)) return p;
    try { var m = doc.cookie.match(/(?:^|;\s*)elorae-(?:login|seal)=([a-z]+)/); if (m && PLAYERS[m[1]]) return m[1]; } catch (e) {}
    try { var w = localStorage.getItem("elorae-login") || ""; if (PLAYERS[w]) return w; } catch (e) {}
    return "";
  }
  function manifest() { try { return (JSON.parse(sessionStorage.getItem("elorae-vis-man") || "null") || {}).secrets || {}; } catch (e) { return {}; } }
  function sees(owner, secretId) {
    var w = me();
    if (w === "devin" || (owner && owner === w)) return true;
    var s = secretId && manifest()[secretId];
    return !!(s && (s.everyone || (w && (s.owner === w || (s.allowed || []).indexOf(w) >= 0))));
  }
  function editing() { return root.classList.contains("ee-editing") || root.classList.contains("ee-index-org"); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function norm(s) { return String(s || "").replace(/\s+/g, " ").trim(); }
  function articleKey(href) {
    try {
      var u = new URL(href, location.href);
      if (u.origin !== location.origin) return null;
      var m = /^\/articles\/([a-z0-9][\w-]*?)(?:\/(?:index\.html)?|\.html)$/i.exec(u.pathname);
      return m ? m[1].toLowerCase() : null;
    } catch (e) { return null; }
  }
  function img(src, w) { return window.eloraeImg ? window.eloraeImg(src, w) : src; }
  /* A Dossier value that is blank, only whitespace / line breaks, or only a placeholder mark
     (—, -, ?, …, TBD, N/A) counts as not filled: hidden for viewers, skipped in peeks and cards. */
  var PLACEHOLDER = /^(?:[-\u2010-\u2015?.\u2026_*]+|tbd|tba|n\/?a)$/i;
  function blankValue(t) { t = norm(t); return !t || PLACEHOLDER.test(t); }
  /* Mark unfilled rows on this page (data-ee-empty: the editor strips data-ee-* on save, so the
     mark never reaches the file). html.css hides them for viewers; edit mode shows every row. */
  function markDossier() {
    Array.prototype.forEach.call(doc.querySelectorAll("dl.art-dossier > dd"), function (dd) {
      var dt = dd.previousElementSibling;
      var empty = blankValue(dd.textContent) && !dd.querySelector("img");
      [dd, dt && dt.tagName === "DT" ? dt : null].forEach(function (n) {
        if (!n) return;
        if (empty) n.setAttribute("data-ee-empty", ""); else n.removeAttribute("data-ee-empty");
      });
    });
  }

  /* ---- fetch + parse (shared cache) ---- */
  var cache = {};
  function load(slug) {
    if (cache[slug]) return cache[slug];
    var p = fetch("/articles/" + slug + "/", { credentials: "same-origin" })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); })
      .then(parse);
    p.catch(function () { delete cache[slug]; });
    return (cache[slug] = p);
  }
  function parse(html) {
    var d = new DOMParser().parseFromString(html, "text/html");
    var h = d.documentElement;
    var pid = h.getAttribute("data-secret-page");
    if (pid && !sees(h.getAttribute("data-owner") || "", pid)) return null;
    var hero = d.querySelector("section.art-hero"), main = d.querySelector("main.art-body");
    // The article itself may be owner-gated (private article): the viewer reached it from a card or
    // link they can see, which is the same rule the article page uses. Anything private INSIDE it
    // that this viewer cannot see goes.
    [hero, main].forEach(function (box) {
      if (!box) return;
      Array.prototype.slice.call(box.querySelectorAll(".private[data-owner]")).forEach(function (n) {
        if (!sees(n.getAttribute("data-owner"), n.getAttribute("data-secret"))) n.remove();
      });
      Array.prototype.slice.call(box.querySelectorAll("script, style, template, noscript")).forEach(function (n) { n.remove(); });
    });
    var h1 = hero && hero.querySelector(".art-title h1"), ep = hero && hero.querySelector(".art-title .art-epithet");
    var heroImg = hero && hero.querySelector(":scope > img");
    var fields = [];
    var dl = main && main.querySelector("dl.art-dossier");
    if (dl) Array.prototype.forEach.call(dl.querySelectorAll(":scope > dt"), function (dt) {
      var dd = dt.nextElementSibling;
      if (!dd || dd.tagName !== "DD") return;
      var k = norm(dt.textContent), v = norm(dd.textContent);
      if (k && !blankValue(v)) fields.push([k, v]);
    });
    var para = "";
    if (main) {
      var cands = main.querySelectorAll("#lore p, p.art-life, p");
      for (var i = 0; i < cands.length; i++) {
        var p = cands[i];
        if (p.closest(".art-quote, .art-facts, #related, #description, #dossier, figure, nav")) continue;
        var t = norm(p.textContent);
        if (t.length > 1) { para = t; break; }
      }
    }
    return {
      name: h1 ? norm(h1.textContent) : norm((d.title || "").replace(/\s*-\s*Elorae\s*$/, "")),
      epithet: ep ? norm(ep.textContent) : "",
      art: heroImg ? heroImg.getAttribute("src") : "",
      alt: heroImg ? heroImg.getAttribute("alt") || "" : "",
      fields: fields,
      para: para
    };
  }
  window.EloraePeek = { load: load, parse: parse, articleKey: articleKey, blankValue: blankValue, markDossier: markDossier };

  var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var finePointer = window.matchMedia && matchMedia("(hover: hover) and (pointer: fine)").matches;

  /* ================= 1) Index peek ================= */
  function initPeek() {
    if (!doc.body.classList.contains("index-page")) return;
    var panel = null, cur = null, histOpen = false, token = 0;
    function cards() { return Array.prototype.slice.call(doc.querySelectorAll("main a.index-card")); }
    function visible(a) { return a.getClientRects().length > 0; }
    function siblings(a) {
      var sec = a.closest("section.index-cat") || a.parentNode;
      return Array.prototype.filter.call(sec.querySelectorAll("a.index-card"), visible);
    }
    function build() {
      panel = doc.createElement("aside");
      panel.id = "peek"; panel.className = "peek"; panel.setAttribute("role", "dialog"); panel.setAttribute("aria-modal", "false"); panel.setAttribute("aria-label", "Article preview");
      panel.setAttribute("tabindex", "-1");
      panel.innerHTML =
        '<div class="peek-art"><img class="peek-img" alt="" decoding="async"></div>' +
        '<div class="peek-tools"><button type="button" class="peek-prev" aria-label="Previous"></button><button type="button" class="peek-next" aria-label="Next"></button><button type="button" class="peek-x" aria-label="Close"></button></div>' +
        '<div class="peek-body"><h2 class="peek-name"></h2><p class="peek-ep"></p><dl class="peek-dl"></dl><p class="peek-para"></p>' +
        '<a class="peek-read" href="#">Read full article</a></div>';
      doc.body.appendChild(panel);
      panel.querySelector(".peek-x").addEventListener("click", function () { close(); });
      panel.querySelector(".peek-prev").addEventListener("click", function () { step(-1); });
      panel.querySelector(".peek-next").addEventListener("click", function () { step(1); });
    }
    function fill(a) {
      var my = ++token;
      var slug = articleKey(a.getAttribute("href"));
      var span = a.querySelector(":scope > span");
      var name = norm(span ? span.textContent : a.textContent), ep = a.getAttribute("data-epithet") || "";
      var cimg = a.querySelector("img");
      var im = panel.querySelector(".peek-img");
      panel.classList.toggle("peek-no-art", !cimg);
      // Art at once from the card's own (loaded) picture; the article's art replaces it when ready.
      if (cimg) { im.src = cimg.currentSrc || cimg.src; im.alt = cimg.alt || name; } else { im.removeAttribute("src"); im.alt = ""; }
      panel.querySelector(".peek-name").textContent = name;
      var epEl = panel.querySelector(".peek-ep"); epEl.textContent = ep; epEl.hidden = !ep;
      var read = panel.querySelector(".peek-read"); read.href = a.getAttribute("href");
      var dl = panel.querySelector(".peek-dl"), para = panel.querySelector(".peek-para");
      dl.innerHTML = ""; para.textContent = "";
      panel.classList.add("peek-loading");
      var sib = siblings(a), i = sib.indexOf(a);
      panel.querySelector(".peek-prev").disabled = i <= 0;
      panel.querySelector(".peek-next").disabled = i < 0 || i >= sib.length - 1;
      if (!slug) { panel.classList.remove("peek-loading"); return; }
      load(slug).then(function (data) {
        if (my !== token) return;
        panel.classList.remove("peek-loading");
        if (!data) return;
        if (data.name) panel.querySelector(".peek-name").textContent = data.name;
        if (data.epithet) { epEl.textContent = data.epithet; epEl.hidden = false; }
        dl.innerHTML = data.fields.filter(function (f) { return f[0].toLowerCase() !== "name"; }).map(function (f) { return "<dt>" + esc(f[0]) + "</dt><dd>" + esc(f[1]) + "</dd>"; }).join("");
        para.textContent = data.para;
        if (data.art) {
          var big = img(data.art, 960);
          if (big && big !== im.getAttribute("src")) {
            var pre = new Image(); pre.decoding = "async";
            pre.onload = function () { if (my === token) { im.src = big; im.alt = data.alt || data.name; panel.classList.remove("peek-no-art"); } };
            pre.src = big;
          }
        }
      }, function () { if (my === token) panel.classList.remove("peek-loading"); });
    }
    function open(a) {
      if (!panel) build();
      var was = !!cur;
      if (cur) cur.classList.remove("peek-on");
      cur = a; a.classList.add("peek-on");
      fill(a);
      if (!was) {
        panel.classList.add("peek-open");
        root.classList.add("peek-is-open");
        try { if (!histOpen) { history.pushState({ eloraePeek: 1 }, ""); histOpen = true; } } catch (e) {}
        panel.focus({ preventScroll: true });
      }
    }
    function close(fromPop) {
      if (!cur) return;
      cur.classList.remove("peek-on");
      var back = cur; cur = null; token++;
      panel.classList.remove("peek-open");
      root.classList.remove("peek-is-open");
      if (histOpen && !fromPop) { histOpen = false; try { history.back(); } catch (e) {} }
      histOpen = false;
      if (back && back.focus && doc.activeElement && panel.contains(doc.activeElement)) back.focus({ preventScroll: true });
    }
    function step(d) {
      if (!cur) return;
      var sib = siblings(cur), i = sib.indexOf(cur), n = sib[i + d];
      if (!n) return;
      open(n);
      try { n.scrollIntoView({ block: "nearest", behavior: reduce ? "auto" : "smooth" }); } catch (e) {}
    }
    window.addEventListener("popstate", function () { if (cur) close(true); });
    // Back from the full article onto our peek history entry after a reload: drop the stale entry state.
    try { if (history.state && history.state.eloraePeek && !cur) history.replaceState(null, ""); } catch (e) {}
    doc.addEventListener("click", function (e) {
      if (editing()) return;
      var a = e.target.closest && e.target.closest("main a.index-card");
      if (a) {
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        if (!articleKey(a.getAttribute("href"))) return;
        e.preventDefault();
        if (cur === a) { close(); return; }
        open(a);
        return;
      }
      if (cur && panel && !panel.contains(e.target) && !(e.target.closest && e.target.closest(".mast, #section-bar, .seek-panel"))) close();
    });
    doc.addEventListener("keydown", function (e) {
      if (!cur || editing()) return;
      if (e.key === "Escape") { e.preventDefault(); close(); return; }
      var t = e.target;
      if (t && (t.isContentEditable || /^(input|textarea|select)$/i.test(t.tagName))) return;
      if (e.key === "ArrowLeft") { e.preventDefault(); step(-1); }
      else if (e.key === "ArrowRight") { e.preventDefault(); step(1); }
    });
    // Organizer / edit mode opening while a peek is up: close it.
    new MutationObserver(function () { if (cur && editing()) close(); }).observe(root, { attributes: true, attributeFilter: ["class"] });
    // Warm the cache on intent.
    function warm(e) {
      if (editing()) return;
      var a = e.target.closest && e.target.closest("main a.index-card");
      var s = a && articleKey(a.getAttribute("href"));
      if (s) load(s);
    }
    doc.addEventListener("pointerover", function (e) { if (e.pointerType === "mouse") { clearTimeout(warm.t); warm.t = setTimeout(function () { warm(e); }, 90); } }, { passive: true });
    doc.addEventListener("touchstart", warm, { passive: true });
    doc.addEventListener("focusin", warm);
  }

  /* ================= 2) Hover link cards ================= */
  function initHover() {
    if (!finePointer || doc.body.classList.contains("index-page")) return;
    var SCOPE = "main, .read, .codex-body";
    var card = null, link = null, showT = 0, hideT = 0, my = 0;
    var here = articleKey(location.href);
    function el() {
      if (card) return card;
      card = doc.createElement("div");
      card.id = "hover-card"; card.className = "hover-card"; card.setAttribute("role", "tooltip"); card.setAttribute("data-ee-ui", "1");
      doc.body.appendChild(card);
      card.addEventListener("pointerenter", function () { clearTimeout(hideT); });
      card.addEventListener("pointerleave", function (e) { if (e.relatedTarget !== link && !(link && link.contains(e.relatedTarget))) hideSoon(); });
      return card;
    }
    function hide() { clearTimeout(showT); clearTimeout(hideT); my++; link = null; if (card) { card.classList.remove("hover-card-on"); card.hidden = true; } }
    function hideSoon() { clearTimeout(hideT); hideT = setTimeout(hide, 180); }
    function place(a) {
      var r = a.getBoundingClientRect(), c = card, W = innerWidth, H = innerHeight, gap = 8;
      var cw = c.offsetWidth, ch = c.offsetHeight;
      var x = Math.max(8, Math.min(W - cw - 8, r.left));
      var y = r.bottom + gap;
      if (y + ch > H - 8 && r.top - gap - ch >= 8) y = r.top - gap - ch;
      else if (y + ch > H - 8) y = Math.max(8, H - ch - 8);
      c.style.left = Math.round(x) + "px"; c.style.top = Math.round(y) + "px";
    }
    function show(a, slug) {
      var n = ++my;
      load(slug).then(function (d) {
        if (n !== my || link !== a || !d || editing()) return;
        var f = d.fields.filter(function (x) { return x[0].toLowerCase() !== "name"; }).slice(0, 3);
        var c = el();
        c.innerHTML = (d.art ? '<div class="hover-card-art"><img alt="" decoding="async" src="' + esc(img(d.art, 640)) + '"></div>' : "") +
          '<div class="hover-card-body"><div class="hover-card-name">' + esc(d.name) + "</div>" +
          (d.epithet ? '<div class="hover-card-ep">' + esc(d.epithet) + "</div>" : "") +
          (f.length ? '<dl class="hover-card-dl">' + f.map(function (x) { return "<dt>" + esc(x[0]) + "</dt><dd>" + esc(x[1]) + "</dd>"; }).join("") + "</dl>" : "") + "</div>";
        c.hidden = false;
        place(a);
        if (reduce) c.classList.add("hover-card-on");
        else requestAnimationFrame(function () { if (n === my) c.classList.add("hover-card-on"); });
      }, function () {});
    }
    doc.addEventListener("pointerover", function (e) {
      if (e.pointerType !== "mouse" || editing()) return;
      if (card && card.contains(e.target)) return;
      var a = e.target.closest && e.target.closest("a[href]");
      if (!a || !a.closest(SCOPE) || a.closest(".mast, nav, aside, .art-index, .toc, #section-bar, .art-swap")) return;
      var slug = articleKey(a.getAttribute("href"));
      if (!slug || slug === here) return;
      if (a === link) { clearTimeout(hideT); return; }
      hide();
      link = a;
      load(slug); // start fetching now; show after the delay
      showT = setTimeout(function () { if (link === a) show(a, slug); }, 250);
    }, { passive: true });
    doc.addEventListener("pointerout", function (e) {
      if (!link || e.pointerType !== "mouse") return;
      var to = e.relatedTarget;
      if (to && (link.contains(to) || (card && card.contains(to)))) return;
      if (link.contains(e.target)) hideSoon();
    }, { passive: true });
    doc.addEventListener("pointerdown", function (e) { if (!(card && card.contains(e.target))) hide(); }, true);
    window.addEventListener("scroll", function () { if (link) hide(); }, { passive: true });
    window.addEventListener("blur", hide);
    new MutationObserver(function () { if (editing()) hide(); }).observe(root, { attributes: true, attributeFilter: ["class"] });
  }

  function init() {
    if (doc.querySelector("dl.art-dossier")) {
      markDossier();
      // Leaving edit mode (a save or Cancel rebuilt / changed the rows): mark again.
      var wasEditing = editing();
      new MutationObserver(function () { var e = editing(); if (wasEditing && !e) markDossier(); wasEditing = e; }).observe(root, { attributes: true, attributeFilter: ["class"] });
    }
    initPeek(); initHover();
  }
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", init); else init();
})();
