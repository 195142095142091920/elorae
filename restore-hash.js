(function () {
  const boot = (location.hash || "").replace(/^#\/?/, "");
  window.__bootHash = boot;
  function renderBoot() {
    const h = (location.hash || "").replace(/^#\/?/, "") || boot;
    if (h === "atlas" || h.indexOf("atlas/") === 0) {
      const id = h === "atlas" ? "world" : (h.slice(6) || "world");
      if (location.hash !== "#/atlas/" + id) history.replaceState(null, "", "#/atlas/" + id);
      if (window.renderAtlasWorld) window.renderAtlasWorld(id === "map" || id === "eras" ? "world" : id);
      return;
    }
    if (h === "codex" || h.indexOf("codex/") === 0) {
      const id = h === "codex" ? "calendar" : (h.slice(6) || "calendar");
      if (location.hash !== "#/codex/" + id) history.replaceState(null, "", "#/codex/" + id);
      if (window.renderCodex) window.renderCodex(id);
      return;
    }
    if (h === "journal" || h.indexOf("journal/") === 0) {
      const id = h.indexOf("journal/") === 0 ? h.slice(8) : ((window.JOURNAL && window.JOURNAL[0] && window.JOURNAL[0].id) || "");
      if (id && window.renderJournalEntry) window.renderJournalEntry(id);
      return;
    }
    if (h === "index" && typeof window.route === "function") window.route();
  }
  window.__renderBoot = renderBoot;
  setTimeout(renderBoot, 0);
  setTimeout(renderBoot, 80);
  setTimeout(renderBoot, 400);
})();
