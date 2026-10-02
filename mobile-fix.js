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
    "body.index-sorted,body.index-sorted html{overflow-x:hidden!important}html:has(body.index-sorted),body.index-sorted{overflow-x:hidden!important;max-width:100%!important}body.index-sorted .mast,body.index-sorted .topbar,body.index-sorted .mast .topbar,body.index-sorted.room .topbar{display:flex!important;position:fixed!important;top:0!important;left:0!important;right:0!important;width:100%!important;z-index:80!important;background:#070707!important}",
    "body.index-sorted .topbar .filters,body.index-sorted .mast .filters{display:flex!important}",
    "body.index-sorted #friend-link{display:flex!important}",
    "body:not(.seal-page) .mast .topbar{width:100%!important;justify-content:center!important;font-size:11px!important}body:not(.seal-page) .mast .filters,body:not(.seal-page) .mast .filters a{font-size:11px!important;letter-spacing:.1em!important}body.index-sorted #index-rail .sub{display:none!important}",
    "body.index-sorted #index-tertiary{position:fixed;left:0;right:0;top:calc(env(safe-area-inset-top) + 132px)!important;z-index:68;display:flex;justify-content:center;gap:16px;padding:10px 12px 12px;background:#070707}",
    "body.index-sorted #index-tertiary button{border:0;background:none;color:#8f8a82;font-family:Helvetica,Arial,sans-serif;font-size:11px;letter-spacing:.12em;text-transform:uppercase}",
    "body.index-sorted #index-tertiary button.on{color:#f3eee6}",
    "body.index-sorted #index-flow{align-items:center!important}",
    "body.index-sorted.factions-open #index-flow{padding-top:calc(env(safe-area-inset-top) + 188px)!important}",
    "body.index-sorted .chapter-tabs,body.index-sorted .subbar{display:none!important}",
    "body.index-sorted #index-rail h3{display:none}body.index-sorted .topbar,body.index-sorted .mast .topbar{height:calc(env(safe-area-inset-top) + 44px)!important;padding-top:env(safe-area-inset-top)!important;padding-bottom:0!important;box-shadow:0 8px 0 #070707}body.index-sorted #index-rail::before{content:\"\";position:fixed;left:0;right:0;top:0;height:calc(env(safe-area-inset-top) + 52px);background:#070707;z-index:69;pointer-events:none}body.index-sorted #index-rail{background:#070707!important;z-index:72!important}body.index-sorted #index-rail{position:fixed!important;top:calc(env(safe-area-inset-top) + 44px)!important;left:0!important;right:0!important;bottom:auto!important;width:100%!important;max-width:100%!important;height:auto!important;z-index:70;padding:0!important;margin:0;background:#070707!important;overflow:visible!important;border:0;box-shadow:0 0 0 8px #070707}",
    "body.index-sorted #index-rail button:not(.index-toggle){display:none!important}",
    "body.index-sorted #index-rail.open{bottom:0!important;background:#070707!important}body.index-sorted #index-rail.open button:not(.index-toggle){display:block!important;width:100%;margin:0;padding:10px 18px;text-align:center!important;font-size:14px;background:#070707!important}",
    "body.index-sorted #index-rail .index-toggle{display:flex!important;align-items:center;justify-content:center;width:100%;min-height:40px;border:0;background:#070707;color:#f3eee6;font-family:Helvetica,Arial,sans-serif;font-size:13px;letter-spacing:.16em;text-transform:uppercase}",
    "body.index-sorted #index-rail .index-toggle::after{content:\"+\";margin-left:10px;color:#9a948a}",
    "body.index-sorted #index-rail.open .index-toggle::after{content:\"\\2013\"}",
    "body.index-sorted #index-flow{position:static!important;left:0!important;right:0!important;top:auto!important;bottom:auto!important;width:100%!important;max-width:100%!important;transform:none!important;display:flex!important;flex-direction:column!important;align-items:center!important;gap:28px;padding:calc(env(safe-area-inset-top) + 132px) 14px 80px!important;overflow:visible!important}",
    "body.index-sorted .index-card{width:calc(100vw - 28px)!important;max-width:none!important;text-align:center!important;margin-left:auto!important;margin-right:auto!important}",
    "body.index-sorted .index-card img{width:100%;height:auto;aspect-ratio:16/9!important}",
    "#section-bar.show{height:auto;min-height:36px;flex-wrap:wrap;gap:2px 8px;padding:6px 8px 8px;justify-content:center}",
    "#section-bar a{font-size:11px;letter-spacing:.08em;padding:5px 4px}",
    "body.entry #friend-link{right:58px;top:calc(env(safe-area-inset-top) + 10px)}",
    "body.entry:has(.lore.open) #friend-link,body.entry:has(.life-sheet.open) #friend-link{display:none!important}",
    "body.index-sorted #index-flow{position:static!important;left:0!important;right:0!important;width:100%!important;display:flex!important;flex-direction:column!important;align-items:center!important}",
    "body.index-sorted .index-card{width:calc(100vw - 28px)!important;max-width:none!important;text-align:center!important;margin:0 auto 28px!important}",
    "body.index-sorted .index-card img{width:100%!important;height:auto!important;aspect-ratio:16/9!important;object-fit:cover}",
    "body.index-sorted #index-rail{width:100%!important;background:#070707}",
    "body.index-sorted #index-rail.open{z-index:70;background:#070707}",
    "body.index-sorted #index-rail.open button{background:#070707}",
    "body.index-sorted #index-tertiary{top:calc(env(safe-area-inset-top) + 132px)!important}",
    "body.index-sorted #index-rail.open ~ #index-tertiary{display:none!important}",
    "header.topbar,.mast,.topbar{position:fixed!important;top:0!important;left:0!important;right:0!important;z-index:80!important;background:#070707!important;display:flex!important;align-items:center!important}@media (hover:none){.filters a:hover{color:#8f8a82!important}.filters a.active,.filters a.active:hover{color:#f3eee6!important}}",
    "body.index-sorted #index-rail{top:calc(env(safe-area-inset-top) + 44px)!important}",
    "body.index-sorted #index-rail button:not(.index-toggle){display:none!important}",
    "body.index-sorted #index-rail.open button:not(.index-toggle){display:block!important}",
    "body.index-sorted #index-flow{padding-top:92px!important}",
    ".entry .topbar #fit,.entry #fitmark{position:relative;z-index:40}",
    "}",
    "#site-nav{position:fixed!important;top:0!important;left:0!important;right:0!important;z-index:420!important;display:flex!important;align-items:center!important;justify-content:center!important;height:calc(env(safe-area-inset-top) + 46px)!important;padding:env(safe-area-inset-top) 14px 0!important;background:#070707!important;box-sizing:border-box!important}",
    "#site-nav .filters{display:flex!important;align-items:center!important;justify-content:center!important;gap:14px!important}",
    "#site-nav .filters a,#site-nav #friend-link a{font-family:\"Helvetica Neue\",Helvetica,Arial,sans-serif!important;font-size:11px!important;font-weight:400!important;letter-spacing:.12em!important;text-transform:uppercase!important;line-height:1!important;color:#8f8a82!important;text-decoration:none!important}",
    "#site-nav .filters a.active{font-weight:700!important;color:#f3eee6!important}",
    "#site-nav .dot{display:none!important}",
    "#site-nav #friend-link{margin-left:14px!important}",
    "@media (min-width:801px){#site-nav{height:56px!important;padding:0 28px!important}#site-nav .filters a,#site-nav #friend-link a{font-size:19.2px!important;letter-spacing:.12em!important}}",
    "@media (max-width:800px){",
    "body:not(.entry):not(.seal-page) .topbar,body:not(.entry):not(.seal-page) .mast .topbar{position:fixed!important;top:0!important;left:0!important;right:0!important;bottom:auto!important;z-index:200!important;display:flex!important;align-items:center!important;justify-content:center!important;height:calc(env(safe-area-inset-top) + 46px)!important;min-height:calc(env(safe-area-inset-top) + 46px)!important;margin:0!important;padding:env(safe-area-inset-top) 10px 0!important;background:#070707!important;box-sizing:border-box!important}",
    ".mast{top:0!important;padding:0!important;height:calc(env(safe-area-inset-top) + 46px)!important}",
    ".topbar .filters,.mast .filters{display:flex!important;align-items:center!important;justify-content:center!important;gap:12px!important;font-size:11px!important;letter-spacing:.12em!important}",
    ".topbar .filters a,.mast .filters a,#friend-link a{font-family:Helvetica,Arial,sans-serif!important;font-size:11px!important;font-weight:400!important;letter-spacing:.12em!important;line-height:1!important}",
    ".topbar .filters a.active,.mast .filters a.active{font-weight:700!important;color:#f3eee6!important}",
    ".topbar > a[href=\"#/seal\"]{position:absolute!important;width:0!important;height:0!important;overflow:hidden!important;padding:0!important}",
    "#journal-mobile-toc{top:calc(env(safe-area-inset-top) + 46px)!important;z-index:75!important;display:block!important}",
    "body.entry #friend-link{display:none!important}",
    ".dock,.life-dock{min-height:0!important;padding-bottom:max(16px, env(safe-area-inset-bottom))!important;justify-content:flex-end!important}",
    ".dock{width:64vw!important}",
    ".dock,.life-dock{transition:none!important}",
    ".dock:has(.lore.open)::after{-webkit-mask-image:linear-gradient(to right,#000 58%,transparent 100%)!important;mask-image:linear-gradient(to right,#000 58%,transparent 100%)!important}",
    ".life-dock:has(.life-sheet.open){width:100%!important;left:0!important;right:0!important;transform:none!important}",
    ".title-block{display:block!important}",
    ".title-block h1{display:inline!important;margin:0!important}",
    ".title-block .caption{display:inline-flex!important;flex-wrap:nowrap!important;align-items:baseline!important;white-space:nowrap!important;margin:0 0 0 8px!important;gap:8px!important;vertical-align:baseline!important}",
    ".title-block .more{display:inline!important;min-height:0!important;padding:0!important;margin:0!important;white-space:nowrap!important}",
    ".life-dock:not(:has(.life-sheet.open)) .life-toggle{min-height:0!important;padding:0!important;margin:0!important}",
    ".entry .topbar{position:relative!important}",
    ".entry .topbar #fit{position:absolute!important;right:10px!important;left:auto!important;top:calc(env(safe-area-inset-top) + 6px)!important;margin:0!important;z-index:50!important}",
    ".chapter-tabs,.topbar .chapter-tabs,body.journal-page .chapter-tabs{display:none!important;height:0!important;overflow:hidden!important}",
    ".mast .filters,.mast .filters a{font-size:11px!important;letter-spacing:.12em!important;line-height:1!important}",
    "body.index-sorted #index-rail{top:calc(env(safe-area-inset-top) + 46px)!important}",
    "body.index-sorted #index-tertiary{top:calc(env(safe-area-inset-top) + 86px)!important;margin:0!important;background:#070707!important;z-index:74!important}",
    "body.index-sorted.factions-open #index-flow,body.index-sorted #index-flow{padding-top:calc(env(safe-area-inset-top) + 128px)!important}",
    "}",
    ".entry .title-block .caption,.entry .caption,.entry .title-block .more{font-family:\"Iowan Old Style\",\"Palatino Linotype\",Palatino,Georgia,\"Times New Roman\",serif!important;font-weight:400!important;letter-spacing:.01em!important;text-transform:none!important}",
  ].join("");
  document.documentElement.appendChild(css);

  function markRoom() {
    var h = (location.hash || "").replace(/^#\/?/, "");
    var room = "";
    if (h.indexOf("atlas") === 0) room = "atlas";
    else if (h.indexOf("codex") === 0) room = "codex";
    else if (h.indexOf("index") === 0) room = "index";
    else if (h.indexOf("journal") === 0) room = "journal";
    else if (!h || h.indexOf("gallery") === 0) room = "gallery";
    document.querySelectorAll(".filters > a, .nav-drop > a").forEach(function (a) {
      if (a.closest(".nav-menu, .chapter-tabs, .atlas-tabs, .subbar")) return;
      var href = (a.getAttribute("href") || "").replace(/^#\/?/, "").split("/")[0];
      a.classList.toggle("active", !!room && href === room);
    });
  }

  var stale = document.getElementById("site-nav"); if (stale) stale.remove();
  window.addEventListener("hashchange", markRoom);
  setInterval(markRoom, 400);
  markRoom();
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
