/* Article hero mini-gallery: swap the hero art when a thumbnail is chosen. */
(function () {
  var hero = document.querySelector(".art-hero > img");
  var btns = document.querySelectorAll(".art-swap button");
  btns.forEach(function (b) {
    b.addEventListener("click", function () {
      hero.src = b.getAttribute("data-src");
      hero.alt = b.getAttribute("data-alt") || hero.alt;
      hero.style.objectPosition = b.getAttribute("data-pos") || "";
      btns.forEach(function (o) { o.classList.toggle("on", o === b); o.setAttribute("aria-pressed", o === b ? "true" : "false"); });
    });
  });
})();
