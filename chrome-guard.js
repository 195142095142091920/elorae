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
    const h = path();
    const bar = document.querySelector(".topbar, .mast .topbar");
    if (!bar || window.innerWidth <= 800) return;

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
      const extra = document.querySelector(".chapter-tabs, .atlas-tabs, .subbar");
      if (extra && extra.parentElement === bar) extra.remove();
      return;
    }

    let tabs = bar.querySelector(".chapter-tabs") || document.querySelector(".chapter-tabs, .atlas-tabs, .subbar");
    if (!tabs) {
      tabs = document.createElement("nav");
      tabs.className = "chapter-tabs";
    }
    tabs.className = "chapter-tabs";
    const html = items.map(function (it) {
      const on = it[1] === current ? " active" : "";
      return '<a class="' + on + '" href="' + it[1] + '">' + it[0] + "</a>";
    }).join("");
    if (tabs.innerHTML !== html) tabs.innerHTML = html;

    const filters = bar.querySelector(".filters");
    if (tabs.parentElement !== bar) {
      if (filters) bar.insertBefore(tabs, filters);
      else bar.appendChild(tabs);
    } else if (filters && tabs.nextElementSibling !== filters) {
      bar.insertBefore(tabs, filters);
    }
  }

  paint();
  setInterval(paint, 80);
  window.addEventListener("hashchange", paint);
})();
