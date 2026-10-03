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

  if (!document.getElementById("section-bar-css")) {
    const s = document.createElement("style");
    s.id = "section-bar-css";
    s.textContent =
      ".nav-menu,#drop-float,.nav-drop::after{display:none!important}" +
      "#section-bar{" +
      "display:none;position:fixed;left:0;right:0;z-index:400;" +
      "height:40px;align-items:center;justify-content:center;gap:18px;" +
      "background:#070707;pointer-events:auto}" +
      "#section-bar.show{display:flex}" +
      "#section-bar a{color:#8f8a82;text-decoration:none;padding:8px 12px;" +
      "font-family:Helvetica,Arial,sans-serif;font-size:15px;" +
      "letter-spacing:.16em;text-transform:uppercase;pointer-events:auto;cursor:pointer}" +
      "#section-bar a:hover,#section-bar a.active{color:#f3eee6}" +
      "body.has-section-bar .sheet,body.has-section-bar .lore-rail{" +
      "top:calc(var(--nav-h,56px) + 40px)!important}" +
      "@media (min-width:801px){" +
      ".topbar,.mast .topbar{display:flex!important;align-items:center;position:relative}" +
      ".topbar .filters,.mast .topbar .filters{position:absolute!important;left:50%;transform:translateX(-50%}" +
      ".chapter-tabs,.atlas-tabs,body .subbar{display:none!important}" +
      "}" +
      "@media (max-width:800px){" +
      ".chapter-tabs,.atlas-tabs,body .subbar{display:none!important}" +
      "#section-bar.show{display:flex!important;position:fixed!important;left:0!important;right:0!important;z-index:450!important;background:#070707!important;min-height:36px;height:auto;flex-wrap:wrap}" +
      "body.has-section-bar .sheet,body.has-section-bar .lore-rail,body.has-section-bar .room-body{top:calc(env(safe-area-inset-top) + 128px)!important}" +
      ".topbar .filters{position:static!important;transform:none!important}" +
      "}";
    document.documentElement.appendChild(s);
  }

  let bar = document.getElementById("section-bar");
  if (!bar) {
    bar = document.createElement("nav");
    bar.id = "section-bar";
    document.documentElement.appendChild(bar);
  }

  function path() {
    return (location.hash || "").replace(/^#\/?/, "");
  }

  function itemsFor(h) {
    if (h === "atlas" || h.indexOf("atlas/") === 0) {
      return { list: ATLAS, current: h === "atlas" ? "#/atlas/world" : "#/" + h };
    }
    if (h === "codex" || h.indexOf("codex/") === 0) {
      return { list: CODEX, current: h === "codex" ? "#/codex/calendar" : "#/" + h };
    }
    return null;
  }

  function place() {
    const top = document.querySelector(".mast .topbar") || document.querySelector(".topbar") || document.querySelector(".mast");
    var y = top ? Math.round(top.getBoundingClientRect().bottom) : 56;
    var two = window.matchMedia("(max-width:800px)").matches && document.getElementById("friend-link") && document.getElementById("friend-link").classList.contains("two");
    if (two) y += 32;
    document.documentElement.style.setProperty("--nav-h", y + "px");
    bar.style.top = y + "px";
    var sheet = document.querySelector(".sheet");
    if (sheet && bar.classList.contains("show")) {
      var bottom = Math.round(bar.getBoundingClientRect().bottom);
      sheet.style.setProperty("top", (bottom + 8) + "px", "important");
    }
  }

  function paint() {
    const spec = itemsFor(path());
    place();
    if (!spec) return;
    bar.innerHTML = spec.list.map(function (it) {
      const on = it[1] === spec.current ? " active" : "";
      return '<a href="' + it[1] + '" class="' + on + '">' + it[0] + "</a>";
    }).join("");
    bar.classList.add("show");
    document.body.classList.add("has-section-bar");
  }

  function go(href) {
    if (href.indexOf("#/atlas/") === 0) {
      history.replaceState(null, "", href);
      if (window.renderAtlasWorld) window.renderAtlasWorld(href.replace(/^#\/atlas\/?/, "") || "world");
      paint();
      return;
    }
    if (href.indexOf("#/codex/") === 0) {
      history.replaceState(null, "", href);
      if (window.renderCodex) window.renderCodex(href.replace(/^#\/codex\/?/, "") || "calendar");
      paint();
    }
  }

  document.addEventListener("click", function (e) {
    const a = e.target.closest && e.target.closest("#section-bar a");
    if (!a) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    go(a.getAttribute("href"));
  }, true);

  paint();
  /* setInterval(paint, 80); */
  window.addEventListener("hashchange", paint);
  /* setInterval(function () { if (document.getElementById("section-bar")) paint(); }, 500); */
  window.addEventListener("resize", place);
})();
