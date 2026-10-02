(function () {
  var FIGURE = {
    jack: ["Galand Helviath", "#/galand-helviath"],
    jon: ["Telorin", "#/telorin"],
    julie: ["Saoirse", "#/saoirse"],
    sawyer: ["Vaerek Rathkin", "#/vaerek-at-ease"]
  };
  if (!document.getElementById("friend-nav-css")) {
    var css = document.createElement("style");
    css.id = "friend-nav-css";
    css.textContent = "#friend-link{position:fixed;right:28px;z-index:260;display:flex;align-items:center;height:22px;line-height:1;color:#8f8a82;text-decoration:none;font-family:Helvetica,Arial,sans-serif;font-size:16px;font-weight:400;letter-spacing:.16em;text-transform:uppercase}";
    document.documentElement.appendChild(css);
  }
  function paint() {
    var v = typeof vaultOf === "function" ? vaultOf() : null;
    var link = document.getElementById("friend-link");
    if (!v || !FIGURE[v.id]) { if (link) link.remove(); return; }
    if (!link) {
      link = document.createElement("a");
      link.id = "friend-link";
      document.documentElement.appendChild(link);
    }
    link.href = FIGURE[v.id][1];
    link.textContent = FIGURE[v.id][0];
    var bar = document.querySelector(".topbar") || document.querySelector(".mast");
    if (bar) {
      var r = bar.getBoundingClientRect();
      link.style.top = Math.round(r.top + (r.height - link.offsetHeight) / 2) + "px";
    }
  }
  window.paintFriend = paint;
  paint();
  window.addEventListener("hashchange", function () { setTimeout(paint, 40); });
  setInterval(paint, 300);
})();
