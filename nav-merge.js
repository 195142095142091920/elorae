(function () {
  function merge() {
    const bar = document.querySelector(".mast .topbar") || document.querySelector(".topbar");
    const tabs = document.querySelector(".chapter-tabs, .atlas-tabs, .subbar");
    if (!bar || !tabs) return;
    if (tabs.parentElement === bar) bar.insertAdjacentElement("afterend", tabs);
  }
  const prev = window.pinChrome;
  window.pinChrome = function () {
    merge();
    if (typeof prev === "function") prev();
  };
  merge();
  setInterval(merge, 250);
})();
