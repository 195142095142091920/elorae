(function () {
  if ([].some.call(document.scripts, function (s) { return (s.src || "").indexOf("nav-boot.js?v=12") !== -1; })) return;
  var s = document.createElement("script");
  s.src = "nav-boot.js?v=12";
  document.documentElement.appendChild(s);
})();
