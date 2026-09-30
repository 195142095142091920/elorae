(function () {
  let stayOnMap = false;

  function hashPath() {
    return (location.hash || "").replace(/^#\/?/, "");
  }

  function isAtlas() {
    const hash = hashPath();
    return hash === "atlas" || hash.indexOf("atlas/") === 0;
  }

  function openWorld() {
    stayOnMap = false;
    if (typeof window.renderAtlasWorld === "function") {
      if (hashPath() !== "atlas/world") history.replaceState(null, "", "#/atlas/world");
      window.renderAtlasWorld("world");
    } else {
      location.hash = "#/atlas/world";
    }
  }

  function openMap() {
    stayOnMap = true;
    if (hashPath() !== "atlas") location.hash = "#/atlas";
  }

  document.addEventListener("click", function (e) {
    const a = e.target.closest("a");
    if (!a) return;
    const href = a.getAttribute("href") || "";
    const label = a.textContent.replace(/\s+/g, " ").trim();
    const inTabs = a.closest(".chapter-tabs, .atlas-tabs, .nav-menu, .subbar");
    const inTopAtlas = a.closest(".filters, .nav-drop") && !inTabs;

    if (label === "Map" && inTabs) {
      e.preventDefault();
      e.stopImmediatePropagation();
      openMap();
      return;
    }

    if (label === "Atlas" && inTopAtlas) {
      e.preventDefault();
      e.stopImmediatePropagation();
      openWorld();
      return;
    }

    if (href === "#/atlas/world" || (label === "Overview" && inTabs)) {
      e.preventDefault();
      e.stopImmediatePropagation();
      openWorld();
    }
  }, true);

  window.addEventListener("hashchange", function () {
    if (hashPath() === "atlas" && !stayOnMap) openWorld();
  });

  if (isAtlas() && hashPath() === "atlas" && !stayOnMap) openWorld();
})();
