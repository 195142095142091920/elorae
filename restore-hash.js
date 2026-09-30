(function () {
  function pathOf(raw) {
    return String(raw || location.hash || "").replace(/^#\/?/, "");
  }
  function restore() {
    const h = pathOf(window.__keepHash && /^(#\/)?(atlas|codex)/i.test(window.__keepHash) ? window.__keepHash : location.hash);
    if (h === "atlas" || h.indexOf("atlas/") === 0) {
      const id = h === "atlas" ? "world" : (h.replace(/^atlas\/?/, "") || "world");
      if (location.hash !== "#/atlas/" + id) {
        try { history.replaceState(null, "", "#/atlas/" + id); } catch (e) {}
      }
      if (typeof window.renderAtlasWorld === "function") window.renderAtlasWorld(id);
      return true;
    }
    if (h === "codex" || h.indexOf("codex/") === 0) {
      const id = h === "codex" ? "calendar" : (h.replace(/^codex\/?/, "") || "calendar");
      if (location.hash !== "#/codex/" + id) {
        try { history.replaceState(null, "", "#/codex/" + id); } catch (e) {}
      }
      if (typeof window.renderCodex === "function") window.renderCodex(id);
      return true;
    }
    return false;
  }
  const prev = window.route;
  window.route = function () {
    if (restore()) return;
    if (typeof prev === "function") prev();
  };
  window.addEventListener("hashchange", function () {
    restore();
  });
  restore();
  setTimeout(restore, 0);
  setTimeout(restore, 30);
  setTimeout(restore, 120);
})();
