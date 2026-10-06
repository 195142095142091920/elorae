/* Index card lore pop-out (art82).
   Each Index card gets a bare page glyph (bottom-right). Clicking it never follows the card
   link; it opens a dossier-style quick reference in the search panel shell (#seek-panel look:
   .seek-panel-scrim / .seek-panel-box / .seek-panel-close, same phone scroll lock).
   Content is read on demand from the card's own article (articles/<slug>.html), verbatim:
   name + epithet, the lore quote, the dossier fields (dl.art-dossier + ul.art-facts),
   the opening of the lore (first .art-life paragraph, cut at a sentence boundary), then the
   article link and the article's Related links. The full biography stays on the article.
   Outside click / Escape / close X dismiss and return focus to the glyph. */
(function () {
  if (!document.body.classList.contains("index-page")) return;
  var cards = Array.prototype.slice.call(document.querySelectorAll("a.index-card"));
  if (!cards.length) return;

  var GLYPH = '<svg viewBox="0 0 11 13" aria-hidden="true">' +
    '<path d="M1.5 0.5h5.5l2.5 2.5v9.5h-8z M7 0.5v2.5h2.5 M3.5 6h4 M3.5 8h4 M3.5 10h2.5" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg>';
  var CLOSE = '<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M1.5 1.5L12.5 12.5M12.5 1.5L1.5 12.5" fill="none" stroke="#f3eee6" stroke-width="1" stroke-linecap="round" vector-effect="non-scaling-stroke"/></svg>';
  var MAX_SENTENCES = 4, MAX_CHARS = 320;

  cards.forEach(function (card) {
    var label = card.querySelector("span");
    var g = document.createElement("i"); /* not a span: .index-card span is the name label */
    g.className = "card-lore-glyph";
    g.setAttribute("role", "button");
    g.setAttribute("tabindex", "0");
    g.setAttribute("aria-haspopup", "dialog");
    g.setAttribute("aria-label", "Quick lore: " + (label ? label.textContent : "card"));
    g.innerHTML = GLYPH;
    card.appendChild(g);
  });

  /* Glyph click/keys: swallow before the card link (capture) so the card never navigates. */
  function glyphOf(e) { return e.target && e.target.closest ? e.target.closest(".card-lore-glyph") : null; }
  document.addEventListener("click", function (e) {
    var g = glyphOf(e);
    if (!g) return;
    e.preventDefault();
    e.stopPropagation();
    open(g);
  }, true);
  document.addEventListener("auxclick", function (e) {
    if (glyphOf(e)) { e.preventDefault(); e.stopPropagation(); }
  }, true);
  document.addEventListener("keydown", function (e) {
    var g = glyphOf(e);
    if (!g || (e.key !== "Enter" && e.key !== " ")) return;
    e.preventDefault();
    e.stopPropagation();
    open(g);
  }, true);

  var pop = null, box = null, body = null, opener = null, lockY = 0, cache = {}, seq = 0;
  function ensurePop() {
    if (pop) return;
    pop = document.createElement("div");
    pop.id = "lore-pop";
    pop.hidden = true;
    pop.innerHTML =
      '<div class="seek-panel-scrim" data-lore-close="1"></div>' +
      '<div class="seek-panel-box lore-pop-box" role="dialog" aria-modal="true" aria-labelledby="lore-pop-title">' +
      '<button type="button" class="seek-panel-close" data-lore-close="1" aria-label="Close">' + CLOSE + '</button>' +
      '<div class="lore-pop-body" tabindex="-1"></div></div>';
    document.body.appendChild(pop);
    box = pop.querySelector(".lore-pop-box");
    body = pop.querySelector(".lore-pop-body");
    pop.addEventListener("click", function (e) {
      var t = e.target;
      if (t === pop || (t.closest && t.closest("[data-lore-close]"))) { close(true); return; }
      var a = t.closest && t.closest("a[href]");
      if (a && box.contains(a) && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && e.button === 0) {
        close(false); /* default navigation proceeds */
      }
    });
  }

  /* Same lock as search.js (phone: page fixed behind, panel scrolls inside). */
  function lock() {
    document.body.classList.add("seek-panel-open");
    if (!window.matchMedia("(max-width: 800px)").matches) return;
    lockY = window.scrollY || window.pageYOffset || 0;
    document.documentElement.classList.add("seek-panel-lock");
    document.body.style.top = "-" + lockY + "px";
  }
  function unlock() {
    document.documentElement.classList.remove("seek-panel-lock");
    document.body.classList.remove("seek-panel-open");
    if (document.body.style.top) {
      document.body.style.top = "";
      window.scrollTo(0, lockY || 0);
    }
  }
  function isOpen() { return !!(pop && !pop.hidden); }

  function open(glyph) {
    ensurePop();
    var card = glyph.closest("a.index-card");
    if (!card) return;
    opener = glyph;
    var url = card.href;
    var name = (card.querySelector("span") || {}).textContent || "";
    pop.hidden = false;
    lock();
    body.scrollTop = 0;
    var my = ++seq;
    var cached = cache[url];
    if (cached) render(cached, url, name);
    else {
      body.innerHTML = '<p class="seek-panel-empty">Loading\u2026</p>';
      fetch(url, { credentials: "same-origin" }).then(function (r) {
        if (!r.ok) throw new Error(r.status);
        return r.text();
      }).then(function (html) {
        cache[url] = extract(html, url);
        if (my === seq && isOpen()) render(cache[url], url, name);
      }).catch(function () {
        if (my === seq && isOpen()) render({ missing: true }, url, name);
      });
    }
    setTimeout(function () { try { body.focus({ preventScroll: true }); } catch (e) { body.focus(); } }, 0);
  }

  function close(refocus) {
    if (!isOpen()) return;
    seq++;
    pop.hidden = true;
    unlock();
    if (refocus && opener) { try { opener.focus({ preventScroll: true }); } catch (e) { opener.focus(); } }
  }

  /* While open: Escape closes; Tab stays inside; other keys don't reach page shortcuts
     (search type-to-filter, rail Escape). Default actions (link Enter, scrolling) still run. */
  window.addEventListener("keydown", function (e) {
    if (!isOpen()) return;
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(true); return; }
    if (e.key === "Tab") {
      var f = Array.prototype.slice.call(box.querySelectorAll("a[href], button"));
      if (f.length) {
        var first = f[0], last = f[f.length - 1], a = document.activeElement;
        if (e.shiftKey && (a === first || a === body || !box.contains(a))) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && (a === last || !box.contains(a))) { e.preventDefault(); first.focus(); }
      }
    }
    e.stopPropagation();
  }, true);

  /* ---- extraction (verbatim text; only anchors and simple inline tags are kept) ---- */
  function abs(raw, base) { try { return new URL(raw, base).href; } catch (e) { return raw; } }
  var INLINE = { EM: 1, I: 1, STRONG: 1, B: 1, BR: 1, SMALL: 1 };
  function copyInline(src, dst, base) {
    Array.prototype.forEach.call(src.childNodes, function (n) {
      if (n.nodeType === 3) { dst.appendChild(document.createTextNode(n.nodeValue)); return; }
      if (n.nodeType !== 1) return;
      if (n.tagName === "A" && n.getAttribute("href")) {
        var a = document.createElement("a");
        a.href = abs(n.getAttribute("href"), base);
        copyInline(n, a, base);
        dst.appendChild(a);
      } else if (INLINE[n.tagName]) {
        var el = document.createElement(n.tagName.toLowerCase());
        copyInline(n, el, base);
        dst.appendChild(el);
      } else copyInline(n, dst, base);
    });
    return dst;
  }
  function text(el) { return el ? el.textContent.replace(/\s+/g, " ").trim() : ""; }
  /* Opening of the lore: whole sentences, verbatim, up to MAX_SENTENCES / ~MAX_CHARS. */
  function opening(t) {
    t = t.replace(/\s+/g, " ").trim();
    var re = /[.!?]["\u201d\u2019)]*(?=\s+["\u201c\u2018(]?[A-Z0-9])/g, ends = [], m;
    while ((m = re.exec(t))) ends.push(m.index + m[0].length);
    if (!ends.length || ends[ends.length - 1] < t.length) ends.push(t.length);
    var cut = ends[0];
    for (var i = 1; i < ends.length && i < MAX_SENTENCES; i++) {
      if (ends[i] > MAX_CHARS) break;
      cut = ends[i];
    }
    return t.slice(0, cut).trim();
  }
  function extract(html, base) {
    var doc = new DOMParser().parseFromString(html, "text/html");
    var lore = doc.querySelector("#lore");
    var firstLife = lore && lore.querySelector("p.art-life");
    var related = [];
    var rel = doc.querySelector("#related"), cur = null;
    if (rel) Array.prototype.forEach.call(rel.children, function (n) {
      if (n.classList.contains("art-rel-head")) {
        var ha = n.querySelector("a[href]");
        cur = { head: text(n), href: ha ? abs(ha.getAttribute("href"), base) : "", links: [] };
        related.push(cur);
      } else if (n.classList.contains("art-related")) {
        if (!cur) { cur = { head: "", href: "", links: [] }; related.push(cur); }
        Array.prototype.forEach.call(n.querySelectorAll("a[href]"), function (a) {
          cur.links.push({ text: text(a), href: abs(a.getAttribute("href"), base) });
        });
      }
    });
    return {
      name: text(doc.querySelector(".art-title h1")),
      epithet: text(doc.querySelector(".art-title .art-epithet")),
      line: text(doc.querySelector("#description .art-line")),
      quote: lore ? lore.querySelector("blockquote.art-quote") : null,
      dossier: doc.querySelector("#dossier dl.art-dossier"),
      facts: lore ? lore.querySelector("ul.art-facts") : null,
      desc: firstLife ? opening(firstLife.textContent) : "",
      related: related
    };
  }

  function el(tag, cls, txt) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  }
  function render(d, url, cardName) {
    body.innerHTML = "";
    var head = el("header", "lore-pop-head");
    var h = el("h2", "lore-pop-name", d.name || cardName);
    h.id = "lore-pop-title";
    head.appendChild(h);
    if (d.epithet) head.appendChild(el("p", "lore-pop-epithet", d.epithet));
    body.appendChild(head);
    if (d.missing) {
      body.appendChild(el("p", "seek-panel-empty", "No article yet"));
      return;
    }
    if (d.quote) {
      var q = el("blockquote", "lore-pop-quote");
      var qp = d.quote.querySelector("p"), qc = d.quote.querySelector("cite");
      if (qp) q.appendChild(copyInline(qp, el("p"), url));
      if (qc) q.appendChild(copyInline(qc, el("cite"), url));
      body.appendChild(q);
    }
    if (d.dossier || d.facts) {
      var sec = el("section", "lore-pop-dossier");
      if (d.dossier) {
        var dl = el("dl");
        Array.prototype.forEach.call(d.dossier.children, function (n) {
          if (n.tagName === "DT" || n.tagName === "DD") dl.appendChild(copyInline(n, el(n.tagName.toLowerCase()), url));
        });
        sec.appendChild(dl);
      }
      if (d.facts) {
        var ul = el("ul", "lore-pop-facts");
        Array.prototype.forEach.call(d.facts.querySelectorAll("li"), function (li) {
          ul.appendChild(copyInline(li, el("li"), url));
        });
        sec.appendChild(ul);
      }
      body.appendChild(sec);
    }
    var desc = d.desc || (d.line && d.line !== d.epithet ? d.line : "");
    if (desc) body.appendChild(el("p", "lore-pop-desc", desc));

    var links = el("nav", "lore-pop-links");
    links.setAttribute("aria-label", "Related");
    var own = el("a", "seek-panel-ment lore-pop-article");
    own.href = url;
    own.appendChild(el("span", "seek-panel-ment-title", "Read the full article"));
    own.appendChild(el("span", "seek-panel-kind", d.name || cardName));
    links.appendChild(own);
    (d.related || []).forEach(function (grp) {
      var gw = el("div", "lore-pop-group");
      if (grp.head) {
        var hh = el("h3", "lore-pop-group-head");
        if (grp.href) { var ha = el("a", null, grp.head); ha.href = grp.href; hh.appendChild(ha); }
        else hh.textContent = grp.head;
        gw.appendChild(hh);
      }
      if (grp.links.length) {
        var ul2 = el("ul", "lore-pop-rel");
        grp.links.forEach(function (l) {
          var li = el("li"), a = el("a", null, l.text);
          a.href = l.href;
          li.appendChild(a);
          ul2.appendChild(li);
        });
        gw.appendChild(ul2);
      }
      links.appendChild(gw);
    });
    body.appendChild(links);
  }
})();
