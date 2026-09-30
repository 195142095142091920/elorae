(function () {
  function load(src) {
    if (document.querySelector('script[src^="' + src.split("?")[0] + '"]')) return;
    const s = document.createElement("script");
    s.src = src;
    document.documentElement.appendChild(s);
  }
  load("drop-float.js?v=2");
  load("chrome-guard.js?v=1");
})();
