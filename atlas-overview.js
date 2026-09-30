(function () {
  function isAtlas() {
    const hash = (location.hash || "").replace(/^#\/?/, "");
    return hash === "atlas" || hash.indexOf("atlas/") === 0;
  }
  function openWorld() {
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
    const hash = (location.hash || "").replace(/^#\/?/, "");
    if (hash === "atlas") {
      openWorld();
      return;
    }
    const tabs = tabsEl();
    if (!tabs) return;
    Array.from(tabs.querySelectorAll("a")).forEach(function (a) {
      const text = a.textContent.replace(/\s+/g, " ").trim().toLowerCase();
      const href = a.getAttribute("href") || "";
      if (text === "overview" && href !== "#/atlas/world") a.setAttribute("href", "#/atlas/world");
      if (text === "map" && href !== "#/atlas") a.setAttribute("href", "#/atlas");
    });
    let overview = tabs.querySelector('a[href="#/atlas/world"]');
    if (!overview) {
      overview = Array.from(tabs.querySelectorAll("a")).find(function (a) {
        return a.textContent.replace(/\s+/g, " ").trim().toLowerCase() === "overview";
      });
    }
    if (!overview) {
      overview = document.createElement("a");
      overview.setAttribute("href", "#/atlas/world");
      overview.textContent = "Overview";
      tabs.insertBefore(overview, tabs.firstChild);
    } else {
      overview.setAttribute("href", "#/atlas/world");
      overview.textContent = "Overview";
      if (tabs.firstElementChild !== overview) tabs.insertBefore(overview, tabs.firstChild);
    }
    Array.from(tabs.querySelectorAll("a")).forEach(function (a) {
      if (a !== overview && a.textContent.replace(/\s+/g, " ").trim().toLowerCase() === "overview") a.remove();
    });
    overview.classList.toggle("active", hash === "atlas/world");
  }
  document.addEventListener("click", function (e) {
    const a = e.target.closest("a");
    if (!a) return;
    const href = a.getAttribute("href") || "";
    const label = a.textContent.replace(/\s+/g, " ").trim();
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
    const hash = (location.hash || "").replace(/^#\/?/, "");
    if (hash === "atlas") openWorld();
    else requestAnimationFrame(fix);
  });
})();
