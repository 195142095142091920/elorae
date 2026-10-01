(function () {
  var busy = false;
  var style = document.createElement("style");
  style.textContent = "html.hold-col .sheet,html.hold-col .atlas-stage,html.hold-col .room-body{top:96px!important}";
  document.documentElement.appendChild(style);
  function hold() {
    var h = location.hash || "";
    var on = h.indexOf("#/atlas") === 0 || h.indexOf("#/codex") === 0;
    document.documentElement.classList.toggle("hold-col", on);
  }
  hold();
  function abs(href) { return location.pathname + href; }
  function setHash(href) {
    if (location.hash === href) return;
    history.replaceState(null, "", abs(href));
  }
  function run(href) {
    setHash(href);
    hold();
    if (href.indexOf("#/atlas") === 0 && window.renderAtlasWorld) {
      window.renderAtlasWorld(href.replace(/^#\/atlas\/?/, "") || "world");
      return true;
    }
    if (href.indexOf("#/codex") === 0 && window.renderCodex) {
      window.renderCodex(href.replace(/^#\/codex\/?/, "") || "calendar");
      return true;
    }
    if (href.indexOf("#/journal") === 0 && window.renderJournalEntry) {
      var id = href.replace(/^#\/journal\/?/, "") || (window.JOURNAL && window.JOURNAL[0] && window.JOURNAL[0].id);
      window.renderJournalEntry(id);
      return true;
    }
    if (href === "#/index") {
      if (window.renderIndex) { window.renderIndex(); return true; }
      if (window.route) { window.route(); return true; }
    }
    if (href === "#/gallery" && window.route) { window.route(); return true; }
    return false;
  }
  document.addEventListener("click", function (e) {
    var sec = e.target.closest && e.target.closest("#section-bar a");
    var a = sec || (e.target.closest && e.target.closest("a"));
    if (!a) return;
    var href = "";
    if (sec) href = sec.getAttribute("href") || "";
    else if (a.closest(".filters, .topbar, .mast") && !a.closest(".chapter-tabs, .atlas-tabs, .subbar")) {
      var label = a.textContent.replace(/\s+/g, " ").trim();
      var map = { Atlas: "#/atlas/world", Codex: "#/codex/calendar", Gallery: "#/gallery", Index: "#/index", Journal: "#/journal" };
      href = map[label] || "";
    }
    if (!href || href.charAt(0) !== "#") return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (busy) return;
    busy = true;
    hold();
    if (!run(href)) {
      var tries = 0;
      var timer = setInterval(function () {
        tries += 1;
        if (run(href) || tries > 40) { clearInterval(timer); busy = false; }
      }, 50);
      return;
    }
    busy = false;
  }, true);
  window.addEventListener("hashchange", hold);
})();
