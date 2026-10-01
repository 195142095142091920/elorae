(function () {
  if ([].some.call(document.scripts, function (s) { return (s.src || "").indexOf("nav-boot.js?v=10") !== -1; })) return;
  var s = document.createElement("script");
  s.src = "nav-boot.js?v=10";
  document.documentElement.appendChild(s);
  var p = document.createElement("script");
  p.src = "pin-lore.js?v=3";
  document.documentElement.appendChild(p);
})();
