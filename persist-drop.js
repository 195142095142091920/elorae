(function () {
  if ([].some.call(document.scripts, function (s) { return (s.src || "").indexOf("nav-boot.js?v=8") !== -1; })) return;
  var s = document.createElement("script");
  s.src = "nav-boot.js?v=8";
  document.documentElement.appendChild(s);
})();
