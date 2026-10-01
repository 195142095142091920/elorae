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
    s.textContent = "#seek-wrap{position:fixed;top:14px;left:28%;z-index:260;display:flex;align-items:center;gap:8px}#seek-glyph{background:none;border:0;color:#8f8a82;cursor:pointer;padding:4px;line-height:0}#seek-glyph:hover{color:#f3eee6}#seek{width:0;opacity:0;background:transparent;border:0;border-bottom:1px solid transparent;color:#f3eee6;font-family:\"Helvetica Neue\",Helvetica,Arial,sans-serif;font-size:13px;letter-spacing:.08em;padding:4px 0;outline:none;transition:width .18s ease,opacity .18s ease}#seek-wrap.open #seek{width:160px;opacity:1;border-bottom-color:rgba(143,138,130,.45)}#seek::placeholder{color:#8f8a82}#friend-link{position:fixed;top:18px;right:28px;z-index:260;color:#8f8a82;text-decoration:none;font-family:\"Helvetica Neue\",Helvetica,Arial,sans-serif;font-size:16px;letter-spacing:.16em;text-transform:uppercase}#friend-link:hover{color:#f3eee6}@media (min-width:801px){.wall{grid-template-columns:repeat(4,minmax(0,1fr))!important}.tile .name,.tile figcaption,.wall .tile span{font-size:15px!important;letter-spacing:.04em}.tile::after{content:\"\";position:absolute;left:0;right:0;bottom:0;height:72px;background:linear-gradient(to top,rgba(0,0,0,.72),rgba(0,0,0,0));pointer-events:none}.lore-toggle,.zone-lore,#lore{font-size:15px!important}}@media (max-width:800px){#seek-wrap{top:44px;left:14px}#friend-link{top:14px;right:12px;font-size:11px;letter-spacing:.1em}}";
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
    wrap.style.left = Math.round((left + right) / 2 - wrap.offsetWidth / 2) + "px";
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
  function paintSearch() {
    if (document.getElementById("seek-wrap")) return;
    var wrap = document.createElement("div");
    wrap.id = "seek-wrap";
    wrap.innerHTML = '<button id="seek-glyph" type="button" aria-label="Search"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="7" cy="7" r="4.2"/><path d="M10.2 10.2 L14 14"/></svg></button><input id="seek" placeholder="Search" autocomplete="off">';
    document.documentElement.appendChild(wrap);
    var glyph = wrap.querySelector("#seek-glyph");
    var input = wrap.querySelector("#seek");
    function open() { wrap.classList.add("open"); input.focus(); placeSearch(); }
    glyph.addEventListener("click", open);
    input.addEventListener("keydown", function (e) {
      if (e.key !== "Enter") return;
      var q = input.value.trim().toLowerCase();
      if (!q) return;
      var pool = (window.ENTRIES || []).concat((who() && who().entries) || []);
      var hit = pool.find(function (e2) { return (e2.title || "").toLowerCase() === q; }) || pool.find(function (e2) { return (e2.title || "").toLowerCase().indexOf(q) !== -1; });
      if (hit) location.hash = "#/" + hit.id;
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && wrap.classList.contains("open")) {
        wrap.classList.remove("open");
        input.blur();
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        return;
      }
      var t = e.target;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey || e.key.length !== 1) return;
      open();
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
