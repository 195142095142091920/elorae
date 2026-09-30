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
    if (typeof window.renderAtlasWorld !== "function") return;
    history.replaceState(null, "", "#/atlas/world");
    window.renderAtlasWorld("world");
  }
  function tabsEl() {
    return document.querySelector(".atlas-tabs") ||
      document.querySelector("body.on-atlas .chapter-tabs") ||
      document.querySelector("body.atlas-page .chapter-tabs");
  }
  function fix() {
    if (!isAtlas()) return;
    const hash = hashPath();
    if (hash === "atlas" && !stayOnMap) {
      openWorld();
      return;
    }
    const tabs = tabsEl();
    if (!tabs) return;
    let overview = Array.from(tabs.querySelectorAll("a")).find(function (a) {
      return a.textContent.replace(/\s+/g, " ").trim().toLowerCase() === "overview" ||
        a.getAttribute("href") === "#/atlas/world";
    });
    if (!overview) {
      overview = document.createElement("a");
      overview.textContent = "Overview";
      tabs.insertBefore(overview, tabs.firstChild);
    }
    overview.setAttribute("href", "#/atlas/world");
    overview.textContent = "Overview";
    Array.from(tabs.querySelectorAll("a")).forEach(function (a) {
      if (a !== overview && (a.textContent.replace(/\s+/g, " ").trim().toLowerCase() === "overview" || a.getAttribute("href") === "#/atlas/world")) {
        a.remove();
      }
    });
    if (tabs.firstElementChild !== overview) tabs.insertBefore(overview, tabs.firstChild);
    overview.classList.toggle("active", hash === "atlas/world");
    const map = Array.from(tabs.querySelectorAll("a")).find(function (a) {
      return a.textContent.replace(/\s+/g, " ").trim().toLowerCase() === "map";
    });
    if (map) {
      map.setAttribute("href", "#/atlas");
      map.classList.toggle("active", hash === "atlas" && stayOnMap);
    }
  }
  document.addEventListener("click", function (e) {
    const a = e.target.closest("a");
    if (!a) return;
    const href = a.getAttribute("href") || "";
    const label = a.textContent.replace(/\s+/g, " ").trim();
    if (label === "Map" && a.closest(".chapter-tabs, .atlas-tabs, .nav-menu")) {
      stayOnMap = true;
      return;
    }
    if (label === "Atlas" && a.closest(".filters, .nav-drop") && !a.closest(".nav-menu, .chapter-tabs, .atlas-tabs")) {
      e.preventDefault();
      e.stopImmediatePropagation();
      openWorld();
      return;
    }
    if (href === "#/atlas/world" || (label === "Overview" && a.closest(".chapter-tabs, .atlas-tabs, .nav-menu"))) {
      e.preventDefault();
      e.stopImmediatePropagation();
      openWorld();
    }
  }, true);
  setInterval(fix, 200);
  window.addEventListener("hashchange", function () {
    if (hashPath() === "atlas" && !stayOnMap) openWorld();
    else requestAnimationFrame(fix);
  });
})();
