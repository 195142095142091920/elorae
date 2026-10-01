(function () {
  var FIGURE = {
    jack: ["Galand Helviath", "#/galand-helviath"],
    jon: ["Telorin", "#/telorin"],
    julie: ["Saoirse", "#/saoirse"],
    sawyer: ["Vaerek Rathkin", "#/vaerek-at-ease"]
  };
  var ARTS = {
    "vaerek-at-ease": ["assets/Vaerek, At Ease.png", "assets/Vaerek, Vessel of Heldranc.png"]
  };
  var artIndex = 0;
  var css = document.getElementById("feature-css");
  if (!css) { css = document.createElement("style"); css.id = "feature-css"; document.documentElement.appendChild(css); }
  css.textContent = "#seek-wrap,#seek-glyph,#seek{display:none!important}.tile .label{position:absolute!important;z-index:2!important;opacity:0!important;font-family:\"Helvetica Neue\",Helvetica,Arial,sans-serif!important;font-size:15px!important;font-weight:700!important;letter-spacing:.06em!important;text-transform:uppercase!important;color:#f3eee6!important;text-shadow:0 1px 2px rgba(0,0,0,.95),0 0 14px rgba(0,0,0,.8)!important}.tile:hover .label{opacity:1!important}.tile::after{content:\"\";position:absolute;z-index:1;left:0;right:0;bottom:0;height:84px;background:linear-gradient(to top,rgba(0,0,0,.78),rgba(0,0,0,0));pointer-events:none;opacity:0;transition:opacity .15s ease}.tile:hover::after{opacity:1}#art-swap{position:fixed;left:50%;bottom:86px;transform:translateX(-50%);z-index:22;display:flex;flex-direction:column;align-items:center;gap:10px}#art-swap button{background:none;border:0;padding:8px 14px;cursor:pointer;font-family:\"Helvetica Neue\",Helvetica,Arial,sans-serif;font-size:13px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:#f3eee6}#art-strip{display:flex;gap:10px;padding:12px;background:#070707;border:1px solid #000;opacity:0;pointer-events:none;transform:translateY(6px);transition:opacity .15s ease,transform .15s ease}#art-swap:hover #art-strip,#art-swap.open #art-strip{opacity:1;pointer-events:auto;transform:none}#art-strip img{width:132px;height:88px;object-fit:cover;display:block;cursor:pointer;border:1px solid transparent;opacity:1;transform:none}#art-strip img.on{transform:scale(.9);border-color:rgba(243,238,230,.45);opacity:.78}#art-strip img:hover{border-color:rgba(243,238,230,.7)}@media (max-width:800px){#art-swap{bottom:auto;top:38%}#art-strip{padding:10px}#art-strip img{width:108px;height:72px}}.entry .title-block .caption{font-family:\"Helvetica Neue\",Helvetica,Arial,sans-serif!important;font-size:15px!important;font-weight:400!important;letter-spacing:.08em!important;text-transform:none!important;color:#e4ddd2!important}@media (min-width:801px){.entry .title-block .caption{font-size:20px!important}}.entry .life-toggle,.entry .topbar a{font-family:\"Helvetica Neue\",Helvetica,Arial,sans-serif!important;font-size:16px!important;font-weight:700!important;letter-spacing:.16em!important;text-transform:uppercase!important;color:#f3eee6!important;text-shadow:none!important}@media (max-width:800px){.entry .life-toggle,.entry .topbar a{font-size:13px!important}}.entry .arrow{color:#f3eee6!important;opacity:1!important;font-weight:700!important;text-shadow:none!important}.entry #fitmark,.entry .fit-mark{color:#f3eee6!important;opacity:1!important;text-shadow:none!important;transform:translateY(2px)!important}.entry #fitmark svg,.entry .fit-mark svg,.entry #fit svg{stroke:#f3eee6!important;color:#f3eee6!important;opacity:1!important}body.entry #friend-link{font-family:\"Helvetica Neue\",Helvetica,Arial,sans-serif!important;font-size:16px!important;font-weight:700!important;letter-spacing:.16em!important;text-transform:uppercase!important;color:#f3eee6!important;text-shadow:none!important}@media (max-width:800px){body.entry #friend-link{font-size:13px!important;letter-spacing:.16em!important}}#seek-ghost{position:fixed;left:50%;top:42%;transform:translate(-50%,-50%);z-index:180;pointer-events:none;font-family:\"Iowan Old Style\",Palatino,\"Times New Roman\",serif;font-weight:400;font-size:clamp(64px,9vw,128px);letter-spacing:.04em;color:rgba(243,238,230,.92);text-shadow:0 18px 50px rgba(0,0,0,.65);opacity:0;transition:opacity .45s ease;white-space:nowrap}#seek-ghost.show{opacity:1;transition:opacity .08s ease}#friend-link{position:fixed;top:18px;right:28px;z-index:260;color:#8f8a82;text-decoration:none;font-family:\"Helvetica Neue\",Helvetica,Arial,sans-serif;font-size:16px;font-weight:400;letter-spacing:.16em;text-transform:uppercase}#friend-link:hover{color:#f3eee6}.tile.search-dim{opacity:.18;filter:grayscale(.4)}@media (min-width:801px){.wall{grid-template-columns:repeat(4,minmax(0,1fr))!important}}@media (max-width:800px){#friend-link{top:14px;right:12px}#seek-ghost{font-size:56px}}";
  function paintLabels() {
    document.querySelectorAll(".tile .label").forEach(function (el) {
      el.style.color = "#f3eee6";
      el.style.fontWeight = "700";
      el.style.fontSize = "15px";
      el.style.fontFamily = '"Helvetica Neue", Helvetica, Arial, sans-serif';
      el.style.letterSpacing = "0.06em";
      el.style.textTransform = "uppercase";
      el.style.zIndex = "2";
    });
  }
  function slug() { return (location.hash || "").replace(/^#\//, "").split("?")[0]; }
  function showArt(i) {
    var list = ARTS[slug()];
    if (!list) return;
    artIndex = i;
    var img = document.querySelector(".entry .hero img");
    if (img) img.src = list[i];
    var btn = document.querySelector("#art-swap button");
    if (btn) btn.textContent = (i + 1) + " / " + list.length;
    document.querySelectorAll("#art-strip img").forEach(function (thumb, n) {
      thumb.classList.toggle("on", n === i);
    });
  }
  function paintArt() {
    var list = ARTS[slug()];
    var wrap = document.getElementById("art-swap");
    if (!list || !document.body.classList.contains("entry")) {
      if (wrap) wrap.remove();
      artIndex = 0;
      return;
    }
    if (!wrap) {
      wrap = document.createElement("div");
      wrap.id = "art-swap";
      wrap.innerHTML = '<div id="art-strip"></div><button type="button"></button>';
      wrap.querySelector("button").addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (window.innerWidth <= 800) wrap.classList.toggle("open");
      });
      document.documentElement.appendChild(wrap);
    }
    var strip = wrap.querySelector("#art-strip");
    if (strip.childElementCount !== list.length) {
      strip.innerHTML = "";
      list.forEach(function (src, i) {
        var thumb = document.createElement("img");
        thumb.src = src;
        thumb.alt = "";
        thumb.addEventListener("click", function (e) {
          e.preventDefault();
          e.stopPropagation();
          showArt(i);
        });
        strip.appendChild(thumb);
      });
    }
    showArt(artIndex);
  }
  var oldWrap = document.getElementById("seek-wrap");
  if (oldWrap) oldWrap.remove();
  function who() { return typeof vaultOf === "function" ? vaultOf() : null; }
  function paintFriend() {
    var v = who();
    var old = document.getElementById("friend-link");
    if (!v || !FIGURE[v.id]) return;
    if (!old) {
      old = document.createElement("a");
      old.id = "friend-link";
      document.documentElement.appendChild(old);
    }
    if (old.getAttribute("href") !== FIGURE[v.id][1]) old.href = FIGURE[v.id][1];
    if (old.textContent !== FIGURE[v.id][0]) old.textContent = FIGURE[v.id][0];
    var on = document.body.classList.contains("entry");
    old.style.fontFamily = '"Helvetica Neue", Helvetica, Arial, sans-serif';
    old.style.fontWeight = on ? "700" : "400";
    old.style.color = on ? "#f3eee6" : "#8f8a82";
    old.style.letterSpacing = "0.16em";
    old.style.textTransform = "uppercase";
    old.style.textShadow = "none";
    old.style.fontSize = on && window.innerWidth <= 800 ? "13px" : "16px";
  }
  function pool() { return (window.ENTRIES || []).concat((who() && who().entries) || []); }
  if (!document.getElementById("seek-ghost")) {
    var ghost = document.createElement("div");
    ghost.id = "seek-ghost";
    document.documentElement.appendChild(ghost);
    var query = "";
    var fade;
    function show(q) {
      ghost.textContent = q;
      ghost.classList.toggle("show", !!q);
      clearTimeout(fade);
      if (q) fade = setTimeout(function () { ghost.classList.remove("show"); }, 900);
      document.querySelectorAll(".tile").forEach(function (tile) {
        var name = (tile.textContent || "").toLowerCase();
        tile.classList.toggle("search-dim", q.length > 0 && name.indexOf(q.toLowerCase()) === -1);
      });
    }
    function clear() {
      query = "";
      ghost.classList.remove("show");
      document.querySelectorAll(".tile.search-dim").forEach(function (tile) { tile.classList.remove("search-dim"); });
    }
    function go() {
      var q = query.trim().toLowerCase();
      if (!q) return;
      var list = pool();
      var hit = list.find(function (e2) { return (e2.title || "").toLowerCase() === q; }) || list.find(function (e2) { return (e2.title || "").toLowerCase().indexOf(q) === 0; }) || list.find(function (e2) { return (e2.title || "").toLowerCase().indexOf(q) !== -1; });
      if (!hit) return;
      clear();
      var href = "#/" + hit.id;
      if (location.hash !== href) location.hash = href;
      else if (window.route) window.route();
    }
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && query) {
        clear();
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        return;
      }
      if (e.key === "Enter" && query) {
        go();
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        return;
      }
      var t = e.target;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "Backspace" && query) {
        query = query.slice(0, -1);
        show(query);
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      if (e.key.length !== 1) return;
      query += e.key;
      show(query);
      e.preventDefault();
    }, true);
  }
  paintLabels();
  paintFriend();
  paintArt();
  window.addEventListener("hashchange", function () {
    artIndex = 0;
    setTimeout(paintFriend, 40);
    setTimeout(paintLabels, 80);
    setTimeout(paintArt, 80);
  });
  setTimeout(paintLabels, 300);
  setTimeout(paintFriend, 200);
  setTimeout(paintArt, 400);
  setTimeout(paintFriend, 800);
})();
