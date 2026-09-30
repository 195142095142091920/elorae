(function () {
  function path() {
    return (location.hash || "").replace(/^#\/?/, "");
  }
  function restore() {
    const h = path();
    if (h === "atlas" || h.indexOf("atlas/") === 0) {
      const id = h === "atlas" ? "world" : (h.replace(/^atlas\/?/, "") || "world");
      if (typeof window.renderAtlasWorld === "function") window.renderAtlasWorld(id);
      return true;
    }
    if (h === "codex" || h.indexOf("codex/") === 0) {
      const id = h === "codex" ? "calendar" : (h.replace(/^codex\/?/, "") || "calendar");
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
  window.addEventListener("hashchange", restore);
  restore();
  setTimeout(restore, 0);
  setTimeout(restore, 80);
})();
