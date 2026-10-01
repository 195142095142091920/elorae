(function () {
  if (!document.getElementById("title-gap")) {
    var s = document.createElement("style");
    s.id = "title-gap";
    s.textContent = "@media (min-width:801px){body.journal-page .journal-read,body.atlas-page .journal-read,body.lore-page .journal-read{padding-top:72px!important}.journal-read>h2:first-child,.journal-read>.codex-h:first-child,.journal-read>.codex-title:first-child{margin-top:0!important}}";
    document.documentElement.appendChild(s);
  }
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
  var n = document.createElement("script");
  n.src = "nav-boot.js?v=12";
  document.documentElement.appendChild(n);
})();
