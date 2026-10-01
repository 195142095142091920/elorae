(function () {
  if (![].some.call(document.scripts, function (s) { return (s.src || "").indexOf("journal-toc.js?v=3") !== -1; })) {
    var j = document.createElement("script");
    j.src = "journal-toc.js?v=3";
    document.documentElement.appendChild(j);
  }
  if (![].some.call(document.scripts, function (s) { return (s.src || "").indexOf("restore-hash.js?v=5") !== -1; })) {
    var r = document.createElement("script");
    r.src = "restore-hash.js?v=5";
    document.documentElement.appendChild(r);
  }
  if ([].some.call(document.scripts, function (s) { return (s.src || "").indexOf("nav-boot.js?v=12") !== -1; })) return;
  var s = document.createElement("script");
  s.src = "nav-boot.js?v=12";
  document.documentElement.appendChild(s);
})();
