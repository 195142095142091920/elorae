/* Article hero mini-gallery: arrows cycle the hero art; hovering reveals thumbnails. */
(function () {
  var hero = document.querySelector(".art-hero > img");
  var btns = Array.prototype.slice.call(document.querySelectorAll(".art-swap-thumbs button"));
  if (!hero || !btns.length) return;
  var cur = Math.max(0, btns.findIndex(function (b) { return b.classList.contains("on"); }));
  function show(i) {
    cur = (i + btns.length) % btns.length;
    var b = btns[cur];
    hero.src = b.getAttribute("data-src");
    hero.alt = b.getAttribute("data-alt") || hero.alt;
    hero.style.objectPosition = b.getAttribute("data-pos") || "";
    btns.forEach(function (o, n) { o.classList.toggle("on", n === cur); o.setAttribute("aria-pressed", n === cur ? "true" : "false"); });
  }
  btns.forEach(function (b, n) { b.addEventListener("click", function () { show(n); }); });
  var prev = document.querySelector(".art-swap .art-prev");
  var next = document.querySelector(".art-swap .art-next");
  if (prev) prev.addEventListener("click", function () { show(cur - 1); });
  if (next) next.addEventListener("click", function () { show(cur + 1); });
  /* Previous thumbnail-only handler (replaced by show() above, art5):
  var btns = document.querySelectorAll(".art-swap button");
  btns.forEach(function (b) {
    b.addEventListener("click", function () {
      hero.src = b.getAttribute("data-src");
      hero.alt = b.getAttribute("data-alt") || hero.alt;
      hero.style.objectPosition = b.getAttribute("data-pos") || "";
      btns.forEach(function (o) { o.classList.toggle("on", o === b); o.setAttribute("aria-pressed", o === b ? "true" : "false"); });
    });
  });
  */
})();
