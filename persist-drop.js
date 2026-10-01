(function () {
  function load(src) {
    const key = src.split("?")[0];
    if ([].some.call(document.scripts, function (s) { return (s.src || "").indexOf(key) !== -1; })) return;
    const s = document.createElement("script");
    s.src = src;
    document.documentElement.appendChild(s);
  }
  load("nav-boot.js?v=3");
})();
