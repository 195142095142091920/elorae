(function () {
  if (!document.getElementById("title-gap")) {
    var gap = document.createElement("style");
    gap.id = "title-gap";
    gap.textContent = "@media (min-width:801px){body.journal-page .journal-read,body.atlas-page .journal-read,body.lore-page .journal-read{padding-top:72px!important}}";
    document.documentElement.appendChild(gap);
  }
  if (!document.getElementById("fit-lock")) {
    var fit = document.createElement("style");
    fit.id = "fit-lock";
    fit.textContent = ".entry #fitmark,.entry .fit-mark,.entry #fit,.entry .fit-toggle{color:#f3eee6!important;opacity:1!important;text-shadow:none!important}.entry #fitmark,.entry .fit-mark{transform:translateY(2px)!important}.entry #fitmark svg,.entry .fit-mark svg,.entry #fit svg,.entry .fit-toggle svg,.entry #fitmark path,.entry .fit-mark path,.entry #fit path,.entry .fit-toggle path{stroke:#f3eee6!important;color:#f3eee6!important;opacity:1!important;stroke-width:2.4!important}";
    document.documentElement.appendChild(fit);
  }
  if (![].some.call(document.scripts, function (s) { return (s.src || "").indexOf("friend-nav.js?v=49") !== -1; })) {
    var g = document.createElement("script");
    g.src = "friend-nav.js?v=49";
    document.documentElement.appendChild(g);
  }
  if (![].some.call(document.scripts, function (s) { return (s.src || "").indexOf("index-sections.js?v=11") !== -1; })) {
    var i = document.createElement("script");
    i.src = "index-sections.js?v=11";
    document.documentElement.appendChild(i);
  }
  if (![].some.call(document.scripts, function (s) { return (s.src || "").indexOf("features.js?v=42") !== -1; })) {
    var f = document.createElement("script");
    f.src = "features.js?v=42";
    document.documentElement.appendChild(f);
  }
  if (![].some.call(document.scripts, function (s) { return (s.src || "").indexOf("journal-toc.js?v=7") !== -1; })) {
    var j = document.createElement("script");
    j.src = "journal-toc.js?v=7";
    document.documentElement.appendChild(j);
  }
  if ([].some.call(document.scripts, function (s) { return (s.src || "").indexOf("nav-boot.js?v=15") !== -1; })) return;
  var n = document.createElement("script");
  if (![].some.call(document.scripts, function (s) { return (s.src || "").indexOf("mobile-fix.js?v=41") !== -1; })) {
    var m = document.createElement("script");
    m.src = "mobile-fix.js?v=41";
    document.documentElement.appendChild(m);
  }
  n.src = "nav-boot.js?v=15";
  document.documentElement.appendChild(n);
})();
