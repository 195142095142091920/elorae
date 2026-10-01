(function () {
  const old = window.pinChrome;
  window.pinChrome = function () {
    if (typeof old === "function") old();
  };
})();
