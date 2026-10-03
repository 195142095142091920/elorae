(function () {
  window.__bootHash = location.hash || "";
  function hideIndexList() {
    document.documentElement.classList.toggle("index-boot", (location.hash || "").indexOf("#/index") === 0);
  }
  hideIndexList();
  window.addEventListener("hashchange", hideIndexList);
  if (!document.getElementById("index-boot-css")) {
    var bootCss = document.createElement("style");
    bootCss.id = "index-boot-css";
    bootCss.textContent = "html.index-boot .index-list{display:none!important}";
    document.documentElement.appendChild(bootCss);
  }
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    var wrap = document.getElementById("seek-wrap");
    if (!wrap || !wrap.classList.contains("open")) return;
    wrap.classList.remove("open");
    var input = document.getElementById("seek");
    if (input) input.blur();
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
  }, true);
  var boot = window.__bootHash;
  var ATLAS = [["Overview","#/atlas/world"],["Cosm","#/atlas/cosm"],["Essen Revir","#/atlas/essen-revir"],["Far Nybei","#/atlas/far-nybei"],["Hesk","#/atlas/hesk"]];
  var CODEX = [["Calendar","#/codex/calendar"],["Lore","#/codex/lore"],["Magics","#/codex/magics"],["Souls","#/codex/souls"]];
  if (!document.getElementById("early-section-css")) {
    var css = document.createElement("style");
    css.id = "early-section-css";
    css.textContent = ".chapter-tabs,.topbar .chapter-tabs{display:none!important}#section-bar{display:none;position:fixed;left:0;right:0;top:62px;z-index:500;height:40px;align-items:center;justify-content:center;gap:18px;background:#070707}#section-bar.show{display:flex}#section-bar a{color:#8f8a82;text-decoration:none;padding:8px 12px;font-family:Helvetica,Arial,sans-serif;font-size:15px;letter-spacing:.16em;text-transform:uppercase}#section-bar a.active,#section-bar a:hover{color:#f3eee6}@media (min-width:801px){.topbar,.mast .topbar{display:flex!important;align-items:center;position:relative}.topbar .filters,.mast .topbar .filters{position:absolute!important;left:50%!important;transform:translateX(-50%)!important}}";
    document.documentElement.appendChild(css);
  }
  function paintBar() {
    var h = (location.hash || boot || "").replace(/^#\/?/, "");
    var list = null, current = "";
    if (h === "atlas" || h.indexOf("atlas/") === 0) { list = ATLAS; current = "#/atlas/" + (h === "atlas" ? "world" : h.slice(6)); }
    else if (h === "codex" || h.indexOf("codex/") === 0) { list = CODEX; current = "#/codex/" + (h === "codex" ? "calendar" : h.slice(6)); }
    var bar = document.getElementById("section-bar");
    if (!list) return;
    if (!bar) { bar = document.createElement("nav"); bar.id = "section-bar"; document.documentElement.appendChild(bar); }
    var top = document.querySelector(".mast .topbar") || document.querySelector(".topbar");
    if (top) bar.style.top = Math.round(top.getBoundingClientRect().bottom) + "px";
    bar.innerHTML = list.map(function (it) { return '<a href="' + it[1] + '" class="' + (it[1] === current ? "active" : "") + '">' + it[0] + "</a>"; }).join("");
    bar.classList.add("show");
  }
  if (boot.indexOf("#/atlas") === 0 || boot.indexOf("#/codex") === 0) {
    document.documentElement.classList.add("hold-route");
    var hide = document.createElement("style");
    hide.textContent = "html.hold-route body{visibility:hidden}html.hold-route body.atlas-page,html.hold-route body.journal-page,html.hold-route body.lore-page,html.hold-route body.room{visibility:visible}";
    document.documentElement.appendChild(hide);
    paintBar();
  }
  document.addEventListener("DOMContentLoaded", paintBar);
  var busy = false;
  function hold() {
    var h = location.hash || "";
    document.documentElement.classList.toggle("hold-col", h.indexOf("#/atlas") === 0 || h.indexOf("#/codex") === 0);
  }
  hold();
  function setHash(href) {
    if (location.hash === href) return;
    history.replaceState(null, "", location.pathname + href);
  }
  function run(href) {
    setHash(href);
    hold();
    paintBar();
    if (href.indexOf("#/atlas") === 0 && window.renderAtlasWorld) {
      window.renderAtlasWorld(href.replace(/^#\/atlas\/?/, "") || "world");
      document.documentElement.classList.remove("hold-route");
      return true;
    }
    if (href.indexOf("#/codex") === 0 && window.renderCodex) {
      window.renderCodex(href.replace(/^#\/codex\/?/, "") || "calendar");
      document.documentElement.classList.remove("hold-route");
      return true;
    }
    if (href.indexOf("#/journal") === 0 && window.renderJournalEntry) {
      var list = window.JOURNAL || [];
      var id = href.replace(/^#\/journal\/?/, "") || (list[list.length - 1] && list[list.length - 1].id);
      window.renderJournalEntry(id);
      return true;
    }
    if (href === "#/index") {
      if (window.renderIndex) { window.renderIndex(); document.documentElement.classList.remove("hold-route"); return true; }
      if (window.route) { window.route(); return true; }
    }
    if (href === "#/gallery" && window.route) { window.route(); return true; }
    return false;
  }
  document.addEventListener("click", function (e) {
    var sec = e.target.closest && e.target.closest("#section-bar a");
    var a = sec || (e.target.closest && e.target.closest("a"));
    if (!a) return;
    var href = "";
    if (sec) href = sec.getAttribute("href") || "";
    else if (a.closest(".filters, .topbar, .mast") && !a.closest(".chapter-tabs, .atlas-tabs, .subbar")) {
      var label = a.textContent.replace(/\s+/g, " ").trim();
      var map = { Atlas: "#/atlas/world", Codex: "#/codex/calendar", Gallery: "#/gallery", Index: "#/index", Journal: "#/journal/iii-xli" };
      href = map[label] || "";
    }
    if (!href || href.charAt(0) !== "#") return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (busy) return;
    busy = true;
    if (!run(href)) {
      var tries = 0;
      var timer = setInterval(function () {
        tries += 1;
        if (run(href) || tries > 40) { clearInterval(timer); busy = false; }
      }, 50);
      return;
    }
    busy = false;
  }, true);
  window.addEventListener("hashchange", function () { hold(); paintBar(); });
})();
