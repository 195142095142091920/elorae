(function () {
  var boot = window.__bootHash || location.hash || "";
  function renderBoot() {
    var h = (boot || "").replace(/^#\/?/, "");
    if (h === "atlas" || h.indexOf("atlas/") === 0) {
      var id = h === "atlas" ? "world" : (h.slice(6) || "world");
      if (id === "map" || id === "eras") id = "world";
      var next = "#/atlas/" + id;
      if (location.hash !== next) history.replaceState(null, "", location.pathname + next);
      if (window.renderAtlasWorld) window.renderAtlasWorld(id);
      return;
    }
    if (h === "codex" || h.indexOf("codex/") === 0) {
      var cid = h === "codex" ? "calendar" : (h.slice(6) || "calendar");
      var cnext = "#/codex/" + cid;
      if (location.hash !== cnext) history.replaceState(null, "", location.pathname + cnext);
      if (window.renderCodex) window.renderCodex(cid);
    }
  }
  if (boot.indexOf("#/atlas") === 0 || boot.indexOf("#/codex") === 0) {
    var n = 0;
    var timer = setInterval(function () {
      n += 1;
      if ((location.hash || "").indexOf(boot.indexOf("#/atlas") === 0 ? "#/atlas" : "#/codex") !== 0 || n < 8) renderBoot();
      if (n > 12) clearInterval(timer);
    }, 100);
  }
})();
