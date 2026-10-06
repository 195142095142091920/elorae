/* Index card lore flip (art82 glyph; art86 flip replaces the art82/85 pop-out overlay).
   Each Index card gets a bare page glyph (bottom-right). Clicking it never follows the card
   link; it flips the CARD FACE (crossfade) to a dossier back face that fits inside the card's
   own box: name (links to the article), epithet, lore quote, dossier fields (dl.art-dossier +
   ul.art-facts) and the opening of the lore (first .art-life paragraph, whole sentences).
   No article button, no Related links. Text is read on demand from articles/<slug>.html.
   Backdrop: the article's MAIN hero art, heavily blurred under a dark frosted veil (tiny
   precomputed copy from tools/art-palette.py -> card-lore-palette.js; falls back to the
   card's own image). Labels take a subtle accent from the same palette (neutral if none).
   Fit: content never grows the card — type scales with the card (container query units),
   and fit() clamps/drops the summary, quote, facts and dossier rows until nothing overflows.
   The same glyph (now an X) flips back; so do Escape and flipping another card. While
   flipped, clicks on the card do nothing except on the name link. No overlay, no page lock. */
(function () {
  if (!document.body.classList.contains("index-page")) return;
  var cards = Array.prototype.slice.call(document.querySelectorAll("a.index-card"));
  if (!cards.length) return;

  var GLYPH = '<svg viewBox="0 0 11 13" aria-hidden="true">' +
    '<path d="M1.5 0.5h5.5l2.5 2.5v9.5h-8z M7 0.5v2.5h2.5 M3.5 6h4 M3.5 8h4 M3.5 10h2.5" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg>';
  var BACK = '<svg viewBox="0 0 11 13" aria-hidden="true">' +
    '<path d="M1.5 3.5L9.5 11.5M9.5 3.5L1.5 11.5" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" vector-effect="non-scaling-stroke"/></svg>';
  var MAX_SENTENCES = 3, MAX_CHARS = 260;
  var PAL = window.__lorePalette || {};
  var ROOT = new URL("./", document.currentScript ? document.currentScript.src : location.href).href;

  cards.forEach(function (card) {
    var label = card.querySelector("span");
    var g = document.createElement("i"); /* not a span: .index-card span is the name label */
    g.className = "card-lore-glyph";
    g.setAttribute("role", "button");
    g.setAttribute("tabindex", "0");
    g.setAttribute("aria-expanded", "false");
    g.setAttribute("aria-label", "Quick lore: " + (label ? label.textContent : "card"));
    g.innerHTML = GLYPH;
    card.appendChild(g);
  });

  var flipped = null, cache = {}, ro = null;
  function glyphOf(e) { return e.target && e.target.closest ? e.target.closest(".card-lore-glyph") : null; }

  /* Capture: glyph toggles; while flipped, the card itself never navigates (name link only). */
  document.addEventListener("click", function (e) {
    var g = glyphOf(e);
    if (g) { e.preventDefault(); e.stopPropagation(); toggle(g.closest("a.index-card")); return; }
    var card = e.target.closest && e.target.closest("a.index-card.is-lore-flipped");
    if (!card) return;
    if (e.target.closest(".card-lore-name a[href]")) { e.stopPropagation(); return; } /* navigates */
    e.preventDefault();
    e.stopPropagation();
  }, true);
  document.addEventListener("auxclick", function (e) {
    if (glyphOf(e)) { e.preventDefault(); e.stopPropagation(); }
  }, true);
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && flipped) {
      var sp = document.getElementById("seek-panel");
      if (sp && !sp.hidden) return; /* search panel owns Escape while open */
      e.preventDefault();
      e.stopPropagation(); /* only flips back; the Categories rail keeps its state */
      unflip(true);
      return;
    }
    var g = glyphOf(e);
    if (!g || (e.key !== "Enter" && e.key !== " ")) return;
    e.preventDefault();
    e.stopPropagation();
    toggle(g.closest("a.index-card"));
  }, true);

  function slugOf(url) { var m = /\/articles\/([^\/?#]+)\.html/.exec(url); return m ? m[1] : ""; }

  function toggle(card) {
    if (!card) return;
    if (flipped === card) { unflip(true); return; }
    if (flipped) unflip(false);
    flip(card);
  }

  function flip(card) {
    var url = card.href, glyph = card.querySelector(".card-lore-glyph");
    var back = card.querySelector(".card-lore-back");
    if (!back) {
      back = document.createElement("div");
      back.className = "card-lore-back";
      back.setAttribute("aria-hidden", "true");
      back.innerHTML = '<div class="card-lore-bg"></div><div class="card-lore-veil"></div><div class="card-lore-face"></div>';
      card.insertBefore(back, glyph); /* glyph stays on top (same z-index, later in DOM) */
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
    back.setAttribute("aria-hidden", "false");
    glyph.innerHTML = BACK;
    glyph.setAttribute("aria-expanded", "true");
    glyph.setAttribute("aria-label", "Flip back");
    fit(back);
    if (window.ResizeObserver) {
      if (!ro) ro = new ResizeObserver(function () { if (flipped) fit(flipped.querySelector(".card-lore-back")); });
      ro.observe(card);
    }
  }

  function unflip(refocus) {
    var card = flipped;
    if (!card) return;
    flipped = null;
    if (ro) ro.unobserve(card);
    card.classList.remove("is-lore-flipped");
    var back = card.querySelector(".card-lore-back"), glyph = card.querySelector(".card-lore-glyph");
    if (back) back.setAttribute("aria-hidden", "true");
    glyph.innerHTML = GLYPH;
    glyph.setAttribute("aria-expanded", "false");
    glyph.setAttribute("aria-label", "Quick lore: " + ((card.querySelector("span") || {}).textContent || "card"));
    if (refocus && document.activeElement && card.contains(document.activeElement)) {
      try { glyph.focus({ preventScroll: true }); } catch (e) { glyph.focus(); }
    }
  }

  function fill(back, card, url) {
    var face = back.querySelector(".card-lore-face");
    var name = (card.querySelector("span") || {}).textContent || "";
    var go = function (d) { render(face, d, url, name); if (flipped === card) fit(back); };
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
    var h = el("p", "card-lore-name"), a = el("a", null, d.name || cardName);
    a.href = url;
    h.appendChild(a);
    face.appendChild(h);
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
  }

  /* Shrink content until it fits the card face (no growth, no scroll). Each step is tried in
     order; the first state that fits wins. Line clamps are CSS (-webkit-line-clamp vars). */
  function fit(back) {
    if (!back) return;
    var face = back.querySelector(".card-lore-face");
    var rows = face.querySelectorAll(".card-lore-row");
    var S = { sum: 4, quote: 3, cite: 1, facts: 1, rows: rows.length, epi: 1, sumOn: 1, quoteOn: 1 };
    var steps = [
      ["sum", 3], ["sum", 2], ["cite", 0], ["quote", 2], ["facts", 0], ["rows", 4], ["sum", 1],
      ["quote", 1], ["rows", 3], ["epi", 0], ["rows", 2], ["sumOn", 0], ["rows", 1], ["quoteOn", 0], ["rows", 0]
    ];
    function apply() {
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
    apply();
    for (var i = 0; i < steps.length && !fits(); i++) {
      if (steps[i][0] === "rows" && S.rows <= steps[i][1]) continue;
      S[steps[i][0]] = steps[i][1];
      apply();
    }
  }
})();
