(function () {
  function phone() {
    return window.innerWidth <= 980 || window.matchMedia("(hover: none)").matches;
  }

  document.addEventListener("click", function (e) {
    if (!phone()) return;
    document.querySelectorAll(".nav-drop.open").forEach(function (el) {
      el.classList.remove("open");
    });
    const a = e.target.closest(".nav-drop > a, .filters > a, .topbar .filters a");
    if (!a) return;
    const href = a.getAttribute("href") || "";
    const label = a.textContent.replace(/\s+/g, " ").trim();
    if (a.closest(".nav-menu, .chapter-tabs, .atlas-tabs, .subbar")) return;

    if (label === "Atlas" || href === "#/atlas") {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (typeof window.renderAtlasWorld === "function") {
        history.replaceState(null, "", "#/atlas/world");
        window.renderAtlasWorld("world");
      } else {
        location.hash = "#/atlas/world";
      }
      return;
    }
    if (label === "Codex" || href.indexOf("#/codex") === 0) {
      e.preventDefault();
      e.stopImmediatePropagation();
      const to = "#/codex/calendar";
      history.replaceState(null, "", to);
      if (typeof window.renderCodex === "function") window.renderCodex("calendar");
      else location.hash = to;
    }
  }, true);
})();
