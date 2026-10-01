(function () {
  if (!document.getElementById("journal-toc-css")) {
    var s = document.createElement("style");
    s.id = "journal-toc-css";
    s.textContent = ".topbar .chapter-tabs,.mast .chapter-tabs,.chapter-tabs{display:none!important}@media (min-width:801px){.journal-rail{position:fixed;top:102px;left:0;bottom:0;width:300px;z-index:8;padding:28px 28px 28px 28px;overflow:auto}.journal-rail h3{margin:0 0 18px;font-family:\"Iowan Old Style\",Palatino,serif;font-size:24px;font-weight:400;letter-spacing:.06em;color:#f3eee6}.journal-rail a{display:block;padding:7px 0;border-bottom:1px solid rgba(243,238,230,.07);font-family:\"Iowan Old Style\",Palatino,serif;font-size:15px;line-height:1.45;color:#d2cbc0;text-decoration:none}.journal-rail a.active,.journal-rail a:hover{color:#f3eee6}body.journal-page .sheet{top:62px!important}}";
    document.documentElement.appendChild(s);
  }
  function label(j) {
    var act = String(j.act || "").replace(/^act\s+/i, "").trim();
    var chap = String(j.chapter || "").replace(/^chapter\s+/i, "").trim();
    if (act && chap) return "Act " + act + " \u00b7 Chapter " + chap;
    return j.title || j.id;
  }
  function paint() {
    document.querySelectorAll(".chapter-tabs").forEach(function (el) { el.remove(); });
    var h = (location.hash || "").replace(/^#\/?/, "");
    var onJournal = h === "journal" || h.indexOf("journal/") === 0;
    var rail = document.getElementById("journal-rail");
    if (!onJournal) { if (rail) rail.remove(); return; }
    var entries = window.JOURNAL || [];
    var current = h.indexOf("journal/") === 0 ? h.slice(8) : (entries[0] && entries[0].id);
    if (!rail) { rail = document.createElement("aside"); rail.id = "journal-rail"; rail.className = "journal-rail"; document.documentElement.appendChild(rail); }
    var html = "<h3>Contents</h3>" + entries.map(function (j) {
      return '<a href="#/journal/' + j.id + '" class="' + (j.id === current ? "active" : "") + '">' + label(j) + "</a>";
    }).join("");
    if (rail.innerHTML !== html) rail.innerHTML = html;
  }
  paint();
  setInterval(paint, 200);
  window.addEventListener("hashchange", paint);
})();
