/* Search: type-to-filter (Gallery/Index hide unmatched), PowerToys panel, search.html. */
(function () {
  var seek = document.getElementById("seek");
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
        sec.classList.remove("is-seek-empty");
        return;
      }
      var any = false;
      for (var i = 0; i < cards.length; i++) {
        if (!cards[i].classList.contains("is-seek-miss")) { any = true; break; }
      }
      sec.classList.toggle("is-seek-empty", !!(q && !any));
    });
  }

  function renderHits(q) {
    if (!hits || !isSearchPage) return;
    if (!q || !window.SEARCH_INDEX) {
      hits.hidden = true;
      hits.innerHTML = "";
      return;
    }
    var seen = {};
    var rows = [];
    window.SEARCH_INDEX.forEach(function (entry) {
      if (!canSee(entry)) return;
      var titleHit = entry.title.toLowerCase().indexOf(q) !== -1;
      var textHit = entry.text && entry.text.toLowerCase().indexOf(q) !== -1;
      if (!titleHit && !textHit) return;
      var key = entry.href.split("#")[0] + "::" + entry.title;
      if (seen[key]) return;
      seen[key] = true;
      var snip = textHit ? makeSnippet(entry.text, q) : "";
      rows.push({ entry: entry, snip: snip, titleHit: titleHit });
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
        ? '<img class="hit-art" src="' + escapeHtml(absHref(e.image)) + '" alt="">'
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
    var seenMent = {};
    if (!q || !window.SEARCH_INDEX) return { cards: cards, mentions: mentions };
    window.SEARCH_INDEX.forEach(function (entry) {
      if (!canSee(entry)) return;
      var titleHit = entry.title.toLowerCase().indexOf(q) !== -1;
      var textHit = !!(entry.text && entry.text.toLowerCase().indexOf(q) !== -1);
      if (!titleHit && !textHit) return;

      var cardKind = entry.kind === "article" || entry.kind === "figure" || entry.kind === "journal";
      if (titleHit && entry.image && cardKind) {
        var ck = entry.title.toLowerCase();
        var prev = seenCard[ck];
        if (!prev || (prev.kind !== "article" && entry.kind === "article")) {
          seenCard[ck] = entry;
        }
      }

      var mentKind = entry.kind === "journal" || entry.kind === "codex" || entry.kind === "atlas" || entry.kind === "lore";
      if (textHit || (titleHit && mentKind && !entry.image)) {
        var mk = entry.href.split("#")[0] + "::" + entry.title;
        if (seenMent[mk]) return;
        /* Prefer mention rows for corpus kinds; skip pure article title cards already shown. */
        if (entry.kind === "article" && titleHit && !textHit) return;
        if (entry.kind === "figure" && titleHit && !textHit) return;
        seenMent[mk] = true;
        mentions.push({
          entry: entry,
          snip: textHit ? makeSnippet(entry.text || "", q) : ""
        });
      }
    });
    Object.keys(seenCard).forEach(function (k) { cards.push(seenCard[k]); });
    cards.sort(function (a, b) { return a.title.localeCompare(b.title); });
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
        return '<a class="seek-panel-card" href="' + escapeHtml(absHref(e.href)) + '">' +
          '<img src="' + escapeHtml(absHref(e.image)) + '" alt="">' +
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
      s.src = assetBase() + "search-index.js?v=s2";
      s.onload = function () { indexReady = true; resolve(); };
      s.onerror = function () { resolve(); };
      document.head.appendChild(s);
    });
    indexLoading.then(function () { cb && cb(); });
  }

  function ensurePanel() {
    if (panel) return panel;
    panel = document.createElement("div");
    panel.id = "seek-panel";
    panel.hidden = true;
    panel.innerHTML =
      '<div class="seek-panel-scrim" data-seek-close="1"></div>' +
      '<div class="seek-panel-box" role="dialog" aria-modal="true" aria-label="Search">' +
      '<input id="seek-panel-input" type="search" placeholder="Search" autocomplete="off" spellcheck="false">' +
      '<div id="seek-panel-results"></div></div>';
    document.body.appendChild(panel);
    panelInput = document.getElementById("seek-panel-input");
    panelResults = document.getElementById("seek-panel-results");
    panel.addEventListener("click", function (e) {
      if (e.target && e.target.getAttribute("data-seek-close")) closePanel();
    });
    panelInput.addEventListener("input", function () {
      var q = panelInput.value.trim().toLowerCase();
      if (seek) seek.value = panelInput.value;
      applyQuery();
      renderPanel(q);
    });
    return panel;
  }

  function openPanel(preset) {
    ensurePanel();
    ensureIndex(function () {
      panel.hidden = false;
      document.body.classList.add("seek-panel-open");
      var val = typeof preset === "string" ? preset : (seek ? seek.value : "");
      panelInput.value = val;
      var q = val.trim().toLowerCase();
      renderPanel(q);
      setTimeout(function () {
        panelInput.focus();
        panelInput.setSelectionRange(panelInput.value.length, panelInput.value.length);
      }, 0);
    });
  }

  function closePanel() {
    if (!panel || panel.hidden) return;
    panel.hidden = true;
    document.body.classList.remove("seek-panel-open");
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

  var params = new URLSearchParams(location.search);
  if (params.get("q") && seek) {
    seek.value = params.get("q");
    applyQuery();
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
      if (e.key === "Enter" && t === panelInput) {
        var first = panelResults && (panelResults.querySelector("a.seek-panel-card") || panelResults.querySelector("a.seek-panel-ment"));
        if (first && first.getAttribute("href")) {
          e.preventDefault();
          location.href = first.getAttribute("href");
        }
        return;
      }
      return;
    }

    if (typingInField && t !== seek) return;
    if (e.altKey) return;
    if (e.metaKey || e.ctrlKey) return;

    if (e.key === "Enter" && seek && seek.value.trim()) {
      e.preventDefault();
      /* Gallery / Index: open panel with the filter query. */
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
