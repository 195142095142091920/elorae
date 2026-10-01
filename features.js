(function () {
  var FIGURE = {
    jack: ["Galand Helviath", "#/galand-helviath"],
    jon: ["Telorin", "#/telorin"],
    julie: ["Saoirse", "#/saoirse"],
    sawyer: ["Vaerek Rathkin", "#/vaerek-at-ease"]
  };
  var css = document.getElementById("feature-css");
  if (!css) { css = document.createElement("style"); css.id = "feature-css"; document.documentElement.appendChild(css); }
  css.textContent = "#seek-wrap,#seek-glyph,#seek{display:none!important}.entry .title-block .caption{font-family:\"Helvetica Neue\",Helvetica,Arial,sans-serif!important;font-size:15px!important;font-weight:400!important;letter-spacing:.08em!important;text-transform:none!important;color:#e4ddd2!important}@media (min-width:801px){.entry .title-block .caption{font-size:20px!important}}.entry .life-toggle,.entry .topbar a{font-family:\"Helvetica Neue\",Helvetica,Arial,sans-serif!important;font-size:16px!important;font-weight:700!important;letter-spacing:.16em!important;text-transform:uppercase!important;color:#f3eee6!important;text-shadow:none!important}@media (max-width:800px){.entry .life-toggle,.entry .topbar a{font-size:13px!important}}.entry .arrow{color:#f3eee6!important;opacity:1!important;font-weight:700!important;text-shadow:none!important}.entry #fitmark,.entry .fit-mark{color:#f3eee6!important;opacity:1!important;text-shadow:none!important;transform:translateY(2px)!important}.entry #fitmark svg,.entry .fit-mark svg,.entry #fit svg{stroke:#f3eee6!important;color:#f3eee6!important;opacity:1!important}body.entry #friend-link{font-family:\"Helvetica Neue\",Helvetica,Arial,sans-serif!important;font-size:16px!important;font-weight:700!important;letter-spacing:.16em!important;text-transform:uppercase!important;color:#f3eee6!important;text-shadow:none!important}@media (max-width:800px){body.entry #friend-link{font-size:13px!important;letter-spacing:.16em!important}}#seek-ghost{position:fixed;left:50%;top:42%;transform:translate(-50%,-50%);z-index:180;pointer-events:none;font-family:\"Iowan Old Style\",Palatino,\"Times New Roman\",serif;font-weight:400;font-size:clamp(64px,9vw,128px);letter-spacing:.04em;color:rgba(243,238,230,.92);text-shadow:0 18px 50px rgba(0,0,0,.65);opacity:0;transition:opacity .45s ease;white-space:nowrap}#seek-ghost.show{opacity:1;transition:opacity .08s ease}#friend-link{position:fixed;top:18px;right:28px;z-index:260;color:#8f8a82;text-decoration:none;font-family:\"Helvetica Neue\",Helvetica,Arial,sans-serif;font-size:16px;font-weight:400;letter-spacing:.16em;text-transform:uppercase}#friend-link:hover{color:#f3eee6}.tile.search-dim{opacity:.18;filter:grayscale(.4)}@media (min-width:801px){.wall{grid-template-columns:repeat(4,minmax(0,1fr))!important}.tile .name,.tile figcaption,.wall .tile span{font-size:15px!important;letter-spacing:.04em}.tile::after{content:\"\";position:absolute;left:0;right:0;bottom:0;height:72px;background:linear-gradient(to top,rgba(0,0,0,.72),rgba(0,0,0,0));pointer-events:none}}@media (max-width:800px){#friend-link{top:14px;right:12px}#seek-ghost{font-size:56px}}";
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
  paintFriend();
  window.addEventListener("hashchange", function () { setTimeout(paintFriend, 40); });
  setTimeout(paintFriend, 200);
  setTimeout(paintFriend, 800);
})();
