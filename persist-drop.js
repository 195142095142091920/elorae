(function () {
  if ([].some.call(document.scripts, function (s) { return (s.src || "").indexOf("nav-boot.js?v=5") !== -1; })) return;
  var s = document.createElement("script");
  s.src = "nav-boot.js?v=5";
  document.documentElement.appendChild(s);
})();
