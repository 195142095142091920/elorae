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
      ".nav-drop{display:inline!important}" +
      "#section-bar{" +
      "display:none;position:fixed;left:0;right:0;top:var(--nav-h,56px);z-index:189;" +
      "height:40px;align-items:center;justify-content:center;gap:18px;flex-wrap:wrap;" +
      "background:#070707;font-family:Helvetica,Arial,sans-serif;" +
      "font-size:15px;letter-spacing:.16em;text-transform:uppercase}" +
      "#section-bar.show{display:flex}" +
      "#section-bar a{color:#8f8a82;text-decoration:none;padding:0 10px}" +
      "#section-bar a:hover,#section-bar a.active{color:#f3eee6}" +
      "body.has-section-bar .sheet,body.has-section-bar .lore-rail{" +
      "top:calc(var(--nav-h,56px) + 40px)!important}" +
      "@media (min-width:801px){" +
      ".topbar,.mast .topbar{display:flex!important;align-items:center;position:relative}" +
      ".topbar .filters,.mast .topbar .filters{" +
      "position:absolute!important;left:50%;transform:translateX(-50%)}" +
      ".chapter-tabs,.atlas-tabs,body .subbar{display:none!important}" +
      "}" +
      "@media (max-width:800px){" +
      "#section-bar{top:var(--nav-h,44px);height:36px;font-size:11px;letter-spacing:.1em;gap:12px}" +
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

  function paint() {
    const spec = itemsFor(path());
    if (!spec) {
      bar.classList.remove("show");
      bar.innerHTML = "";
      document.body.classList.remove("has-section-bar");
      return;
    }
    bar.innerHTML = spec.list.map(function (it) {
      const on = it[1] === spec.current ? " active" : "";
      return '<a class="' + on + '" href="' + it[1] + '">' + it[0] + "</a>";
    }).join("");
    bar.classList.add("show");
    document.body.classList.add("has-section-bar");
    const top = document.querySelector(".mast .topbar, .topbar, .mast");
    if (top) {
      document.documentElement.style.setProperty("--nav-h", Math.round(top.getBoundingClientRect().bottom) + "px");
    }
  }

  bar.addEventListener("click", function (e) {
    const a = e.target.closest("a");
    if (!a) return;
    e.preventDefault();
    const href = a.getAttribute("href") || "";
    if (href.indexOf("#/atlas/") === 0 && window.renderAtlasWorld) {
      history.replaceState(null, "", href);
      window.renderAtlasWorld(href.replace(/^#\/atlas\/?/, "") || "world");
    } else if (href.indexOf("#/codex/") === 0 && window.renderCodex) {
      history.replaceState(null, "", href);
      window.renderCodex(href.replace(/^#\/codex\/?/, "") || "calendar");
    } else {
      location.hash = href;
    }
    paint();
  });

  paint();
  setInterval(paint, 80);
  window.addEventListener("hashchange", paint);
})();
