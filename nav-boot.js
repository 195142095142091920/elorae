(function () {
  const ATLAS = [["Overview","#/atlas/world"],["Cosm","#/atlas/cosm"],["Essen Revir","#/atlas/essen-revir"],["Far Nybei","#/atlas/far-nybei"],["Hesk","#/atlas/hesk"]];
  const CODEX = [["Calendar","#/codex/calendar"],["Lore","#/codex/lore"],["Magics","#/codex/magics"],["Souls","#/codex/souls"]];

  if (!document.getElementById("nav-boot-css")) {
    const s = document.createElement("style");
    s.id = "nav-boot-css";
    s.textContent =
      "@media (min-width:801px){" +
      ".topbar,.mast .topbar{display:flex!important;align-items:center;position:relative}" +
      ".topbar .filters,.mast .topbar .filters{position:absolute!important;left:50%!important;transform:translateX(-50%)!important}" +
      ".chapter-tabs,.atlas-tabs,.subbar{display:none!important}" +
      "}" +
      "#section-bar{display:none;position:fixed;left:0;right:0;z-index:400;height:40px;align-items:center;justify-content:center;gap:18px;background:#070707}" +
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

  function paint() {
    const h = path();
    const top = document.querySelector(".mast .topbar") || document.querySelector(".topbar");
    if (top) {
      const y = Math.round(top.getBoundingClientRect().bottom);
      document.documentElement.style.setProperty("--nav-h", y + "px");
      bar.style.top = y + "px";
    }
    let list = null, current = "";
    if (h === "atlas" || h.indexOf("atlas/") === 0) {
      list = ATLAS; current = h === "atlas" ? "#/atlas/world" : "#/" + h;
    } else if (h === "codex" || h.indexOf("codex/") === 0) {
      list = CODEX; current = h === "codex" ? "#/codex/calendar" : "#/" + h;
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
    if (href.indexOf("#/atlas") === 0) {
      const id = href.replace(/^#\/atlas\/?/, "") || "world";
      history.replaceState(null, "", "#/atlas/" + id);
      if (window.renderAtlasWorld) window.renderAtlasWorld(id);
      paint();
      return;
    }
    if (href.indexOf("#/codex") === 0) {
      const id = href.replace(/^#\/codex\/?/, "") || "calendar";
      history.replaceState(null, "", "#/codex/" + id);
      if (window.renderCodex) window.renderCodex(id);
      paint();
      return;
    }
    if (href.indexOf("#/journal") === 0) {
      const id = href.replace(/^#\/journal\/?/, "");
      history.replaceState(null, "", id ? "#/journal/" + id : "#/journal");
      if (window.renderJournalEntry) window.renderJournalEntry(id || (window.JOURNAL && window.JOURNAL[0] && window.JOURNAL[0].id));
      paint();
      return;
    }
    location.hash = href;
  }

  document.addEventListener("click", function (e) {
    const sec = e.target.closest && e.target.closest("#section-bar a");
    if (sec) {
      e.preventDefault();
      e.stopImmediatePropagation();
      go(sec.getAttribute("href"));
      return;
    }
    const a = e.target.closest && e.target.closest(".filters a, .topbar a");
    if (!a) return;
    const label = a.textContent.replace(/\s+/g, " ").trim();
    if (a.closest("#section-bar, .nav-menu, .chapter-tabs")) return;
    if (label === "Atlas") { e.preventDefault(); e.stopImmediatePropagation(); go("#/atlas/world"); }
    else if (label === "Codex") { e.preventDefault(); e.stopImmediatePropagation(); go("#/codex/calendar"); }
    else if (label === "Journal") { e.preventDefault(); e.stopImmediatePropagation(); go("#/journal"); }
    else if (label === "Index") { e.preventDefault(); e.stopImmediatePropagation(); go("#/index"); }
    else if (label === "Gallery") { e.preventDefault(); e.stopImmediatePropagation(); go("#/gallery"); }
  }, true);

  paint();
  setInterval(paint, 200);
  window.addEventListener("hashchange", paint);
  if (window.__renderBoot) setTimeout(window.__renderBoot, 50);
})();
