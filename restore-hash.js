(function () {
  let booted = false;
  function pathOf(raw) {
    return String(raw || "").replace(/^#\/?/, "");
  }
  function openKept() {
    const raw = window.__keepHash || location.hash || "";
    const h = pathOf(raw);
    if (h === "atlas" || h.indexOf("atlas/") === 0) {
      const id = h === "atlas" ? "world" : (h.replace(/^atlas\/?/, "") || "world");
      const dest = "#/atlas/" + (id === "eras" || id === "map" ? "world" : id);
      try { history.replaceState(null, "", dest); } catch (e) {}
      if (typeof window.renderAtlasWorld === "function") window.renderAtlasWorld(id === "eras" || id === "map" ? "world" : id);
      return true;
    }
    if (h === "codex" || h.indexOf("codex/") === 0) {
      const id = h === "codex" ? "calendar" : (h.replace(/^codex\/?/, "") || "calendar");
      try { history.replaceState(null, "", "#/codex/" + id); } catch (e) {}
      if (typeof window.renderCodex === "function") window.renderCodex(id);
      return true;
    }
    return false;
  }
  function followHash() {
    const h = pathOf(location.hash);
    if (h === "atlas" || h.indexOf("atlas/") === 0) {
      const id = h === "atlas" ? "world" : (h.replace(/^atlas\/?/, "") || "world");
      if (typeof window.renderAtlasWorld === "function") window.renderAtlasWorld(id === "eras" || id === "map" ? "world" : id);
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
    if (!booted && openKept()) {
      booted = true;
      window.__lockNav = false;
      return;
    }
    if (followHash()) return;
    if (typeof prev === "function") prev();
  };
  window.addEventListener("hashchange", function () {
    followHash();
  });
  openKept();
  booted = true;
  setTimeout(function () { window.__lockNav = false; }, 80);
  setTimeout(function () { window.__lockNav = false; }, 420);
})();
