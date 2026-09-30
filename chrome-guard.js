(function () {
  if (!document.getElementById("nav-grid-fix")) {
    const s = document.createElement("style");
    s.id = "nav-grid-fix";
    s.textContent =
      "@media (min-width:801px){" +
      ".topbar,.mast .topbar{" +
      "display:flex!important;align-items:center;justify-content:flex-start;" +
      "position:relative;padding-left:28px;padding-right:28px}" +
      ".topbar > a:first-child,.mast .topbar > a:first-child{position:relative;z-index:2}" +
      ".topbar .filters,.mast .topbar .filters{" +
      "position:absolute!important;left:50%!important;right:auto!important;" +
      "transform:translateX(-50%)!important;justify-self:center!important;" +
      "grid-column:auto!important}" +
      ".chapter-tabs,.atlas-tabs,body:has(.mast) .subbar{" +
      "position:fixed!important;top:var(--nav-h,56px)!important;left:0;right:0;" +
      "display:flex!important;justify-content:center;align-items:center;flex-wrap:wrap;" +
      "gap:18px;min-height:40px;padding:0 28px!important;" +
      "background:#070707!important;z-index:190}" +
      ".journal-page:has(.chapter-tabs) .sheet," +
      ".atlas-page:has(.atlas-tabs) .atlas-stage," +
      ".journal-page:has(.chapter-tabs) .lore-rail," +
      "body.room:has(.chapter-tabs) .sheet{top:calc(var(--nav-h,56px) + 40px)!important}" +
      "}" +
      "@media (max-width:800px){" +
      ".topbar .filters{position:static!important;transform:none!important}" +
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
      document.querySelectorAll(".chapter-tabs, .atlas-tabs").forEach(function (el) {
        if (h.indexOf("journal") === 0) return;
        el.remove();
      });
      return;
    }

    let tabs = document.querySelector(".chapter-tabs");
    if (!tabs) {
      tabs = document.createElement("nav");
      tabs.className = "chapter-tabs";
    }
    if (tabs.parentElement === bar) bar.insertAdjacentElement("afterend", tabs);
    else if (!tabs.parentElement) bar.insertAdjacentElement("afterend", tabs);
    else if (tabs.previousElementSibling !== bar && bar.parentElement) {
      bar.insertAdjacentElement("afterend", tabs);
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
