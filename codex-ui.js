(function () {
  const ATLAS_ORDER = ["world", "hesk", "cosm", "far-nybei", "essen-revir"];

  function pages() {
    (window.CODEX || []).forEach(function (p) {
      if (p.section) return;
      if (p.id === "souls") { p.section = "souls"; p.sectionTitle = "Souls"; }
      else if (p.id === "calendar") { p.section = "calendar"; p.sectionTitle = "Calendar"; }
      else if (p.id === "magics" || (p.id && p.id.indexOf("magics") === 0)) { p.section = "magics"; p.sectionTitle = "Magics"; }
      else if (p.id === "lore") { p.section = "lore"; p.sectionTitle = "Lore"; }
      else { p.section = "world"; p.sectionTitle = p.sectionTitle || "World"; }
    });
    return window.CODEX || [];
  }
  function sectionOf(page) { return (page && page.section) || "world"; }
  function roots() {
    const seen = {};
    const out = [];
    pages().forEach(function (c) {
      const s = sectionOf(c);
      if (s === "world" || seen[s]) return;
      seen[s] = true;
      const first = pages().find(function (p) { return sectionOf(p) === s; });
      out.push({ section: s, id: first.id, title: first.sectionTitle || first.title });
    });
    return out;
  }
  function inSection(sec) {
    return pages().filter(function (c) { return sectionOf(c) === sec; });
  }
  function atlasPages() {
    const byId = {};
    pages().forEach(function (c) { byId[c.id] = c; });
    return ATLAS_ORDER.map(function (id) { return byId[id]; }).filter(Boolean);
  }

  window.journalBlock = function (block) {
    if (!block) return "";
    if (block.type === "h2") return '<h2 class="codex-h">' + escapeHtml(block.text || "") + '</h2>';
    if (block.type === "h2i") return '<h2 class="codex-title">' + escapeHtml(block.text || "") + '</h2>';
    if (block.type === "h3") return '<h3 class="codex-h3">' + escapeHtml(block.text || "") + '</h3>';
    if (block.type === "by") return '<p class="codex-by">' + escapeHtml(block.text || "") + '</p>';
    if (block.type === "quote") {
      const body = escapeHtml(block.text || "").replace(/\n/g, "<br>");
      return '<blockquote class="codex-quote"><p>' + body + '</p>' +
        (block.by ? '<cite>' + escapeHtml(block.by) + '</cite>' : '') + '</blockquote>';
    }
    if (block.type === "caption") return '<p class="codex-cap">' + escapeHtml(block.text || "") + '</p>';
    if (block.type === "list") {
      return '<ul class="codex-toc">' + (block.items || []).map(function (item) {
        return '<li>' + escapeHtml(item) + '</li>';
      }).join("") + '</ul>';
    }
    if (block.type === "table") {
      const head = '<tr>' + (block.headers || []).map(function (h) {
        return '<th>' + escapeHtml(h) + '</th>';
      }).join("") + '</tr>';
      const body = (block.rows || []).map(function (row) {
        return '<tr>' + row.map(function (cell) {
          return '<td>' + escapeHtml(cell) + '</td>';
        }).join("") + '</tr>';
      }).join("");
      return '<div class="codex-table-wrap"><table class="codex-table"><thead>' + head + '</thead><tbody>' + body + '</tbody></table></div>';
    }
    if (block.type === "school") {
      return '<p class="codex-school"><span>' + escapeHtml(block.name || "") + '</span> ' +
        escapeHtml(block.text || "") +
        (block.note ? '<em>' + escapeHtml(block.note) + '</em>' : '') + '</p>';
    }
    if (block.type === "image") {
      const id = galleryIdFor(block.src);
      const img = '<img src="' + encodeURI(block.src) + '" alt="' + escapeHtml(block.cap || "") + '">';
      const cap = block.cap ? '<figcaption>' + escapeHtml(block.cap) + '</figcaption>' : "";
      if (id) return '<figure class="journal-fig"><a href="#/' + id + '">' + img + '</a>' + cap + '</figure>';
      return '<figure class="journal-fig">' + img + cap + '</figure>';
    }
    return '<p>' + escapeHtml(block.text || "") + '</p>';
  };

  function atlasTabs(currentId) {
    const mapOn = !currentId || currentId === "map" ? " active" : "";
    return '<a class="' + mapOn + '" href="#/atlas">Map</a>' + atlasPages().map(function (c) {
      return '<a class="' + (c.id === currentId ? " active" : "") + '" href="#/atlas/' + c.id + '">' +
        escapeHtml(c.tab || c.title) + '</a>';
    }).join("");
  }

  function atlasMenu(currentId) {
    return atlasTabs(currentId);
  }

  function codexMenu(currentId) {
    const current = pages().find(function (c) { return c.id === currentId; });
    const sec = sectionOf(current);
    return roots().map(function (r) {
      const on = r.section === sec ? " active" : "";
      return '<a class="' + on + '" href="#/codex/' + r.id + '">' + escapeHtml(r.title) + '</a>';
    }).join("");
  }

  window.renderAtlasWorld = function (id) {
    const group = atlasPages();
    const current = group.find(function (c) { return c.id === id; }) || group[0];
    if (!current) return;
    if (window.place) window.place.hash = "#/atlas/" + current.id;
    document.title = current.title + " - Elorae";
    document.body.className = "room journal-page";
    const tabs = '<nav class="chapter-tabs">' + atlasTabs(current.id) + '</nav>';
    document.body.innerHTML =
      '<div class="journal-bg"><img src="' + encodeURI(current.banner || COVER) + '" alt=""></div>' +
      '<header class="topbar journal-bar">' + brand() + '<nav class="filters">' + rooms("atlas") + '</nav></header>' +
      '<div class="sheet">' + tabs +
      '<article class="journal-read">' +
      (current.heading ? '<h2 class="codex-h">' + escapeHtml(current.heading) + '</h2>' : "") +
      (current.blocks || []).map(journalBlock).join("") +
      '</article></div>';
    bindPlaceScroll();
    bindIdleScrollbar(document.querySelector(".sheet"));
  };

  function paintAtlasTabs() {
    if (!document.body.classList.contains("atlas-page")) return;
    const existing = document.querySelector(".atlas-tabs");
    if (existing) {
      existing.innerHTML = atlasTabs("map");
      return;
    }
    if (document.querySelector(".chapter-tabs")) return;
    const bar = document.querySelector(".topbar");
    if (!bar) return;
    bar.insertAdjacentHTML("afterend", '<nav class="subbar atlas-tabs">' + atlasTabs("map") + '</nav>');
  }

  window.renderCodex = function (id) {
    const all = pages();
    const current = all.find(function (c) { return c.id === id; }) || all.find(function (c) {
      return sectionOf(c) !== "world";
    }) || all[0];
    if (!current) return;
    if (ATLAS_ORDER.indexOf(current.id) !== -1) {
      window.renderAtlasWorld(current.id);
      return;
    }
    const group = inSection(sectionOf(current));
    place.hash = "#/codex/" + current.id;
    document.title = current.title + " - Elorae";
    document.body.className = "room journal-page";
    const tabs = group.length > 1
      ? '<nav class="chapter-tabs">' + group.map(function (c) {
          return '<a class="' + (c.id === current.id ? " active" : "") + '" href="#/codex/' + c.id + '">' +
            escapeHtml(c.tab || c.title) + '</a>';
        }).join("") + '</nav>'
      : "";
    document.body.innerHTML =
      '<div class="journal-bg"><img src="' + encodeURI(current.banner || COVER) + '" alt=""></div>' +
      '<header class="topbar journal-bar">' + brand() + '<nav class="filters">' + rooms("codex") + '</nav></header>' +
      '<div class="sheet">' + tabs +
      '<article class="journal-read">' +
      (current.heading ? '<h2 class="codex-h">' + escapeHtml(current.heading) + '</h2>' : "") +
      (current.blocks || []).map(journalBlock).join("") +
      '</article></div>';
    bindPlaceScroll();
    bindIdleScrollbar(document.querySelector(".sheet"));
  };

  rooms = function (current) {
    const hash = (location.hash || "").replace(/^#\/?/, "");
    const atlasId = hash.indexOf("atlas/") === 0 ? hash.slice(6) : (hash === "atlas" ? "map" : "");
    const pageId = hash.indexOf("codex/") === 0 ? hash.slice(6) : "";
    const atlasOn = current === "atlas" || hash === "atlas" || hash.startsWith("atlas/");
    const main = [["atlas", "Atlas"], ["gallery", "Gallery"], ["index", "Index"], ["journal", "Journal"]]
      .map(function (pair) {
        if (pair[0] === "atlas") {
          return '<span class="nav-drop">' +
            '<a class="' + (atlasOn ? " active" : "") + '" href="#/atlas">Atlas</a>' +
            '<span class="nav-menu">' + atlasMenu(atlasId) + '</span>' +
            '</span>';
        }
        return '<a class="' + (current === pair[0] ? " active" : "") + '" href="#/' + pair[0] + '">' + pair[1] + '</a>';
      })
      .join('<span class="dot">&middot;</span>');
    const on = current === "codex" ? " active" : "";
    return main +
      '<span class="dot">&middot;</span>' +
      '<span class="nav-drop">' +
        '<a class="' + on + '" href="#/codex">Codex</a>' +
        '<span class="nav-menu">' + codexMenu(pageId) + '</span>' +
      '</span>';
  };

  document.addEventListener("click", function (e) {
    const drop = e.target.closest(".nav-drop");
    const a = e.target.closest('a[href^="#/codex"], a[href^="#/atlas"]');
    const touch = !window.matchMedia("(hover: hover)").matches;
    if (a && drop && (a.getAttribute("href") === "#/codex" || a.getAttribute("href") === "#/atlas") && touch) {
      e.preventDefault();
      e.stopImmediatePropagation();
      document.querySelectorAll(".nav-drop.open").forEach(function (el) {
        if (el !== drop) el.classList.remove("open");
      });
      drop.classList.toggle("open");
      return;
    }
    if (!drop) document.querySelectorAll(".nav-drop.open").forEach(function (el) { el.classList.remove("open"); });
    if (!a) return;
    const href = a.getAttribute("href") || "";
    if (href.indexOf("#/atlas") === 0) {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (href === "#/atlas") {
        if (location.hash === "#/atlas") paintAtlasTabs();
        else location.hash = "#/atlas";
        return;
      }
      history.replaceState(null, "", href);
      window.renderAtlasWorld(href.replace(/^#\/atlas\/?/, ""));
      return;
    }
    e.preventDefault();
    e.stopImmediatePropagation();
    history.replaceState(null, "", href);
    const nid = href === "#/codex" ? "" : href.replace(/^#\/codex\/?/, "");
    window.renderCodex(nid);
  }, true);

  function wrapLink(nav, href, menuHtml) {
    const existing = Array.from(nav.querySelectorAll(".nav-drop")).find(function (el) {
      const a = el.querySelector("a");
      return a && a.getAttribute("href") === href;
    });
    if (existing) {
      const menu = existing.querySelector(".nav-menu");
      if (menu) menu.innerHTML = menuHtml;
      return;
    }
    const lone = Array.from(nav.querySelectorAll("a")).find(function (a) {
      return a.getAttribute("href") === href && !a.closest(".nav-drop");
    });
    if (!lone) return;
    const wrap = document.createElement("span");
    wrap.className = "nav-drop";
    lone.replaceWith(wrap);
    wrap.appendChild(lone);
    const menu = document.createElement("span");
    menu.className = "nav-menu";
    menu.innerHTML = menuHtml;
    wrap.appendChild(menu);
  }

  function paintNav() {
    const nav = document.querySelector(".filters");
    if (!nav) return;
    const hash = (location.hash || "").replace(/^#\/?/, "");
    wrapLink(nav, "#/atlas", atlasMenu(hash.indexOf("atlas/") === 0 ? hash.slice(6) : "map"));
    if (!nav.querySelector('a[href="#/codex"]')) {
      nav.insertAdjacentHTML("beforeend",
        '<span class="dot">&middot;</span><span class="nav-drop"><a href="#/codex">Codex</a><span class="nav-menu">' +
        codexMenu("") + '</span></span>');
    } else {
      wrapLink(nav, "#/codex", codexMenu(hash.indexOf("codex/") === 0 ? hash.slice(6) : ""));
    }
    paintAtlasTabs();
  }
  paintNav();
  setInterval(paintNav, 400);

  function routeAtlas() {
    const boot = location.hash.replace(/^#\/?/, "");
    if (boot.startsWith("atlas/") && boot !== "atlas/") {
      window.renderAtlasWorld(boot.slice(6));
      return true;
    }
    if (boot === "codex" || boot.startsWith("codex/")) {
      const nid = boot === "codex" ? "" : boot.slice(6);
      const page = pages().find(function (c) { return c.id === nid; });
      if (page && ATLAS_ORDER.indexOf(page.id) !== -1) {
        history.replaceState(null, "", "#/atlas/" + page.id);
        window.renderAtlasWorld(page.id);
        return true;
      }
      window.renderCodex(nid);
      return true;
    }
    return false;
  }

  window.addEventListener("hashchange", function () {
    const h = location.hash.replace(/^#\/?/, "");
    if (h.startsWith("atlas/") && h !== "atlas/") {
      window.renderAtlasWorld(h.slice(6));
    } else if (h === "atlas") {
      requestAnimationFrame(paintAtlasTabs);
    }
  });

  routeAtlas();
})();
