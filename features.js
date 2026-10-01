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
    s.textContent = "#seek-wrap{position:fixed;top:14px;left:28%;z-index:260;display:flex;align-items:center;gap:8px}#seek-glyph{background:none;border:0;color:#8f8a82;cursor:pointer;padding:4px;line-height:0}#seek-glyph:hover{color:#f3eee6}#seek{width:0;opacity:0;pointer-events:none;background:transparent;border:0;color:transparent;font-size:16px;padding:0;outline:none}#seek-ghost{position:fixed;left:50%;top:42%;transform:translate(-50%,-50%);z-index:180;pointer-events:none;font-family:\"Iowan Old Style\",Palatino,\"Times New Roman\",serif;font-weight:400;font-size:clamp(64px,9vw,128px);letter-spacing:.04em;color:rgba(243,238,230,.92);text-shadow:0 18px 50px rgba(0,0,0,.65);opacity:0;transition:opacity .45s ease;white-space:nowrap}#seek-ghost.show{opacity:1;transition:opacity .08s ease}#friend-link{position:fixed;top:18px;right:28px;z-index:260;color:#8f8a82;text-decoration:none;font-family:\"Helvetica Neue\",Helvetica,Arial,sans-serif;font-size:16px;letter-spacing:.16em;text-transform:uppercase}#friend-link:hover{color:#f3eee6}.tile.search-dim{opacity:.18;filter:grayscale(.4)}@media (min-width:801px){.wall{grid-template-columns:repeat(4,minmax(0,1fr))!important}.tile .name,.tile figcaption,.wall .tile span{font-size:15px!important;letter-spacing:.04em}.tile::after{content:\"\";position:absolute;left:0;right:0;bottom:0;height:72px;background:linear-gradient(to top,rgba(0,0,0,.72),rgba(0,0,0,0));pointer-events:none}.lore-toggle,.zone-lore,#lore{font-size:15px!important}}@media (max-width:800px){#seek-wrap{top:44px;left:14px}#friend-link{top:14px;right:12px;font-size:11px;letter-spacing:.1em}#seek-ghost{font-size:56px}}";
    document.documentElement.appendChild(s);
  }
  function who() { return typeof vaultOf === "function" ? vaultOf() : null; }
  function placeSearch() {
    var wrap = document.getElementById("seek-wrap");
    if (!wrap || window.innerWidth <= 800) return;
    var brand = document.querySelector(".topbar > a, .mast .topbar > a");
    var atlas = null;
    document.querySelectorAll(".filters a, .topbar a").forEach(function (a) {
      if (!atlas && a.textContent.replace(/\s+/g, " ").trim() === "Atlas") atlas = a;
    });
    if (!brand || !atlas) return;
    var left = brand.getBoundingClientRect().right;
    var right = atlas.getBoundingClientRect().left;
    if (right - left < 40) return;
    wrap.style.left = Math.round((left + right) / 2 - 12) + "px";
  }
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
  function paintSearch() {
    if (document.getElementById("seek-wrap")) return;
    var wrap = document.createElement("div");
    wrap.id = "seek-wrap";
    wrap.innerHTML = '<button id="seek-glyph" type="button" aria-label="Search"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="7" cy="7" r="4.2"/><path d="M10.2 10.2 L14 14"/></svg></button><input id="seek" autocomplete="off" aria-label="Search">';
    document.documentElement.appendChild(wrap);
    var ghost = document.createElement("div");
    ghost.id = "seek-ghost";
    document.documentElement.appendChild(ghost);
    var input = wrap.querySelector("#seek");
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
      input.value = "";
      ghost.classList.remove("show");
      document.querySelectorAll(".tile.search-dim").forEach(function (tile) { tile.classList.remove("search-dim"); });
    }
    function go() {
      var q = input.value.trim().toLowerCase();
      if (!q) return;
      var list = pool();
      var hit = list.find(function (e2) { return (e2.title || "").toLowerCase() === q; }) || list.find(function (e2) { return (e2.title || "").toLowerCase().indexOf(q) === 0; }) || list.find(function (e2) { return (e2.title || "").toLowerCase().indexOf(q) !== -1; });
      if (!hit) return;
      clear();
      var href = "#/" + hit.id;
      if (location.hash !== href) location.hash = href;
      else if (window.route) window.route();
    }
    wrap.querySelector("#seek-glyph").addEventListener("click", function () { input.focus(); });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && (input.value || ghost.classList.contains("show"))) {
        clear();
        input.blur();
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        return;
      }
      if (e.key === "Enter" && input.value) {
        go();
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        return;
      }
      var t = e.target;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable) && t !== input) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "Backspace" && input.value) {
        input.value = input.value.slice(0, -1);
        show(input.value);
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      if (e.key.length !== 1) return;
      input.value += e.key;
      show(input.value);
      e.preventDefault();
    }, true);
  }
  paintSearch();
  paintFriend();
  placeSearch();
  window.addEventListener("hashchange", function () { paintFriend(); placeSearch(); });
  window.addEventListener("resize", placeSearch);
  setTimeout(placeSearch, 400);
  setTimeout(paintFriend, 600);
})();
