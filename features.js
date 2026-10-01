(function () {
  var FIGURE = {
    jack: ["Galand Helviath", "#/galand-helviath"],
    jon: ["Telorin", "#/telorin"],
    julie: ["Saoirse", "#/saoirse"],
    sawyer: ["Vaerek Rathkin", "#/vaerek-at-ease"]
  };
  if (!document.getElementById("feature-css")) {
    var s = document.createElement("style");
    s.id = "feature-css";
    s.textContent = "#seek-wrap,#seek-glyph,#seek{display:none!important}#seek-ghost{position:fixed;left:50%;top:42%;transform:translate(-50%,-50%);z-index:180;pointer-events:none;font-family:\"Iowan Old Style\",Palatino,\"Times New Roman\",serif;font-weight:400;font-size:clamp(64px,9vw,128px);letter-spacing:.04em;color:rgba(243,238,230,.92);text-shadow:0 18px 50px rgba(0,0,0,.65);opacity:0;transition:opacity .45s ease;white-space:nowrap}#seek-ghost.show{opacity:1;transition:opacity .08s ease}#friend-link{position:fixed;top:18px;right:28px;z-index:260;color:#8f8a82;text-decoration:none;font-family:\"Helvetica Neue\",Helvetica,Arial,sans-serif;font-size:16px;letter-spacing:.16em;text-transform:uppercase}#friend-link:hover{color:#f3eee6}.tile.search-dim{opacity:.18;filter:grayscale(.4)}@media (min-width:801px){.wall{grid-template-columns:repeat(4,minmax(0,1fr))!important}.tile .name,.tile figcaption,.wall .tile span{font-size:15px!important;letter-spacing:.04em}.tile::after{content:\"\";position:absolute;left:0;right:0;bottom:0;height:72px;background:linear-gradient(to top,rgba(0,0,0,.72),rgba(0,0,0,0));pointer-events:none}.lore-toggle,.zone-lore,#lore{font-size:15px!important}}@media (max-width:800px){#friend-link{top:14px;right:12px;font-size:11px;letter-spacing:.1em}#seek-ghost{font-size:56px}}";
    document.documentElement.appendChild(s);
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
  }
  function pool() {
    return (window.ENTRIES || []).concat((who() && who().entries) || []);
  }
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
  window.addEventListener("hashchange", paintFriend);
  setTimeout(paintFriend, 600);
})();
