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
    s.textContent = "#seek{margin-left:18px;background:transparent;border:0;border-bottom:1px solid rgba(143,138,130,.45);color:#f3eee6;font:inherit;font-size:13px;letter-spacing:.06em;width:140px;padding:4px 2px;outline:none}#seek::placeholder{color:#8f8a82}#friend-link{margin-left:16px}@media (min-width:801px){.wall{grid-template-columns:repeat(4,minmax(0,1fr))!important}.tile .name,.tile figcaption,.wall .tile span{font-size:15px!important;letter-spacing:.04em}.tile::after{content:\"\";position:absolute;left:0;right:0;bottom:0;height:72px;background:linear-gradient(to top,rgba(0,0,0,.72),rgba(0,0,0,0));pointer-events:none}.lore-toggle,.zone-lore,#lore{font-size:15px!important}}";
    document.documentElement.appendChild(s);
  }
  function who() {
    return typeof vaultOf === "function" ? vaultOf() : null;
  }
  function paintFriend() {
    var v = who();
    var bar = document.querySelector(".filters");
    var old = document.getElementById("friend-link");
    if (!v || !FIGURE[v.id] || !bar) { if (old) old.remove(); return; }
    if (!old) { old = document.createElement("a"); old.id = "friend-link"; bar.appendChild(old); }
    old.href = FIGURE[v.id][1];
    old.textContent = FIGURE[v.id][0];
  }
  function paintSearch() {
    var brand = document.querySelector(".topbar > a, .mast .topbar > a");
    if (!brand || document.getElementById("seek")) return;
    var input = document.createElement("input");
    input.id = "seek";
    input.placeholder = "Search";
    input.autocomplete = "off";
    brand.insertAdjacentElement("afterend", input);
    input.addEventListener("keydown", function (e) {
      if (e.key !== "Enter") return;
      go(input.value);
    });
  }
  function go(q) {
    q = (q || "").trim().toLowerCase();
    if (!q) return;
    var pool = (window.ENTRIES || []).concat((who() && who().entries) || []);
    var hit = pool.find(function (e) { return (e.title || "").toLowerCase() === q; }) || pool.find(function (e) { return (e.title || "").toLowerCase().indexOf(q) !== -1; });
    if (hit) location.hash = "#/" + hit.id;
  }
  function hideGalleryCats() {
    if ((location.hash || "").replace(/^#\/?/, "") !== "gallery" && location.hash !== "" && location.hash !== "#/") return;
    document.querySelectorAll(".subbar a, .filters a").forEach(function (a) {
      var t = a.textContent.replace(/\s+/g, " ").trim();
      if (["Figures", "Places", "Scenes", "All"].indexOf(t) !== -1) a.style.display = "none";
    });
  }
  document.addEventListener("keydown", function (e) {
    var t = e.target;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
    if (e.metaKey || e.ctrlKey || e.altKey || e.key.length !== 1) return;
    var input = document.getElementById("seek");
    if (!input) return;
    input.focus();
  });
  function tick() { paintSearch(); paintFriend(); hideGalleryCats(); }
  tick();
  setInterval(tick, 400);
  window.addEventListener("hashchange", tick);
})();
