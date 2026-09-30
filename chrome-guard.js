(function () {
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

    document.querySelectorAll(".chapter-tabs, .atlas-tabs, .subbar").forEach(function (el) {
      if (!items && el.parentElement === bar) el.remove();
    });
    if (!items) return;

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
