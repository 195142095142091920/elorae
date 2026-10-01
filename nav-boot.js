(function () {
  var ATLAS = [["Overview","#/atlas/world"],["Cosm","#/atlas/cosm"],["Essen Revir","#/atlas/essen-revir"],["Far Nybei","#/atlas/far-nybei"],["Hesk","#/atlas/hesk"]];
  var CODEX = [["Calendar","#/codex/calendar"],["Lore","#/codex/lore"],["Magics","#/codex/magics"],["Souls","#/codex/souls"]];
  if (!document.getElementById("nav-boot-css")) {
    var s = document.createElement("style");
    s.id = "nav-boot-css";
    s.textContent = ".nav-menu,#drop-float,.nav-drop::after,.nav-drop:hover .nav-menu,.nav-drop.open .nav-menu,.nav-drop:active .nav-menu,.nav-drop:focus .nav-menu,.nav-drop:focus-within .nav-menu{display:none!important;visibility:hidden!important;pointer-events:none!important}.nav-drop{display:inline!important}.mast,.topbar{min-height:56px}#section-bar{display:none;position:fixed;left:0;right:0;z-index:500;height:40px;align-items:center;justify-content:center;gap:18px;background:#070707}#section-bar.show{display:flex}#section-bar a{color:#8f8a82;text-decoration:none;padding:8px 12px;font-family:Helvetica,Arial,sans-serif;font-size:15px;letter-spacing:.16em;text-transform:uppercase}#section-bar a.active,#section-bar a:hover{color:#f3eee6}@media (min-width:801px){.topbar,.mast .topbar{display:flex!important;align-items:center;position:relative}.topbar .filters,.mast .topbar .filters{position:absolute!important;left:50%!important;transform:translateX(-50%)!important;font-size:16px!important}.chapter-tabs,.atlas-tabs,.subbar{display:none!important}.nav-drop:hover .nav-menu,.nav-drop.open .nav-menu,.nav-drop:active .nav-menu{display:none!important}body.atlas-page .sheet,body.atlas-page .atlas-stage,body.atlas-page .room-body,body.journal-page .sheet,body.journal-page .room-body,body.lore-page .sheet,body.lore-page .lore-rail{top:102px!important}body.lore-page .lore-rail{padding-top:28px!important}body.lore-page .journal-read{padding-top:28px!important}}";
    document.documentElement.appendChild(s);
  }
  function lockLore() {
    if (window.innerWidth <= 980 || !document.body.classList.contains("lore-page")) return;
    document.querySelectorAll(".sheet, .lore-rail").forEach(function (el) {
      el.style.setProperty("top", "102px", "important");
    });
  }
  document.addEventListener("pointerdown", function () {
    document.querySelectorAll(".nav-drop.open").forEach(function (el) { el.classList.remove("open"); });
    document.querySelectorAll(".nav-menu,#drop-float").forEach(function (el) { el.style.display = "none"; });
  }, true);
  var bar = document.getElementById("section-bar");
  if (!bar) { bar = document.createElement("nav"); bar.id = "section-bar"; document.documentElement.appendChild(bar); }
  function paint() {
    document.querySelectorAll(".nav-menu,#drop-float").forEach(function (el) { el.remove(); });
    document.querySelectorAll(".nav-drop.open").forEach(function (el) { el.classList.remove("open"); });
    var h = (location.hash || "").replace(/^#\/?/, "");
    var top = document.querySelector(".mast .topbar") || document.querySelector(".topbar");
    if (top) bar.style.top = Math.round(top.getBoundingClientRect().bottom) + "px";
    var list = null, current = "";
    if (h === "atlas" || h.indexOf("atlas/") === 0) { list = ATLAS; current = "#/atlas/" + (h === "atlas" ? "world" : h.slice(6)); }
    else if (h === "codex" || h.indexOf("codex/") === 0) { list = CODEX; current = "#/codex/" + (h === "codex" ? "calendar" : h.slice(6)); }
    if (!list) { bar.classList.remove("show"); bar.innerHTML = ""; return; }
    var html = list.map(function (it) { return '<a href="' + it[1] + '" class="' + (it[1] === current ? "active" : "") + '">' + it[0] + "</a>"; }).join("");
    if (bar.innerHTML !== html) bar.innerHTML = html;
    bar.classList.add("show");
    lockLore();
  }
  paint();
  setInterval(function () { paint(); lockLore(); }, 50);
  window.addEventListener("hashchange", paint);
  requestAnimationFrame(function loop() { lockLore(); requestAnimationFrame(loop); });
})();
