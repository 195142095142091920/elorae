(function () {
  if (document.getElementById("mobile-fix")) return;
  var css = document.createElement("style");
  css.id = "mobile-fix";
  css.textContent = [
    "@media (max-width:800px){",
    "#journal-rail{display:none!important}",
    "#journal-mobile-toc{position:fixed;left:0;right:0;z-index:40;background:#070707}",
    "#journal-mobile-toc button{display:flex;align-items:center;justify-content:center;width:100%;min-height:40px;border:0;background:#070707;color:#f3eee6;font-family:\"Iowan Old Style\",Palatino,serif;font-size:18px;letter-spacing:.04em}",
    "#journal-mobile-toc button::after{content:\"+\";margin-left:10px;color:#9a948a;font-size:16px}",
    "#journal-mobile-toc.open button::after{content:\"\\2013\"}",
    "#journal-mobile-toc .panel{display:none;max-height:58vh;overflow:auto;padding:0 18px 48px;background:linear-gradient(to bottom,#070707 0%,#070707 48%,rgba(7,7,7,.4) 78%,rgba(7,7,7,0) 100%)}",
    "#journal-mobile-toc.open .panel{display:block}",
    "#journal-mobile-toc a{display:block;padding:9px 0;color:#d2cbc0;text-decoration:none;font-family:\"Iowan Old Style\",Palatino,serif;font-size:16px}",
    "#journal-mobile-toc a.active{color:#f3eee6}",
    "body.journal-page .sheet,body.journal-page .room-body{top:96px!important}",
    "body.index-sorted .topbar,body.index-sorted .mast{display:flex!important;position:fixed;top:0;left:0;right:0;z-index:60;background:#070707}
body.index-sorted .topbar .filters,body.index-sorted .mast .filters{display:flex!important}
body.index-sorted #friend-link{display:none!important}
body.index-sorted #index-rail .sub{display:none!important}
body.index-sorted #index-tertiary{position:fixed;left:0;right:0;top:calc(env(safe-area-inset-top) + 92px);z-index:39;display:flex;justify-content:center;gap:16px;padding:8px 12px;background:#070707}
body.index-sorted #index-tertiary button{border:0;background:none;color:#8f8a82;font-family:Helvetica,Arial,sans-serif;font-size:11px;letter-spacing:.12em;text-transform:uppercase}
body.index-sorted #index-tertiary button.on{color:#f3eee6}
body.index-sorted #index-flow{align-items:center!important}
body.index-sorted.factions-open #index-flow{padding-top:148px!important}
body.index-sorted .chapter-tabs,body.index-sorted .subbar{display:none!important}",
    "body.index-sorted #index-rail h3{display:none}body.index-sorted #index-rail{position:fixed;top:calc(env(safe-area-inset-top) + 52px);left:0;right:0;bottom:auto;width:auto;z-index:40;padding:0;background:#070707;overflow:visible}",
    "body.index-sorted #index-rail button{display:none}",
    "body.index-sorted #index-rail.open button{display:block;width:100%;margin:0;padding:10px 18px;text-align:center;font-size:14px}",
    "body.index-sorted #index-rail .index-toggle{display:flex!important;align-items:center;justify-content:center;width:100%;min-height:40px;border:0;background:#070707;color:#f3eee6;font-family:Helvetica,Arial,sans-serif;font-size:13px;letter-spacing:.16em;text-transform:uppercase}",
    "body.index-sorted #index-rail .index-toggle::after{content:\"+\";margin-left:10px;color:#9a948a}",
    "body.index-sorted #index-rail.open .index-toggle::after{content:\"\\2013\"}",
    "body.index-sorted #index-flow{position:static;left:auto;right:auto;top:auto;bottom:auto;display:flex;flex-direction:column;align-items:center;gap:28px;width:100%;padding:108px 18px 80px;overflow:visible}",
    "body.index-sorted .index-card{width:min(280px,78vw)}",
    "body.index-sorted .index-card img{width:100%;height:auto;aspect-ratio:3/4}",
    "#section-bar.show{height:auto;min-height:36px;flex-wrap:wrap;gap:2px 8px;padding:6px 8px 8px;justify-content:center}",
    "#section-bar a{font-size:11px;letter-spacing:.08em;padding:5px 4px}",
    "body.entry #friend-link{right:58px;top:calc(env(safe-area-inset-top) + 10px)}",
    "body.entry:has(.lore.open) #friend-link,body.entry:has(.life-sheet.open) #friend-link{display:none!important}",
    ".entry .topbar #fit,.entry #fitmark{position:relative;z-index:40}",
    "}"
  ].join("");
  document.documentElement.appendChild(css);

  function phone() { return window.innerWidth <= 800; }
  function hash() { return (location.hash || "").replace(/^#\/?/, ""); }

  function journalBar() {
    var bar = document.getElementById("journal-mobile-toc");
    var on = phone() && (hash() === "journal" || hash().indexOf("journal/") === 0);
    if (!on) { if (bar) bar.remove(); return; }
    var entries = window.JOURNAL || [];
    var current = hash().indexOf("journal/") === 0 ? hash().slice(8) : (entries[0] && entries[0].id);
    var currentLabel = "Chapters";
    /* toggle stays labeled Chapters */
    if (!bar) {
      bar = document.createElement("nav");
      bar.id = "journal-mobile-toc";
      document.documentElement.appendChild(bar);
      bar.addEventListener("pointerup", function (e) {
        var btn = e.target.closest("button");
        if (!btn) return;
        e.preventDefault();
        e.stopPropagation();
        bar.classList.toggle("open");
        bar.setAttribute("data-lock", String(Date.now()));
      });
      bar.addEventListener("click", function (e) {
        if (e.target.closest("a")) bar.classList.remove("open");
        if (!e.target.closest("button")) return;
        e.preventDefault();
        var lock = Number(bar.getAttribute("data-lock") || 0);
        if (Date.now() - lock < 700) return;
        bar.classList.toggle("open");
      });
    }
    var top = document.querySelector(".topbar, .mast");
    bar.style.top = (top ? Math.round(top.getBoundingClientRect().bottom) : 52) + "px";
    var panel = entries.map(function (j) {
      var label = (j.act ? j.act + ". " : "") + (j.chapter || j.title || "");
      return '<a href="#/journal/' + j.id + '" class="' + (j.id === current ? "active" : "") + '">' + label + "</a>";
    }).join("");
    var next = '<button type="button">' + currentLabel + '</button><div class="panel">' + panel + "</div>";
    if (bar.getAttribute("data-html") !== next) {
      var open = bar.classList.contains("open");
      bar.innerHTML = next;
      bar.setAttribute("data-html", next);
      if (open) bar.classList.add("open");
    }
  }

  function indexBar() {
    if (!phone() || hash().indexOf("index") !== 0) return;
    var rail = document.getElementById("index-rail");
    if (!rail || rail.querySelector(".index-toggle")) return;
    var toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "index-toggle";
    toggle.textContent = "Ancients";
    rail.insertBefore(toggle, rail.firstChild);
    toggle.addEventListener("click", function () { rail.classList.toggle("open"); });
    rail.addEventListener("click", function (e) {
      if (e.target.getAttribute("data-sec") || e.target.getAttribute("data-fac")) rail.classList.remove("open");
    });
  }

  function seatGlow() {}
  function tick() {
    if (!phone()) {
      var bar = document.getElementById("journal-mobile-toc");
      if (bar) bar.remove();
      return;
    }
    journalBar();
    indexBar();
    seatGlow();
    var rail = document.getElementById("index-rail");
    var toggle = rail && rail.querySelector(".index-toggle");
    if (toggle) {
      var on = rail.querySelector("button.on");
      toggle.textContent = on ? on.textContent : "Ancients";
    }
  }
  tick();
  setInterval(tick, 240);
  window.addEventListener("hashchange", tick);
  window.addEventListener("resize", tick);
})();
