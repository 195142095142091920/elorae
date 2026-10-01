(function () {
  window.__keepHash = location.hash || "";
  const queue = [];

  function path() { return (location.hash || "").replace(/^#\/?/, ""); }

  function ready(href) {
    if (href.indexOf("#/atlas") === 0) return typeof window.renderAtlasWorld === "function";
    if (href.indexOf("#/codex") === 0) return typeof window.renderCodex === "function";
    if (href.indexOf("#/journal") === 0) return typeof window.renderJournalEntry === "function";
    return typeof window.route === "function" || typeof window.renderIndex === "function";
  }

  function run(href) {
    if (location.hash !== href) location.hash = href;
    if (href.indexOf("#/atlas") === 0 && window.renderAtlasWorld) {
      window.renderAtlasWorld(href.replace(/^#\/atlas\/?/, "") || "world");
      return true;
    }
    if (href.indexOf("#/codex") === 0 && window.renderCodex) {
      window.renderCodex(href.replace(/^#\/codex\/?/, "") || "calendar");
      return true;
    }
    if (href.indexOf("#/journal") === 0 && window.renderJournalEntry) {
      const id = href.replace(/^#\/journal\/?/, "") || (window.JOURNAL && window.JOURNAL[0] && window.JOURNAL[0].id);
      window.renderJournalEntry(id);
      return true;
    }
    if (href === "#/index" && window.renderIndex) { window.renderIndex(); return true; }
    if (window.route) { window.route(); return true; }
    return false;
  }

  function go(href) {
    if (!ready(href) || !run(href)) queue.push(href);
  }

  document.addEventListener("click", function (e) {
    const sec = e.target.closest && e.target.closest("#section-bar a");
    if (sec) {
      e.preventDefault();
      e.stopImmediatePropagation();
      go(sec.getAttribute("href"));
      return;
    }
    const a = e.target.closest && e.target.closest("a");
    if (!a || !a.closest(".filters, .topbar, .mast")) return;
    if (a.closest(".chapter-tabs, .atlas-tabs, .subbar")) return;
    const label = a.textContent.replace(/\s+/g, " ").trim();
    const map = { Atlas: "#/atlas/world", Codex: "#/codex/calendar", Gallery: "#/gallery", Index: "#/index", Journal: "#/journal" };
    if (!map[label]) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    go(map[label]);
  }, true);

  setInterval(function () {
    if (!queue.length) return;
    const href = queue[queue.length - 1];
    queue.length = 0;
    if (!run(href)) queue.push(href);
  }, 50);
})();
