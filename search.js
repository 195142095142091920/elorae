/* Search: type-to-filter (Index hides unmatched), PowerToys panel, search.html. */
(function () {
  var seek = document.getElementById("seek");
  /* nt12: the form input is parked off-screen (0x0); keep it out of the Tab order. Type-to-search
     still works: the keydown handler below focuses it programmatically. */
  if (seek && seek.getBoundingClientRect().width < 2) seek.tabIndex = -1;
  var show = document.getElementById("seek-show");
  var hits = document.getElementById("search-hits");
  var isSearchPage = document.body.classList.contains("search-page");
  var panel = null;
  var panelInput = null;
  var panelResults = null;
  var indexLoading = null;
  var indexReady = !!(window.SEARCH_INDEX);

  function sealWho() {
    try { return localStorage.getItem("elorae-seal") || ""; } catch (e) { return ""; }
  }

  function canSee(entry) {
    if (!entry.private) return true;
    var who = sealWho();
    if (who === "devin") return true;
    return !!(who && entry.owner && who === entry.owner);
  }

  function escapeHtml(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  /* SEARCH_INDEX (and some HTML attrs) may store apostrophes as &#x27; — decode before URL use. */
  function decodeEntities(s) {
    return String(s == null ? "" : s)
      .replace(/&#x27;/gi, "'")
      .replace(/&#39;/g, "'")
      .replace(/&apos;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&");
  }

  function safeAssetUrl(href) {
    return absHref(decodeEntities(href || ""));
  }

  function assetBase() {
    var el = document.querySelector('script[src*="search.js"]');
    if (!el || !el.src) return "";
    return el.src.replace(/search\.js[^/]*$/, "");
  }

  function absHref(href) {
    if (!href) return "#";
    if (/^(https?:|mailto:|#)/i.test(href)) return href;
    return assetBase() + href;
  }

  function makeSnippet(text, q) {
    var lower = text.toLowerCase();
    var i = lower.indexOf(q);
    if (i < 0) return "";
    var a = Math.max(0, i - 70);
    var b = Math.min(text.length, i + q.length + 70);
    var snip = text.slice(a, b).trim();
    if (a) snip = "\u2026" + snip;
    if (b < text.length) snip = snip + "\u2026";
    var qi = snip.toLowerCase().indexOf(q);
    if (qi < 0) return escapeHtml(snip);
    return escapeHtml(snip.slice(0, qi)) + "<mark>" + escapeHtml(snip.slice(qi, qi + q.length)) + "</mark>" + escapeHtml(snip.slice(qi + q.length));
  }

  function isFilterPage() {
    return !!(document.querySelector("main.wall .tile") || document.querySelector(".index-card"));
  }

  function applyLocalFilter(q) {
    document.querySelectorAll(".tile").forEach(function (tile) {
      var name = (tile.querySelector(".label") || {}).textContent || "";
      var miss = !!(q && name.toLowerCase().indexOf(q) === -1);
      tile.classList.toggle("is-seek-miss", miss);
      tile.classList.remove("is-dim");
    });
    document.querySelectorAll(".index-card").forEach(function (card) {
      var name = (card.querySelector("span") || card).textContent || "";
      var miss = !!(q && name.toLowerCase().indexOf(q) === -1);
      card.classList.toggle("is-seek-miss", miss);
    });
    document.querySelectorAll(".index-cat").forEach(function (sec) {
      var cards = sec.querySelectorAll(".index-card");
      if (!cards.length) {
        /* Hide placeholder "none filed" cats while filtering. */
        sec.classList.toggle("is-seek-empty", !!q);
        return;
      }
      var any = false;
      for (var i = 0; i < cards.length; i++) {
        if (!cards[i].classList.contains("is-seek-miss")) { any = true; break; }
      }
      sec.classList.toggle("is-seek-empty", !!(q && !any));
    });
  }

  /* Canonical page identity: path without hash (one result per page/article/journal). */
  function pageKey(href) {
    return String(href || "").split("#")[0];
  }

  /* Higher = better single hit to keep when collapsing same-page rows. */
  function hitScore(entry, titleHit, textHit, q) {
    var score = 0;
    if (titleHit) score += 100;
    if (textHit) score += 10;
    var kindBoost = { article: 50, journal: 40, codex: 30, atlas: 20, lore: 15 };
    score += kindBoost[entry.kind] || 0;
    if (entry.image && entry.kind === "article") score += 25;
    if (textHit && entry.text && q) {
      var i = entry.text.toLowerCase().indexOf(q);
      if (i >= 0) score += Math.max(0, 8 - Math.min(8, Math.floor(i / 250)));
    }
    return score;
  }

  function renderHits(q) {
    if (!hits || !isSearchPage) return;
    if (!q || !window.SEARCH_INDEX) {
      hits.hidden = true;
      hits.innerHTML = "";
      return;
    }
    var best = {};
    window.SEARCH_INDEX.forEach(function (entry) {
      if (!canSee(entry)) return;
      var titleHit = entry.title.toLowerCase().indexOf(q) !== -1;
      var textHit = !!(entry.text && entry.text.toLowerCase().indexOf(q) !== -1);
      if (!titleHit && !textHit) return;
      var key = pageKey(entry.href);
      if (!key) return;
      var score = hitScore(entry, titleHit, textHit, q);
      var prev = best[key];
      if (prev && prev.score >= score) return;
      best[key] = {
        score: score,
        entry: entry,
        snip: textHit ? makeSnippet(entry.text || "", q) : "",
        titleHit: titleHit
      };
    });
    var rows = Object.keys(best).map(function (k) { return best[k]; });
    rows.sort(function (a, b) {
      if (b.score !== a.score) return b.score - a.score;
      return a.entry.title.localeCompare(b.entry.title);
    });
    if (!rows.length) {
      hits.hidden = true;
      hits.innerHTML = "";
      return;
    }
    hits.hidden = false;
    hits.innerHTML = "<h2>Mentions</h2>" + rows.map(function (r) {
      var e = r.entry;
      var thumb = e.image
        ? '<img class="hit-art" src="' + escapeHtml(safeAssetUrl(e.image)) + '" alt="">'
        : '<span class="hit-art hit-art-empty" aria-hidden="true"></span>';
      var kind = e.kind ? '<span class="hit-kind">' + escapeHtml(e.kind) + "</span>" : "";
      var sn = r.snip ? '<p class="hit-snip">' + r.snip + "</p>" : "";
      return '<a class="hit" href="' + escapeHtml(absHref(e.href)) + '">' + thumb +
        '<span class="hit-body"><span class="hit-title">' + escapeHtml(e.title) + "</span>" + kind + sn + "</span></a>";
    }).join("");
  }

  function collectPanel(q) {
    var cards = [];
    var mentions = [];
    var seenCard = {};
    var cardPages = {};
    var bestMent = {};
    if (!q || !window.SEARCH_INDEX) return { cards: cards, mentions: mentions };
    window.SEARCH_INDEX.forEach(function (entry) {
      if (!canSee(entry)) return;
      var titleHit = entry.title.toLowerCase().indexOf(q) !== -1;
      var textHit = !!(entry.text && entry.text.toLowerCase().indexOf(q) !== -1);
      if (!titleHit && !textHit) return;

      /* Cards: primary Index/article subjects only. */
      if (titleHit && entry.image && entry.kind === "article") {
        var ck = entry.title.toLowerCase();
        if (!seenCard[ck]) seenCard[ck] = entry;
      }

      var mentKind = entry.kind === "journal" || entry.kind === "codex" || entry.kind === "atlas" || entry.kind === "lore";
      if (textHit || (titleHit && mentKind && !entry.image)) {
        /* Prefer mention rows for corpus kinds; skip pure article title cards. */
        if (entry.kind === "article" && titleHit && !textHit) return;
        var mk = pageKey(entry.href);
        if (!mk) return;
        var score = hitScore(entry, titleHit, textHit, q);
        var prev = bestMent[mk];
        if (prev && prev.score >= score) return;
        bestMent[mk] = {
          score: score,
          entry: entry,
          snip: textHit ? makeSnippet(entry.text || "", q) : ""
        };
      }
    });
    Object.keys(seenCard).forEach(function (k) {
      cards.push(seenCard[k]);
      var pk = pageKey(seenCard[k].href);
      if (pk) cardPages[pk] = true;
    });
    cards.sort(function (a, b) { return a.title.localeCompare(b.title); });
    /* One mention per page; drop pages already shown as primary cards. */
    Object.keys(bestMent).forEach(function (mk) {
      if (cardPages[mk]) return;
      mentions.push(bestMent[mk]);
    });
    var mentRank = { journal: 0, codex: 1, atlas: 2, lore: 3 };
    mentions.sort(function (a, b) {
      var ra = mentRank[a.entry.kind];
      var rb = mentRank[b.entry.kind];
      if (ra === undefined) ra = 9;
      if (rb === undefined) rb = 9;
      if (ra !== rb) return ra - rb;
      return a.entry.title.localeCompare(b.entry.title);
    });
    return { cards: cards, mentions: mentions };
  }

  function renderPanel(q) {
    if (!panelResults) return;
    if (!q) {
      panelResults.innerHTML = "";
      return;
    }
    var pack = collectPanel(q);
    var html = "";
    if (pack.cards.length) {
      html += '<div class="seek-panel-cards">' + pack.cards.map(function (e) {
        var indexHref = absHref("index/ancients.html") + "?card=" + encodeURIComponent(e.href);
        return '<a class="seek-panel-card" href="' + escapeHtml(indexHref) + '" data-article="' + escapeHtml(e.href) + '" title="Click: Index · Double-click: article">' +
          '<img src="' + escapeHtml(safeAssetUrl(e.image)) + '" alt="">' +
          '<span>' + escapeHtml(e.title) + "</span></a>";
      }).join("") + "</div>";
    }
    if (pack.mentions.length) {
      html += '<div class="seek-panel-ments"><h3>Mentions</h3>' + pack.mentions.map(function (r) {
        var e = r.entry;
        var kind = e.kind ? '<span class="seek-panel-kind">' + escapeHtml(e.kind) + "</span>" : "";
        var sn = r.snip ? '<p class="seek-panel-snip">' + r.snip + "</p>" : "";
        return '<a class="seek-panel-ment" href="' + escapeHtml(absHref(e.href)) + '">' +
          '<span class="seek-panel-ment-title">' + escapeHtml(e.title) + "</span>" + kind + sn + "</a>";
      }).join("") + "</div>";
    }
    if (!html) {
      html = '<p class="seek-panel-empty">No matches</p>';
    }
    panelResults.innerHTML = html;
    panelFocusIdx = -1;
    if (pack.cards.length || pack.mentions.length) setPanelFocus(0);
  }

  function ensureIndex(cb) {
    if (window.SEARCH_INDEX) {
      indexReady = true;
      cb && cb();
      return;
    }
    if (indexLoading) {
      indexLoading.then(function () { cb && cb(); });
      return;
    }
    indexLoading = new Promise(function (resolve) {
      var s = document.createElement("script");
      s.src = assetBase() + "search-index.js?v=s6";
      s.onload = function () { indexReady = true; resolve(); };
      s.onerror = function () { resolve(); };
      document.head.appendChild(s);
    });
    indexLoading.then(function () { cb && cb(); });
  }

  var cardClickTimer = null;
  var CARD_CLICK_MS = 280;

  function indexHrefForArticle(articleHref) {
    return absHref("index/ancients.html") + "?card=" + encodeURIComponent(articleHref || "");
  }

  function goIndexCard(articleHref) {
    if (!articleHref) return;
    closePanel();
    location.href = indexHrefForArticle(articleHref);
  }

  function goArticle(articleHref) {
    if (!articleHref) return;
    closePanel();
    location.href = absHref(articleHref);
  }

  var panelFocusIdx = -1;

  function panelItems() {
    if (!panelResults) return [];
    return Array.prototype.slice.call(panelResults.querySelectorAll("a.seek-panel-card, a.seek-panel-ment"));
  }

  function setPanelFocus(idx) {
    var items = panelItems();
    if (!items.length) {
      panelFocusIdx = -1;
      return;
    }
    if (idx < 0) idx = items.length - 1;
    if (idx >= items.length) idx = 0;
    panelFocusIdx = idx;
    items.forEach(function (el, i) {
      el.classList.toggle("is-seek-focus", i === panelFocusIdx);
    });
    try {
      items[panelFocusIdx].scrollIntoView({ block: "nearest", behavior: "smooth" });
    } catch (err) {
      try { items[panelFocusIdx].scrollIntoView(false); } catch (e2) {}
    }
  }

  function activateFocusedResult() {
    var items = panelItems();
    if (!items.length) return false;
    var el = items[panelFocusIdx >= 0 ? panelFocusIdx : 0];
    if (!el) return false;
    var art = el.getAttribute("data-article");
    if (art) {
      goArticle(art);
      return true;
    }
    var href = el.getAttribute("href");
    if (href) {
      closePanel();
      location.href = href;
      return true;
    }
    return false;
  }

  function ensurePanel() {
    if (panel) return panel;
    panel = document.createElement("div");
    panel.id = "seek-panel";
    panel.hidden = true;
    panel.innerHTML =
      '<div class="seek-panel-scrim" data-seek-close="1"></div>' +
      '<div class="seek-panel-box" role="dialog" aria-modal="true" aria-label="Search">' +
      '<button type="button" class="seek-panel-close" data-seek-close="1" aria-label="Close">' +
      '<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M1.5 1.5L12.5 12.5M12.5 1.5L1.5 12.5" fill="none" stroke="#f3eee6" stroke-width="1" stroke-linecap="round" vector-effect="non-scaling-stroke"/></svg>' +
      '</button>' +
      '<input id="seek-panel-input" type="text" role="searchbox" placeholder="Search" autocomplete="off" spellcheck="false" enterkeyhint="search">' +
      '<div id="seek-panel-results"></div></div>';
    document.body.appendChild(panel);
    panelInput = document.getElementById("seek-panel-input");
    panelResults = document.getElementById("seek-panel-results");
    panel.addEventListener("click", function (e) {
      if (e.target && e.target.closest && e.target.closest("[data-seek-close]")) {
        closePanel();
        return;
      }
      var card = e.target && e.target.closest && e.target.closest("a.seek-panel-card");
      if (!card || !panelResults.contains(card)) return;
      e.preventDefault();
      e.stopPropagation();
      if (cardClickTimer) return;
      var art = card.getAttribute("data-article");
      cardClickTimer = setTimeout(function () {
        cardClickTimer = null;
        goIndexCard(art);
      }, CARD_CLICK_MS);
    });
    panel.addEventListener("dblclick", function (e) {
      var card = e.target && e.target.closest && e.target.closest("a.seek-panel-card");
      if (!card || !panelResults.contains(card)) return;
      e.preventDefault();
      e.stopPropagation();
      if (cardClickTimer) {
        clearTimeout(cardClickTimer);
        cardClickTimer = null;
      }
      var art = card.getAttribute("data-article");
      if (art) goArticle(art);
    });
    panelInput.addEventListener("input", function () {
      var q = panelInput.value.trim().toLowerCase();
      if (seek) seek.value = panelInput.value;
      applyQuery();
      renderPanel(q);
    });
    return panel;
  }

  var seekLockY = 0;
  function lockSeekScroll() {
    if (!window.matchMedia("(max-width: 800px)").matches) return;
    seekLockY = window.scrollY || window.pageYOffset || 0;
    document.documentElement.classList.add("seek-panel-lock");
    document.body.classList.add("seek-panel-open");
    document.body.style.top = "-" + seekLockY + "px";
  }
  function unlockSeekScroll() {
    document.documentElement.classList.remove("seek-panel-lock");
    document.body.classList.remove("seek-panel-open");
    if (document.body.style.top) {
      document.body.style.top = "";
      window.scrollTo(0, seekLockY || 0);
    }
  }
  function openPanel(preset) {
    ensurePanel();
    var val = typeof preset === "string" ? preset : (seek ? seek.value : "");
    panel.hidden = false;
    lockSeekScroll();
    document.body.classList.add("seek-panel-open");
    panelInput.value = val;
    panelResults.innerHTML = val.trim() ? '<p class="seek-panel-empty">Searching…</p>' : "";
    setTimeout(function () {
      try {
        panelInput.focus();
        panelInput.setSelectionRange(panelInput.value.length, panelInput.value.length);
      } catch (err) {}
    }, 0);
    ensureIndex(function () {
      if (!isPanelOpen()) return;
      renderPanel(panelInput.value.trim().toLowerCase());
    });
  }

  function closePanel() {
    if (!panel || panel.hidden) return;
    panel.hidden = true;
    unlockSeekScroll();
  }

  function isPanelOpen() {
    return !!(panel && !panel.hidden);
  }

  function currentQuery() {
    return seek ? seek.value.trim() : "";
  }

  function applyQuery() {
    if (!seek) return;
    var q = seek.value.trim().toLowerCase();
    if (show) {
      if (q) {
        show.hidden = false;
        show.textContent = seek.value.trim();
      } else {
        show.hidden = true;
        show.textContent = "";
      }
    }
    applyLocalFilter(q);
    renderHits(q);
  }

  function injectGlyph() {
    var nav = document.querySelector("nav.filters");
    if (!nav || nav.querySelector(".seek-glyph")) return;
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "seek-glyph";
    btn.setAttribute("aria-label", "Search");
    btn.innerHTML = '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><circle cx="6.5" cy="6.5" r="4.5" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M10.2 10.2 L14 14" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>';
    btn.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      openPanel(currentQuery());
    });
    nav.appendChild(btn);
  }

  if (seek) seek.addEventListener("input", applyQuery);

  function scrollToIndexCard(articleHref) {
    if (!articleHref) return;
    var cards = document.querySelectorAll("a.index-card");
    var target = null;
    for (var i = 0; i < cards.length; i++) {
      var h = cards[i].getAttribute("href") || "";
      if (h === articleHref || h.slice(-articleHref.length) === articleHref) {
        target = cards[i];
        break;
      }
    }
    if (!target) return;
    try {
      target.scrollIntoView({ behavior: "smooth", block: "center" });
    } catch (err) {
      target.scrollIntoView(true);
    }
    target.classList.add("is-seek-flash");
    setTimeout(function () { target.classList.remove("is-seek-flash"); }, 1200);
  }

  var params = new URLSearchParams(location.search);
  if (params.get("q") && seek) {
    seek.value = params.get("q");
    applyQuery();
  }
  var cardTarget = params.get("card");
  if (cardTarget && document.querySelector("a.index-card")) {
    setTimeout(function () { scrollToIndexCard(cardTarget); }, 60);
  }

  injectGlyph();

  document.addEventListener("keydown", function (e) {
    var t = e.target;
    var typingInField = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);

    if (e.key === "Escape") {
      if (isPanelOpen()) {
        closePanel();
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      if (seek && seek.value && !typingInField) {
        seek.value = "";
        seek.dispatchEvent(new Event("input"));
        e.preventDefault();
        e.stopPropagation();
        return;
      }
    }

    /* Ctrl/Cmd+Enter opens panel from anywhere. */
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      e.stopPropagation();
      openPanel(currentQuery());
      return;
    }

    if (isPanelOpen()) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "ArrowRight" || e.key === "ArrowLeft") {
        var items = panelItems();
        if (items.length) {
          e.preventDefault();
          e.stopPropagation();
          if (panelFocusIdx < 0) {
            setPanelFocus(0);
          } else if (e.key === "ArrowDown" || e.key === "ArrowRight") {
            setPanelFocus(panelFocusIdx + 1);
          } else {
            setPanelFocus(panelFocusIdx - 1);
          }
        }
        return;
      }
      if (e.key === "Enter" && (t === panelInput || (t && t.closest && t.closest("#seek-panel")))) {
        e.preventDefault();
        e.stopPropagation();
        activateFocusedResult();
        return;
      }
      return;
    }

    if (typingInField && t !== seek) return;
    if (e.altKey) return;
    if (e.metaKey || e.ctrlKey) return;

    if (e.key === "Enter" && seek && seek.value.trim()) {
      e.preventDefault();
      /* Index / search wall: open panel with the filter query. */
      if (isFilterPage() && !isSearchPage) {
        openPanel(currentQuery());
        return;
      }
      /* search.html: open first visible tile or mention. */
      if (isSearchPage) {
        var hit = Array.prototype.find.call(document.querySelectorAll(".tile:not(.is-seek-miss):not(.is-dim)"), function (el) {
          return el.getClientRects().length > 0;
        });
        if (hit && hit.getAttribute("href")) {
          location.href = hit.getAttribute("href");
          return;
        }
        var ment = hits && hits.querySelector("a.hit");
        if (ment && ment.getAttribute("href")) {
          location.href = ment.getAttribute("href");
          return;
        }
      }
      /* Elsewhere: open the center panel instead of search.html. */
      openPanel(currentQuery());
      return;
    }

    if (t === seek) return;
    if (typingInField) return;
    if (e.key.length !== 1) return;
    if (e.key === " " && !(seek && seek.value)) return;
    if (!seek) return;
    seek.focus();
    seek.value += e.key;
    seek.dispatchEvent(new Event("input"));
    e.preventDefault();
  }, true);
})();

/* art67: phone page-name mark */
(function () {
  var body = document.body;
  if (!body || !body.classList.contains("article")) return;
  var h1 = document.querySelector(".art-title h1");
  var seal = document.querySelector(".mast .topbar > .mark > a[href$=\"seal.html\"], .mast .mark > a[href$=\"seal.html\"]");
  if (!h1 || !seal) return;
  var name = (h1.textContent || "").trim().split(/\s+/)[0];
  if (name) seal.textContent = name;
})();

/* art72: lock phone safe-area once (no scroll/resize chrome rewrite) */
(function lockPhoneSafeArea() {
  function apply() {
    try {
      if (!window.matchMedia || !window.matchMedia("(max-width: 800px)").matches) return;
      var probe = document.createElement("div");
      probe.setAttribute("aria-hidden", "true");
      probe.style.cssText = "position:fixed;left:0;top:0;width:0;visibility:hidden;pointer-events:none;padding-top:env(safe-area-inset-top,0px);box-sizing:border-box;";
      (document.documentElement || document.body).appendChild(probe);
      var sat = Math.max(0, Math.round(probe.getBoundingClientRect().height || probe.offsetHeight || 0));
      probe.remove();
      document.documentElement.style.setProperty("--sat-lock", sat + "px");
      document.documentElement.classList.add("sat-locked");
    } catch (e) {}
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", apply, { once: true });
  else apply();
  /* Intentionally NO scroll/resize re-lock — iOS toolbar collapse must not rewrite chrome. */
})();
