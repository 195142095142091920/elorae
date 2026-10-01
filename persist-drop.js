(function () {
  if (![].some.call(document.scripts, function (s) { return (s.src || "").indexOf("nav-boot.js?v=7") !== -1; })) {
    var s = document.createElement("script");
    s.src = "nav-boot.js?v=7";
    document.documentElement.appendChild(s);
  }
  var style = document.createElement("style");
  style.textContent = "html.hold-col .sheet,html.hold-col .atlas-stage,html.hold-col .room-body{top:96px!important}";
  document.documentElement.appendChild(style);
  function hold() {
    var h = location.hash || "";
    document.documentElement.classList.toggle("hold-col", h.indexOf("#/atlas") === 0 || h.indexOf("#/codex") === 0);
  }
  hold();
  window.addEventListener("hashchange", hold);
})();
