(function () {
  const ATLAS = [["Overview","#/atlas/world"],["Cosm","#/atlas/cosm"],["Essen Revir","#/atlas/essen-revir"],["Far Nybei","#/atlas/far-nybei"],["Hesk","#/atlas/hesk"]];
  const CODEX = [["Calendar","#/codex/calendar"],["Lore","#/codex/lore"],["Magics","#/codex/magics"],["Souls","#/codex/souls"]];

  if (!document.getElementById("nav-boot-css")) {
    const s = document.createElement("style");
    s.id = "nav-boot-css";
    s.textContent =
      ".nav-menu,#drop-float,.nav-drop::after{display:none!important;pointer-events:none!important}" +
      ".nav-drop{display:inline!important}" +
      "@media (min-width:801px){" +
      ".topbar,.mast .topbar{display:flex!important;align-items:center;position:relative}" +
      ".topbar .filters,.mast .topbar .filters{position:absolute!important;left:50%!important;transform:translateX(-50%)!important}" +
      ".chapter-tabs,.atlas-tabs,.subbar{display:none!important}" +
      "}" +
      "#section-bar{display:none;position:fixed;left:0;right:0;z-index:500;height:40px;align-items:center;justify-content:center;gap:18px;background:#070707}" +
      "#section-bar.show{display:flex}" +
      "#section-bar a{color:#8f8a82;text-decoration:none;padding:8px 12px;font-family:Helvetica,Arial,sans-serif;font-size:15px;letter-spacing:.16em;text-transform:uppercase}" +
      "#section-bar a.active,#section-bar a:hover{color:#f3eee6}" +
      "body.has-section-bar .sheet,body.has-section-bar .lore-rail{top:calc(var(--nav-h,56px) + 40px)!important}";
    document.documentElement.appendChild(s);
  }

  let bar = document.getElementById("section-bar");
  if (!bar) {
    bar = document.createElement("nav");
    bar.id = "section-bar";
    document.documentElement.appendChild(bar);
  }

  function path() { return (location.hash || "").replace(/^#\/?/, ""); }

  function killMenus() {
    document.querySelectorAll(".nav-menu, #drop-float").forEach(function (el) { el.remove(); });
  }

  function paint() {
    killMenus();
    const h = path();
    const top = document.querySelector(".mast .topbar") || document.querySelector(".topbar");
    if (top) {
      const y = Math.round(top.getBoundingClientRect().bottom);
      document.documentElement.style.setProperty("--nav-h", y + "px");
      bar.style.top = y + "px";
    }
    let list = null, current = "";
    if (h === "atlas" || h.indexOf("atlas/") === 0) {
      list = ATLAS; current = "#/atlas/" + (h === "atlas" ? "world" : h.slice(6));
    } else if (h === "codex" || h.indexOf("codex/") === 0) {
      list = CODEX; current = "#/codex/" + (h === "codex" ? "calendar" : h.slice(6));
    }
    if (!list) {
      bar.classList.remove("show");
      bar.innerHTML = "";
      document.body.classList.remove("has-section-bar");
      return;
    }
    bar.innerHTML = list.map(function (it) {
      return '<a href="' + it[1] + '" class="' + (it[1] === current ? "active" : "") + '">' + it[0] + "</a>";
    }).join("");
    bar.classList.add("show");
    document.body.classList.add("has-section-bar");
  }

  function go(href) {
    killMenus();
    if (location.hash !== href) location.hash = href;
    if (href.indexOf("#/atlas") === 0 && window.renderAtlasWorld) {
      window.renderAtlasWorld(href.replace(/^#\/atlas\/?/, "") || "world");
    } else if (href.indexOf("#/codex") === 0 && window.renderCodex) {
      window.renderCodex(href.replace(/^#\/codex\/?/, "") || "calendar");
    } else if (href.indexOf("#/journal") === 0 && window.renderJournalEntry) {
      const id = href.replace(/^#\/journal\/?/, "") || (window.JOURNAL && window.JOURNAL[0] && window.JOURNAL[0].id);
      window.renderJournalEntry(id);
    } else if (href === "#/index") {
      if (window.renderIndex) window.renderIndex();
      else if (window.route) window.route();
    } else if (href === "#/gallery" && window.route) {
      window.route();
    }
    paint();
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
    if (a.closest("#section-bar, .chapter-tabs, .atlas-tabs, .subbar")) return;
    const label = a.textContent.replace(/\s+/g, " ").trim();
    const map = { Atlas: "#/atlas/world", Codex: "#/codex/calendar", Gallery: "#/gallery", Index: "#/index", Journal: "#/journal" };
    if (!map[label]) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    go(map[label]);
  }, true);

  paint();
  setInterval(paint, 300);
  window.addEventListener("hashchange", function () {
    const h = path();
    if (h === "index" && window.renderIndex) window.renderIndex();
    paint();
  });
})();
