(function () {
  function dropBoot() {
    var boot = document.getElementById("boot-nav");
    if (!boot) return;
    var real = document.querySelector(".mast:not(#boot-nav), .topbar:not(#boot-nav .topbar)");
    if (real && real !== boot && !boot.contains(real)) boot.remove();
  }
  dropBoot();
  setInterval(dropBoot, 200);
  if ([].some.call(document.scripts, function (s) { return (s.src || "").indexOf("nav-boot.js?v=12") !== -1; })) return;
  var s = document.createElement("script");
  s.src = "nav-boot.js?v=12";
  document.documentElement.appendChild(s);
})();
