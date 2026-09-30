(function () {
  if (!document.getElementById("atlas-map-style")) {
    const s = document.createElement("style");
    s.id = "atlas-map-style";
    s.textContent =
      ".journal-read .atlas-map{margin:48px 0 24px;}" +
      ".journal-read .atlas-map img{max-height:none!important;width:100%;height:auto;object-fit:contain;border:1px solid #000;background:transparent;display:block;}";
    document.head.appendChild(s);
  }

  function hashPath() {
    return (location.hash || "").replace(/^#\/?/, "");
  }

  function byId(id) {
    return (window.CODEX || []).find(function (c) { return c.id === id; });
  }

  function atlasItems() {
    const ids = ["cosm", "essen-revir", "far-nybei", "hesk"];
    const rest = ids.filter(function (id) { return byId(id); }).map(function (id) {
      const c = byId(id);
      return { id: id, href: "#/atlas/" + id, label: c.tab || c.title };
    }).sort(function (a, b) { return a.label.localeCompare(b.label); });
    return [{ id: "world", href: "#/atlas/world", label: "Overview" }].concat(rest);
  }

  function paintItems(currentId) {
    return atlasItems().map(function (c) {
      const on = c.id === currentId ? " active" : "";
      return '<a class="' + on + '" href="' + c.href + '">' + c.label + '</a>';
    }).join("");
  }

  function retab(currentId) {
    const html = paintItems(currentId || "world");
    document.querySelectorAll(".chapter-tabs, .atlas-tabs, .subbar").forEach(function (nav) {
      nav.innerHTML = html;
    });
    document.querySelectorAll(".nav-drop").forEach(function (drop) {
      const head = drop.querySelector(":scope > a");
      if (!head || head.textContent.trim() !== "Atlas") return;
      const menu = drop.querySelector(".nav-menu");
      if (menu) menu.innerHTML = html;
    });
    document.querySelectorAll("a").forEach(function (a) {
      if (a.textContent.trim() === "Map" || a.textContent.trim() === "Eras") a.remove();
    });
  }

  window.renderAtlasWorld = function (id) {
    if (id === "eras" || id === "map") id = "world";
    const current = byId(id) || byId("world");
    if (!current) return;
    if (window.place) window.place.hash = "#/atlas/" + current.id;
    document.title = (current.title || "Atlas") + " - Elorae";
    document.body.className = "room journal-page on-atlas";
    const tabs = '<nav class="chapter-tabs">' + paintItems(current.id) + '</nav>';
    const heading = current.heading
      ? '<h2 class="codex-h">' + escapeHtml(current.heading) + '</h2>'
      : "";
    document.body.innerHTML =
      '<div class="journal-bg"><img src="' + encodeURI(current.banner || (window.COVER || "assets/Godtree.png")) + '" alt=""></div>' +
      '<header class="topbar journal-bar">' + brand() + '<nav class="filters">' + rooms("atlas") + '</nav></header>' +
      tabs +
      '<div class="sheet">' +
      '<article class="journal-read">' +
      heading +
      (current.blocks || []).map(journalBlock).join("") +
      '</article></div>';
    document.querySelectorAll('.journal-read img[src*="EloraeLowRes"]').forEach(function (img) {
      const fig = img.closest("figure");
      if (fig) fig.classList.add("atlas-map");
    });
    if (typeof bindPlaceScroll === "function") bindPlaceScroll();
    if (typeof bindIdleScrollbar === "function") bindIdleScrollbar(document.querySelector(".sheet"));
    retab(current.id);
  };

  function openWorld(id) {
    if (id === "eras" || id === "map") id = "world";
    const nid = id || "world";
    if (hashPath() !== "atlas/" + nid) history.replaceState(null, "", "#/atlas/" + nid);
    window.renderAtlasWorld(nid);
  }

  function restoreHash() {
    const h = hashPath();
    if (h === "atlas" || h.indexOf("atlas/") === 0) {
      const raw = h === "atlas" ? "world" : (h.slice(6) || "world");
      openWorld(raw === "eras" || raw === "map" ? "world" : raw);
      return true;
    }
    if (h === "codex" || h.indexOf("codex/") === 0) {
      const id = h === "codex" ? "calendar" : (h.slice(6) || "calendar");
      if (typeof window.renderCodex === "function") window.renderCodex(id);
      return true;
    }
    return false;
  }

  const prevRoute = window.route;
  window.route = function () {
    if (restoreHash()) return;
    if (typeof prevRoute === "function") prevRoute();
  };

  document.addEventListener("click", function (e) {
    const a = e.target.closest("a");
    if (!a) return;
    const href = a.getAttribute("href") || "";
    const label = a.textContent.replace(/\s+/g, " ").trim();
    const inTabs = a.closest(".chapter-tabs, .atlas-tabs, .nav-menu, .subbar");
    const inTopAtlas = a.closest(".filters, .nav-drop") && !inTabs;

    if (label === "Map" || label === "Eras" || href === "#/atlas" || href === "#/atlas/eras") {
      e.preventDefault();
      e.stopImmediatePropagation();
      openWorld("world");
      return;
    }
    if (label === "Atlas" && inTopAtlas) {
      e.preventDefault();
      e.stopImmediatePropagation();
      openWorld("world");
      return;
    }
    if (href.indexOf("#/atlas/") === 0) {
      e.preventDefault();
      e.stopImmediatePropagation();
      openWorld(href.replace(/^#\/atlas\/?/, "") || "world");
    }
  }, true);

  window.addEventListener("hashchange", function () {
    restoreHash();
  });
  restoreHash();
  setTimeout(restoreHash, 0);
  setTimeout(restoreHash, 60);
  setInterval(function () {
    const path = hashPath();
    if (path.indexOf("atlas") === 0) {
      const id = path === "atlas" ? "world" : path.replace(/^atlas\/?/, "") || "world";
      if (!document.body.classList.contains("on-atlas")) restoreHash();
      else retab(id === "eras" || id === "map" ? "world" : id);
    }
  }, 400);
})();
