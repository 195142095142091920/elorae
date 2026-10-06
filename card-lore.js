/* Index card lore reveal (art82 -> art86 flip -> art90 fill -> art91 face toggles).
   One click / tap / Enter on an Index card reveals its dossier face over the card (crossfade,
   instant with prefers-reduced-motion) without navigating; a click / Enter anywhere on the
   revealed face flips it back to the card. Navigation only via the two links on the face: the
   dossier name and the quiet "ARTICLE \u2192" line (bottom right); both go to the card's
   article and never flip the card. Clicking another card reveals that one and resets the
   previous; Escape or a click outside the cards resets. Middle-, Ctrl-, Cmd-, Shift-clicks on
   the card are left alone (new tab / window via the anchor's href). No glyph.
   Face (inside the card's own box, card size unchanged): name, epithet, lore quote, dossier
   fields (dl.art-dossier + ul.art-facts) and the opening of the lore (first .art-life
   paragraph, whole sentences), read on demand from articles/<slug>.html. Backdrop: the
   article's MAIN hero art heavily blurred under a dark frosted veil (tiny precomputed copy
   from tools/art-palette.py -> card-lore-palette.js; falls back to the card's own image);
   labels take a subtle accent from the same palette. fit(): type scales with the card
   (container query units x --ls); the largest scale that fits is chosen so the text fills the
   whole card (flex column, space-between); only if even the smallest scale cannot hold
   everything are the summary / quote / facts / rows clamped. No overlay, no page lock. */
(function () {
  if (!document.body.classList.contains("index-page")) return;
  var cards = Array.prototype.slice.call(document.querySelectorAll("a.index-card"));
  if (!cards.length) return;

  var MAX_SENTENCES = 3, MAX_CHARS = 260;
  var PAL = window.__lorePalette || {};
  var ROOT = new URL("./", document.currentScript ? document.currentScript.src : location.href).href;
  var flipped = null, cache = {}, ro = null;

  cards.forEach(function (card) { card.setAttribute("aria-expanded", "false"); });

  /* Capture: a card click reveals its face; a click on the revealed face flips it back; the
     face's links (name, ARTICLE line) navigate normally and never flip. */
  document.addEventListener("click", function (e) {
    var t = e.target;
    if (t.closest && t.closest("a.card-lore-link")) return; /* inner link: default navigation */
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return; /* new tab etc. */
    var card = t.closest && t.closest("a.index-card");
    if (!card) { if (flipped) unflip(); return; } /* outside click resets, then proceeds */
    e.preventDefault();
    e.stopPropagation();
    if (card === flipped) { unflip(); return; } /* click on the face: back to the card */
    if (flipped) unflip();
    flip(card);
  }, true);
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape" || !flipped) return;
    var sp = document.getElementById("seek-panel");
    if (sp && !sp.hidden) return; /* search panel owns Escape while open */
    e.preventDefault();
    e.stopPropagation(); /* only resets the card; the Categories rail keeps its state */
    unflip(true);
  }, true);

  function slugOf(url) { var m = /\/articles\/([^\/?#]+)\.html/.exec(url); return m ? m[1] : ""; }

  function flip(card) {
    var url = card.href;
    var back = card.querySelector(".card-lore-back");
    if (!back) {
      back = document.createElement("div");
      back.className = "card-lore-back";
      back.setAttribute("aria-hidden", "true");
      back.innerHTML = '<div class="card-lore-bg"></div><div class="card-lore-veil"></div><div class="card-lore-face"></div>';
      card.appendChild(back);
      var p = PAL[slugOf(url)] || {}, img = card.querySelector("img");
      var fallback = img ? img.currentSrc || img.src : "";
      var bg = back.querySelector(".card-lore-bg");
      var src = p.blur ? new URL(p.blur, ROOT).href : fallback;
      var probe = new Image();
      probe.onload = function () { bg.style.backgroundImage = 'url("' + src + '")'; };
      probe.onerror = function () { if (fallback) bg.style.backgroundImage = 'url("' + fallback + '")'; };
      probe.src = src;
      if (p.label) { back.classList.add("has-art-palette"); back.style.setProperty("--lore-label-rgb", p.label); }
      fill(back, card, url);
    }
    flipped = card;
    card.classList.add("is-lore-flipped");
    card.setAttribute("aria-expanded", "true");
    back.setAttribute("aria-hidden", "false");
    links(back, true);
    fit(back);
    if (window.ResizeObserver) {
      if (!ro) ro = new ResizeObserver(function () { if (flipped) fit(flipped.querySelector(".card-lore-back")); });
      ro.observe(card);
    }
  }

  function unflip() {
    var card = flipped;
    if (!card) return;
    flipped = null;
    if (ro) ro.unobserve(card);
    card.classList.remove("is-lore-flipped");
    card.setAttribute("aria-expanded", "false");
    var back = card.querySelector(".card-lore-back");
    if (back) { back.setAttribute("aria-hidden", "true"); links(back, false); }
  }

  /* Face links are tabbable only while the face is shown. */
  function links(back, on) {
    Array.prototype.forEach.call(back.querySelectorAll("a.card-lore-link"), function (a) {
      if (on) a.removeAttribute("tabindex"); else a.setAttribute("tabindex", "-1");
    });
  }
  function link(cls, url, txt, label) {
    var a = el("a", "card-lore-link " + cls, txt);
    a.href = url;
    if (label) a.setAttribute("aria-label", label);
    a.addEventListener("click", function (e) { e.stopPropagation(); });
    a.addEventListener("keydown", function (e) { e.stopPropagation(); });
    return a;
  }

  function fill(back, card, url) {
    var face = back.querySelector(".card-lore-face");
    var name = (card.querySelector("span") || {}).textContent || "";
    var go = function (d) { render(face, d, url, name); links(back, flipped === card); if (flipped === card) fit(back); };
    if (cache[url]) { go(cache[url]); return; }
    render(face, { loading: true }, url, name);
    fetch(url, { credentials: "same-origin" }).then(function (r) {
      if (!r.ok) throw new Error(r.status);
      return r.text();
    }).then(function (html) { cache[url] = extract(html); go(cache[url]); })
      .catch(function () { go({ missing: true }); });
  }

  /* ---- extraction (verbatim text) ---- */
  function text(el) { return el ? el.textContent.replace(/\s+/g, " ").trim() : ""; }
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
  function extract(html) {
    var doc = new DOMParser().parseFromString(html, "text/html");
    var lore = doc.querySelector("#lore");
    var firstLife = lore && lore.querySelector("p.art-life");
    var q = lore && lore.querySelector("blockquote.art-quote");
    var rows = [];
    var dl = doc.querySelector("#dossier dl.art-dossier"), dt = null;
    if (dl) Array.prototype.forEach.call(dl.children, function (n) {
      if (n.tagName === "DT") dt = text(n);
      else if (n.tagName === "DD") rows.push([dt || "", text(n)]);
    });
    return {
      name: text(doc.querySelector(".art-title h1")),
      epithet: text(doc.querySelector(".art-title .art-epithet")),
      line: text(doc.querySelector("#description .art-line")),
      quote: q ? text(q.querySelector("p")) : "",
      cite: q ? text(q.querySelector("cite")) : "",
      rows: rows,
      facts: lore ? Array.prototype.map.call(lore.querySelectorAll("ul.art-facts li"), text) : [],
      desc: firstLife ? opening(firstLife.textContent) : ""
    };
  }

  function el(tag, cls, txt) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  }
  /* No <span> anywhere: .index-card span is the card's name label. */
  function render(face, d, url, cardName) {
    face.innerHTML = "";
    var nm = el("p", "card-lore-name");
    nm.appendChild(link("card-lore-name-link", url, d.name || cardName));
    face.appendChild(nm);
    if (d.epithet) face.appendChild(el("p", "card-lore-epithet", d.epithet));
    if (d.loading || d.missing) { face.appendChild(el("p", "card-lore-note", d.loading ? "Loading\u2026" : "No article yet")); return; }
    if (d.quote) {
      var q = el("blockquote", "card-lore-quote");
      q.appendChild(el("p", null, d.quote));
      if (d.cite) q.appendChild(el("cite", null, d.cite));
      face.appendChild(q);
    }
    if (d.rows.length) {
      var dl = el("dl", "card-lore-dossier");
      d.rows.forEach(function (r) {
        var w = el("div", "card-lore-row");
        w.appendChild(el("dt", null, r[0]));
        w.appendChild(el("dd", null, r[1]));
        dl.appendChild(w);
      });
      face.appendChild(dl);
    }
    if (d.facts.length) face.appendChild(el("p", "card-lore-facts", d.facts.join(" \u00b7 ")));
    var desc = d.desc || (d.line && d.line !== d.epithet ? d.line : "");
    if (desc) face.appendChild(el("p", "card-lore-desc", desc));
    face.appendChild(link("card-lore-article", url, "Article \u2192", "Read the article: " + (d.name || cardName)));
  }

  /* Fill the card: for each content level (all content first; then progressively clamped),
     binary-search the largest type scale (--ls) that fits the face without overflow; take the
     first level that fits at >= MIN_OK, else the last level at the smallest scale. Remaining
     slack is spread by the face's flex column (space-between). */
  var LS_MIN = 0.7, LS_MAX = 2.4, MIN_OK = 0.95;
  function fit(back) {
    if (!back) return;
    var face = back.querySelector(".card-lore-face");
    var rows = face.querySelectorAll(".card-lore-row");
    var base = { sum: 8, quote: 5, cite: 1, facts: 1, rows: rows.length, epi: 1, sumOn: 1, quoteOn: 1 };
    var steps = [
      ["sum", 6], ["sum", 4], ["quote", 4], ["sum", 3], ["cite", 0], ["quote", 3], ["sum", 2], ["facts", 0],
      ["quote", 2], ["rows", 4], ["sum", 1], ["quote", 1], ["rows", 3], ["epi", 0], ["rows", 2],
      ["sumOn", 0], ["rows", 1], ["quoteOn", 0], ["rows", 0]
    ];
    function apply(S, ls) {
      face.style.setProperty("--ls", ls);
      face.style.setProperty("--sum-lines", S.sum);
      face.style.setProperty("--quote-lines", S.quote);
      face.classList.toggle("no-cite", !S.cite);
      face.classList.toggle("no-facts", !S.facts);
      face.classList.toggle("no-epithet", !S.epi);
      face.classList.toggle("no-desc", !S.sumOn);
      face.classList.toggle("no-quote", !S.quoteOn);
      Array.prototype.forEach.call(rows, function (r, i) { r.hidden = i >= S.rows; });
    }
    function fits() { return face.scrollHeight <= face.clientHeight + 1; }
    function best(S) {
      apply(S, LS_MIN);
      if (!fits()) return 0;
      var lo = LS_MIN, hi = LS_MAX;
      apply(S, hi);
      if (fits()) return hi;
      for (var n = 0; n < 9; n++) {
        var mid = (lo + hi) / 2;
        apply(S, mid);
        if (fits()) lo = mid; else hi = mid;
      }
      return lo;
    }
    face.classList.add("is-fitting");
    var S = {}, k; for (k in base) S[k] = base[k];
    var ls = best(S), i = 0;
    while (ls < MIN_OK && i < steps.length) {
      if (!(steps[i][0] === "rows" && S.rows <= steps[i][1])) S[steps[i][0]] = steps[i][1];
      i++;
      ls = best(S);
    }
    apply(S, Math.floor((ls || LS_MIN) * 1000) / 1000);
    face.classList.remove("is-fitting");
  }
})();
