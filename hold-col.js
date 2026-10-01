(function () {
  var style = document.createElement("style");
  style.textContent = "html.hold-col .sheet,html.hold-col .atlas-stage,html.hold-col .room-body{top:96px!important}";
  document.documentElement.appendChild(style);
  var h = location.hash || "";
  if (h.indexOf("#/atlas") === 0 || h.indexOf("#/codex") === 0) document.documentElement.classList.add("hold-col");
})();
