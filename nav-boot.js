(function () {
  var ATLAS = [["Overview","#/atlas/world"],["Cosm","#/atlas/cosm"],["Essen Revir","#/atlas/essen-revir"],["Far Nybei","#/atlas/far-nybei"],["Hesk","#/atlas/hesk"]];
  var CODEX = [["Calendar","#/codex/calendar"],["Lore","#/codex/lore"],["Magics","#/codex/magics"],["Souls","#/codex/souls"]];
  if (!document.getElementById("nav-boot-css")) {
    var s = document.createElement("style");
    s.id = "nav-boot-css";
    s.textContent = ".subbar{display:none!important}.nav-menu,#drop-float,.nav-drop::after,.nav-drop:hover .nav-menu,.nav-drop.open .nav-menu,.nav-drop:active .nav-menu,.nav-drop:focus .nav-menu,.nav-drop:focus-within .nav-menu{display:none!important;visibility:hidden!important;pointer-events:none!important}.nav-drop{display:inline!important}.mast,.topbar{min-height:56px}#section-bar{display:none;position:fixed;left:0;right:0;z-index:500;height:40px;align-items:center;justify-content:center;gap:18px;background:#070707}#section-bar.show{display:flex}#section-bar a{color:#8f8a82;text-decoration:none;padding:8px 12px;font-family:Helvetica,Arial,sans-serif;font-size:12px;letter-spacing:.12em;text-transform:uppercase}#section-bar a.active,#section-bar a:hover{color:#f3eee6}@media (min-width:801px){.topbar,.mast .topbar{display:flex!important;align-items:center;position:relative}.chapter-tabs,.atlas-tabs,.subbar{display:none!important}.nav-drop:hover .nav-menu,.nav-drop.open .nav-menu,.nav-drop:active .nav-menu{display:none!important}body.atlas-page .sheet,body.atlas-page .atlas-stage,body.atlas-page .room-body,body.journal-page .sheet,body.journal-page .room-body,body.lore-page .sheet,body.lore-page .lore-rail{top:102px!important}}@media (max-width:800px){.chapter-tabs,.atlas-tabs,.subbar{display:none!important}#section-bar.show{display:flex!important;position:fixed!important;left:0!important;right:0!important;z-index:450!important;background:#070707!important;height:36px!important;min-height:36px!important;max-height:36px!important;overflow:hidden!important;flex-wrap:nowrap!important;gap:8px!important;padding:0 6px!important}#section-bar a{font-size:10px!important;letter-spacing:.06em!important;padding:8px 4px!important;white-space:nowrap!important}body.has-section-bar .sheet,body.atlas-page .sheet,body.atlas-page .room-body,body.lore-page .sheet,body.codex-page .sheet{top:calc(env(safe-area-inset-top) + 132px)!important}";
    document.documentElement.appendChild(s);
  }
  var orig = CSSStyleDeclaration.prototype.setProperty;
  CSSStyleDeclaration.prototype.setProperty = function (name, value, priority) {
    if (name === "top" && document.body && document.body.classList.contains("lore-page") && window.innerWidth > 980) {
      var nodes = document.querySelectorAll(".sheet, .lore-rail");
      for (var i = 0; i < nodes.length; i++) {
        if (nodes[i].style === this) { value = "102px"; break; }
      }
    }
    return orig.call(this, name, value, priority);
  };
  document.addEventListener("pointerdown", function () {
    document.querySelectorAll(".nav-drop.open").forEach(function (el) { el.classList.remove("open"); });
    document.querySelectorAll(".nav-menu,#drop-float").forEach(function (el) { el.style.display = "none"; });
  }, true);
  var bar = document.getElementById("section-bar");
  if (!bar) { bar = document.createElement("nav"); bar.id = "section-bar"; document.documentElement.appendChild(bar); }
  function paint() {
    document.querySelectorAll(".nav-menu,#drop-float").forEach(function (el) { el.remove(); });
    document.querySelectorAll(".subbar").forEach(function (el) { el.style.display = "none"; });
    document.querySelectorAll(".nav-drop.open").forEach(function (el) { el.classList.remove("open"); });
    var h = (location.hash || "").replace(/^#\/?/, "");
    var atlas = h === "atlas" || h.indexOf("atlas/") === 0 || document.body.classList.contains("atlas-page");
    var codex = h === "codex" || h.indexOf("codex/") === 0 || document.body.classList.contains("codex-page");
    if (document.body.classList.contains("room") || document.body.classList.contains("journal-page")) { atlas = false; codex = false; }
    var top = document.querySelector(".mast .topbar") || document.querySelector(".topbar");
    var phone = window.matchMedia("(max-width:800px)").matches;
    var y = phone ? "calc(env(safe-area-inset-top) + 78px)" : ((top ? Math.round(top.getBoundingClientRect().bottom) : 56) + "px");
    bar.style.top = y;
    document.body.classList.toggle("has-section-bar", atlas || codex);
    var list = null, current = "";
    if (atlas) { list = ATLAS; current = "#/atlas/" + (h.indexOf("atlas/") === 0 ? h.slice(6) : "world"); }
    else if (codex) { list = CODEX; current = "#/codex/" + (h.indexOf("codex/") === 0 ? h.slice(6) : "calendar"); }
    if (!list) {
      /* clear when the page is not Atlas or Codex */
      bar.classList.remove("show");
      bar.innerHTML = "";
      bar.style.removeProperty("display");
      return;
    }
    var html = list.map(function (it) { return '<a href="' + it[1] + '" class="' + (it[1] === current ? "active" : "") + '">' + it[0] + "</a>"; }).join("");
    if (bar.innerHTML !== html) bar.innerHTML = html;
    bar.classList.add("show");
    bar.style.setProperty("display", "flex", "important");
    bar.style.setProperty("visibility", "visible", "important");
  }
  paint();
  setInterval(paint, 400);
  window.addEventListener("hashchange", paint);
})();
