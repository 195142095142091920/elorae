(function () {
  var ATLAS = [["Overview","#/atlas/world"],["Cosm","#/atlas/cosm"],["Essen Revir","#/atlas/essen-revir"],["Far Nybei","#/atlas/far-nybei"],["Hesk","#/atlas/hesk"]];
  var CODEX = [["Calendar","#/codex/calendar"],["Lore","#/codex/lore"],["Magics","#/codex/magics"],["Souls","#/codex/souls"]];
  var bar = document.getElementById("section-bar");
  if (!bar) { bar = document.createElement("nav"); bar.id = "section-bar"; document.documentElement.appendChild(bar); }
  function paint() {
    document.querySelectorAll(".nav-menu,#drop-float").forEach(function (el) { el.remove(); });
    var h = (location.hash || "").replace(/^#\/?/, "");
    var list = null, current = "";
    if (h === "atlas" || h.indexOf("atlas/") === 0) { list = ATLAS; current = "#/atlas/" + (h === "atlas" ? "world" : h.slice(6)); }
    else if (h === "codex" || h.indexOf("codex/") === 0) { list = CODEX; current = "#/codex/" + (h === "codex" ? "calendar" : h.slice(6)); }
    if (!list) { bar.classList.remove("show"); bar.innerHTML = ""; return; }
    var html = list.map(function (it) { return '<a href="' + it[1] + '" class="' + (it[1] === current ? "active" : "") + '">' + it[0] + "</a>"; }).join("");
    if (bar.innerHTML !== html) bar.innerHTML = html;
    bar.classList.add("show");
    document.documentElement.classList.add("hold-col");
    if (document.body) document.body.classList.add("hold-col");
  }
  paint();
  setInterval(paint, 400);
  window.addEventListener("hashchange", paint);
})();
