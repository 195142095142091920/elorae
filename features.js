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
    s.textContent = "#seek{position:fixed;top:16px;left:118px;z-index:260;background:transparent;border:0;border-bottom:1px solid rgba(143,138,130,.45);color:#f3eee6;font:inherit;font-size:13px;letter-spacing:.06em;width:160px;padding:4px 2px;outline:none}#seek::placeholder{color:#8f8a82}#friend-link{position:fixed;top:18px;right:28px;z-index:260;color:#8f8a82;text-decoration:none;letter-spacing:.16em;text-transform:uppercase;font-size:16px}#friend-link:hover{color:#f3eee6}@media (min-width:801px){.wall{grid-template-columns:repeat(4,minmax(0,1fr))!important}.tile .name,.tile figcaption,.wall .tile span{font-size:15px!important;letter-spacing:.04em}.tile::after{content:\"\";position:absolute;left:0;right:0;bottom:0;height:72px;background:linear-gradient(to top,rgba(0,0,0,.72),rgba(0,0,0,0));pointer-events:none}.lore-toggle,.zone-lore,#lore{font-size:15px!important}}@media (max-width:800px){#seek{top:46px;left:16px;width:140px}#friend-link{top:14px;right:12px;font-size:11px}}";
    document.documentElement.appendChild(s);
  }
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
  function paintSearch() {
    if (document.getElementById("seek")) return;
    var input = document.createElement("input");
    input.id = "seek";
    input.placeholder = "Search";
    input.autocomplete = "off";
    document.documentElement.appendChild(input);
    input.addEventListener("keydown", function (e) {
      if (e.key !== "Enter") return;
      var q = input.value.trim().toLowerCase();
      if (!q) return;
      var pool = (window.ENTRIES || []).concat((who() && who().entries) || []);
      var hit = pool.find(function (e2) { return (e2.title || "").toLowerCase() === q; }) || pool.find(function (e2) { return (e2.title || "").toLowerCase().indexOf(q) !== -1; });
      if (hit) location.hash = "#/" + hit.id;
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
  paintSearch();
  paintFriend();
  window.addEventListener("hashchange", paintFriend);
  setTimeout(paintFriend, 600);
})();
