(function () {
  if (!document.getElementById("title-gap")) {
    var gap = document.createElement("style");
    gap.id = "title-gap";
    gap.textContent = "@media (min-width:801px){body.journal-page .journal-read,body.atlas-page .journal-read,body.lore-page .journal-read{padding-top:72px!important}}";
    document.documentElement.appendChild(gap);
  }
  if (![].some.call(document.scripts, function (s) { return (s.src || "").indexOf("features.js?v=9") !== -1; })) {
    var f = document.createElement("script");
    f.src = "features.js?v=9";
    document.documentElement.appendChild(f);
  }
  if (![].some.call(document.scripts, function (s) { return (s.src || "").indexOf("journal-toc.js?v=3") !== -1; })) {
    var j = document.createElement("script");
    j.src = "journal-toc.js?v=3";
    document.documentElement.appendChild(j);
  }
  if ([].some.call(document.scripts, function (s) { return (s.src || "").indexOf("nav-boot.js?v=12") !== -1; })) return;
  var n = document.createElement("script");
  n.src = "nav-boot.js?v=12";
  document.documentElement.appendChild(n);
})();
