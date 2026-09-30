(function () {
  const ATLAS_ORDER = ["cosm", "essen-revir", "far-nybei", "hesk", "world"];
  const CODEX_TAB_ORDER = ["calendar", "lore", "magics", "souls"];

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
  function byIdMap() {
    const byId = {};
    pages().forEach(function (c) { byId[c.id] = c; });
    return byId;
  }
  function codexTabPages() {
    const byId = byIdMap();
    return CODEX_TAB_ORDER.map(function (id) { return byId[id]; }).filter(Boolean);
  }
  function atlasPages() {
    const byId = byIdMap();
    return ATLAS_ORDER.map(function (id) { return byId[id]; }).filter(Boolean);
  }

  function loreSlug(text) {
    return "work-" + String(text || "").toLowerCase()
      .replace(/^the\s+/, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  }
  function loreSortKey(text) {
    return String(text || "").replace(/^the\s+/i, "").toLowerCase();
  }
  function prepareLoreBlocks(blocks) {
    const preface = [];
    const works = [];
    let current = null;
    (blocks || []).forEach(function (b) {
      if (b.type === "h3" && /table of contents/i.test(b.text || "")) return;
      if (b.type === "list") return;
      if (b.type === "h2i") {
        current = { title: b.text, blocks: [b] };
        works.push(current);
        return;
      }
      if (current) current.blocks.push(b);
      else preface.push(b);
    });
    works.sort(function (a, b) {
      return loreSortKey(a.title).localeCompare(loreSortKey(b.title));
    });
    const body = preface.slice();
    works.forEach(function (w) { body.push.apply(body, w.blocks); });
    return { titles: works.map(function (w) { return w.title; }), blocks: body };
  }
  function loreRail(titles) {
    return '<aside class="lore-rail">' +
      '<button type="button" class="lore-toc-toggle" aria-expanded="false">Contents</button>' +
      '<h3 class="codex-h3">Contents</h3>' +
      '<div class="lore-toc-panel"><ul class="codex-toc">' +
      (titles || []).map(function (item) {
        const id = loreSlug(item);
        return '<li><a href="#" data-lore-jump="' + id + '">' + escapeHtml(item) + '</a></li>';
      }).join("") +
      '</ul></div></aside>';
  }

  function layoutLoreMobile() {
    const rail = document.querySelector(".lore-rail");
    const sheet = document.querySelector(".sheet");
    if (!rail || !sheet || !document.body.classList.contains("lore-page")) {
      if (sheet) sheet.style.top = "";
      return;
    }
    if (window.innerWidth > 980) {
      sheet.style.top = "";
      return;
    }
    const tabs = document.querySelector(".chapter-tabs");
    const tabBottom = tabs ? tabs.getBoundingClientRect().bottom : 88;
    sheet.style.top = Math.round(tabBottom + rail.offsetHeight) + "px";
  }

  window.journalBlock = function (block) {
    if (!block) return "";
    if (block.type === "h2") return '<h2 class="codex-h">' + escapeHtml(block.text || "") + '</h2>';
    if (block.type === "h2i") {
      return '<h2 class="codex-title" id="' + loreSlug(block.text) + '">' + escapeHtml(block.text || "") + '</h2>';
    }
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
        if (block.jump) {
          const id = loreSlug(item);
          return '<li><a href="#" data-lore-jump="' + id + '">' + escapeHtml(item) + '</a></li>';
        }
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
    const items = [{ id: "map", href: "#/atlas", label: "Map" }].concat(atlasPages().map(function (c) {
      return { id: c.id, href: "#/atlas/" + c.id, label: c.tab || c.title };
    }));
    items.sort(function (a, b) { return a.label.localeCompare(b.label); });
    return items.map(function (c) {
      const on = (c.id === "map" && (!currentId || currentId === "map")) || c.id === currentId ? " active" : "";
      return '<a class="' + on + '" href="' + c.href + '">' + escapeHtml(c.label) + '</a>';
    }).join("");
  }

  function atlasMenu(currentId) {
    return atlasTabs(currentId);
  }

  function codexTabs(currentId) {
    return codexTabPages().map(function (c) {
      return '<a class="' + (c.id === currentId ? " active" : "") + '" href="#/codex/' + c.id + '">' +
        escapeHtml(c.tab || c.title) + '</a>';
    }).join("");
  }

  function codexMenu(currentId) {
    return codexTabs(currentId);
  }

  function currentRoom() {
    const hash = (location.hash || "").replace(/^#\/?/, "");
    if (hash === "atlas" || hash.startsWith("atlas/")) return "atlas";
    if (hash === "codex" || hash.startsWith("codex/")) return "codex";
    return hash.split("/")[0] || "gallery";
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
      tabs +
      '<div class="sheet">' +
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
    const tabsList = codexTabPages();
    const current = tabsList.find(function (c) { return c.id === id; }) ||
      pages().find(function (c) { return c.id === id; }) ||
      tabsList[0];
    if (!current) return;
    if (ATLAS_ORDER.indexOf(current.id) !== -1) {
      window.renderAtlasWorld(current.id);
      return;
    }
    place.hash = "#/codex/" + current.id;
    document.title = current.title + " - Elorae";
    document.body.className = "room journal-page" + (current.id === "lore" ? " lore-page" : "");
    const tabs = '<nav class="chapter-tabs">' + codexTabs(current.id) + '</nav>';
    const prepared = current.id === "lore" ? prepareLoreBlocks(current.blocks) : null;
    const blocks = prepared ? prepared.blocks : (current.blocks || []);
    const rail = prepared ? loreRail(prepared.titles) : "";
    const heading = current.heading && current.heading !== current.title && current.id !== "lore"
      ? '<h2 class="codex-h">' + escapeHtml(current.heading) + '</h2>'
      : "";
    document.body.innerHTML =
      '<div class="journal-bg"><img src="' + encodeURI(current.banner || COVER) + '" alt=""></div>' +
      '<header class="topbar journal-bar">' + brand() + '<nav class="filters">' + rooms("codex") + '</nav></header>' +
      tabs +
      rail +
      '<div class="sheet">' +
      '<article class="journal-read">' +
      heading +
      blocks.map(journalBlock).join("") +
      '</article></div>';
    bindPlaceScroll();
    bindIdleScrollbar(document.querySelector(".sheet"));
    layoutLoreMobile();
  };

  rooms = function (current) {
    const hash = (location.hash || "").replace(/^#\/?/, "");
    const atlasId = hash.indexOf("atlas/") === 0 ? hash.slice(6) : (hash === "atlas" ? "map" : "");
    const pageId = hash.indexOf("codex/") === 0 ? hash.slice(6) : "";
    const atlasOn = current === "atlas" || hash === "atlas" || hash.startsWith("atlas/");
    const codexOn = current === "codex" || hash === "codex" || hash.startsWith("codex/");
    return [
      { id: "atlas", html: '<span class="nav-drop"><a class="' + (atlasOn ? " active" : "") + '" href="#/atlas">Atlas</a><span class="nav-menu">' + atlasMenu(atlasId) + '</span></span>' },
      { id: "codex", html: '<span class="nav-drop"><a class="' + (codexOn ? " active" : "") + '" href="#/codex">Codex</a><span class="nav-menu">' + codexMenu(pageId) + '</span></span>' },
      { id: "gallery", html: '<a class="' + (current === "gallery" ? " active" : "") + '" href="#/gallery">Gallery</a>' },
      { id: "index", html: '<a class="' + (current === "index" ? " active" : "") + '" href="#/index">Index</a>' },
      { id: "journal", html: '<a class="' + (current === "journal" ? " active" : "") + '" href="#/journal">Journal</a>' }
    ].map(function (item) { return item.html; }).join('<span class="dot">&middot;</span>');
  };

  document.addEventListener("click", function (e) {
    const toggle = e.target.closest(".lore-toc-toggle");
    if (toggle) {
      e.preventDefault();
      const rail = toggle.closest(".lore-rail");
      const open = !rail.classList.contains("open");
      rail.classList.toggle("open", open);
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      layoutLoreMobile();
      return;
    }
    const jump = e.target.closest("a[data-lore-jump]");
    if (jump) {
      e.preventDefault();
      e.stopImmediatePropagation();
      document.querySelectorAll(".lore-rail a").forEach(function (a) { a.classList.remove("active"); });
      jump.classList.add("active");
      const rail = jump.closest(".lore-rail");
      if (rail && window.innerWidth <= 980) {
        rail.classList.remove("open");
        const btn = rail.querySelector(".lore-toc-toggle");
        if (btn) btn.setAttribute("aria-expanded", "false");
        layoutLoreMobile();
      }
      const el = document.getElementById(jump.getAttribute("data-lore-jump"));
      const sheet = document.querySelector(".sheet");
      if (el && sheet) {
        requestAnimationFrame(function () {
          const top = el.getBoundingClientRect().top - sheet.getBoundingClientRect().top + sheet.scrollTop - 8;
          sheet.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
        });
      }
      return;
    }
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

  function navLabels(nav) {
    return Array.from(nav.querySelectorAll(":scope > a, :scope > .nav-drop > a")).map(function (a) {
      return a.textContent.trim();
    });
  }

  function paintNav() {
    const nav = document.querySelector(".filters");
    if (!nav) return;
    const hash = (location.hash || "").replace(/^#\/?/, "");
    const labels = navLabels(nav);
    if (labels.join() !== "Atlas,Codex,Gallery,Index,Journal") {
      nav.innerHTML = rooms(currentRoom());
    } else {
      wrapLink(nav, "#/atlas", atlasMenu(hash.indexOf("atlas/") === 0 ? hash.slice(6) : "map"));
      wrapLink(nav, "#/codex", codexMenu(hash.indexOf("codex/") === 0 ? hash.slice(6) : ""));
    }
    paintAtlasTabs();
  }
  paintNav();
  setInterval(paintNav, 400);
  window.addEventListener("resize", layoutLoreMobile);

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
