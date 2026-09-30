(function () {
  if (!document.getElementById("nav-grid-fix")) {
    const s = document.createElement("style");
    s.id = "nav-grid-fix";
    s.textContent =
      "@media (min-width:801px){" +
      ".topbar,.mast .topbar{" +
      "display:grid!important;" +
      "grid-template-columns:minmax(0,1fr) auto minmax(0,1fr)!important;" +
      "align-items:center;gap:16px;padding-left:28px;padding-right:28px}" +
      ".topbar > a:first-child,.mast .topbar > a:first-child{" +
      "grid-column:1!important;justify-self:start;min-width:0}" +
      ".topbar .chapter-tabs,.topbar .atlas-tabs,.topbar .subbar{" +
      "grid-column:2!important;justify-self:center;max-width:100%;" +
      "white-space:nowrap}" +
      ".topbar .filters,.mast .topbar .filters{" +
      "grid-column:3!important;justify-self:end!important;min-width:0}" +
      "}";
    document.head.appendChild(s);
  }

  const ATLAS = [
    ["Overview", "#/atlas/world"],
    ["Cosm", "#/atlas/cosm"],
    ["Essen Revir", "#/atlas/essen-revir"],
    ["Far Nybei", "#/atlas/far-nybei"],
    ["Hesk", "#/atlas/hesk"]
  ];
  const CODEX = [
    ["Calendar", "#/codex/calendar"],
    ["Lore", "#/codex/lore"],
    ["Magics", "#/codex/magics"],
    ["Souls", "#/codex/souls"]
  ];

  function path() {
    return (location.hash || "").replace(/^#\/?/, "");
  }

  function paint() {
    if (window.innerWidth <= 800) return;
    const h = path();
    const bar = document.querySelector(".mast .topbar") || document.querySelector(".topbar");
    if (!bar) return;

    let items = null;
    let current = "";
    if (h === "atlas" || h.indexOf("atlas/") === 0) {
      items = ATLAS;
      current = h === "atlas" ? "#/atlas/world" : "#/" + h;
    } else if (h === "codex" || h.indexOf("codex/") === 0) {
      items = CODEX;
      current = h === "codex" ? "#/codex/calendar" : "#/" + h;
    }

    if (!items) {
      bar.querySelectorAll(":scope > .chapter-tabs, :scope > .atlas-tabs, :scope > .subbar").forEach(function (el) {
        el.remove();
      });
      return;
    }

    let tabs = bar.querySelector(":scope > .chapter-tabs");
    if (!tabs) {
      tabs = document.createElement("nav");
      tabs.className = "chapter-tabs";
      const filters = bar.querySelector(".filters");
      if (filters) bar.insertBefore(tabs, filters);
      else bar.appendChild(tabs);
    }
    const html = items.map(function (it) {
      const on = it[1] === current ? " active" : "";
      return '<a class="' + on + '" href="' + it[1] + '">' + it[0] + "</a>";
    }).join("");
    if (tabs.innerHTML !== html) tabs.innerHTML = html;
  }

  paint();
  setInterval(paint, 50);
  window.addEventListener("hashchange", paint);
})();
