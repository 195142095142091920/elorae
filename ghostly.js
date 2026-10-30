/* The Journal of the Ghostly Wanderer: on phone the tab row scrolls sideways; bring the
   active tab into view on load. */
(function () {
  var bar = document.getElementById("section-bar"), on = bar && bar.querySelector("a.active");
  if (!on || bar.scrollWidth <= bar.clientWidth) return;
  bar.scrollLeft = Math.max(0, on.offsetLeft - (bar.clientWidth - on.offsetWidth) / 2);
})();
