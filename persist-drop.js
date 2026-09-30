(function () {
  if (window.__dropFloatLoader) return;
  window.__dropFloatLoader = true;
  const s = document.createElement("script");
  s.src = "drop-float.js?v=1";
  document.documentElement.appendChild(s);
})();
