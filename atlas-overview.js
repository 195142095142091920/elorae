(function () {
  function hashPath() {
    return (location.hash || "").replace(/^#\/?/, "");
  }

  function atlasItems() {
    const byId = {};
    (window.CODEX || []).forEach(function (c) { byId[c.id] = c; });
    const ids = ["cosm", "eras", "essen-revir", "far-nybei", "hesk"];
    const rest = ids.filter(function (id) { return byId[id]; }).map(function (id) {
      return { id: id, href: "#/atlas/" + id, label: byId[id].tab || byId[id].title };
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
      if (a.textContent.trim() === "Map" && (a.getAttribute("href") || "") === "#/atlas") a.remove();
    });
  }

  function openWorld(id) {
    const nid = id || "world";
    if (typeof window.renderAtlasWorld === "function") {
      if (hashPath() !== "atlas/" + nid) history.replaceState(null, "", "#/atlas/" + nid);
      window.renderAtlasWorld(nid);
      setTimeout(function () { retab(nid); }, 0);
    } else {
      location.hash = "#/atlas/" + nid;
    }
  }

  const prev = window.renderAtlasWorld;
  if (typeof prev === "function") {
    window.renderAtlasWorld = function (id) {
      prev(id);
      setTimeout(function () { retab(id || "world"); }, 0);
    };
  }

  document.addEventListener("click", function (e) {
    const a = e.target.closest("a");
    if (!a) return;
    const href = a.getAttribute("href") || "";
    const label = a.textContent.replace(/\s+/g, " ").trim();
    const inTabs = a.closest(".chapter-tabs, .atlas-tabs, .nav-menu, .subbar");
    const inTopAtlas = a.closest(".filters, .nav-drop") && !inTabs;

    if (label === "Map") {
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
    if (href === "#/atlas") {
      e.preventDefault();
      e.stopImmediatePropagation();
      openWorld("world");
      return;
    }
    if (href.indexOf("#/atlas/") === 0 && inTabs) {
      e.preventDefault();
      e.stopImmediatePropagation();
      openWorld(href.replace(/^#\/atlas\/?/, "") || "world");
    }
  }, true);

  window.addEventListener("hashchange", function () {
    if (hashPath() === "atlas") openWorld("world");
  });
  if (hashPath() === "atlas") setTimeout(function () { openWorld("world"); }, 0);
  setInterval(function () {
    const path = hashPath();
    if (path.indexOf("atlas") === 0) {
      const id = path === "atlas" ? "world" : path.replace(/^atlas\/?/, "") || "world";
      retab(id);
    }
  }, 400);
})();
