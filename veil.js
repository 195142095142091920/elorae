(function () {
  function apply(amt) {
    document.body.style.setProperty("--veil-amt", String(amt));
    document.body.setAttribute("data-veil", amt > 0.62 ? "hard" : amt > 0.42 ? "mid" : "soft");
  }
  function tintVeil(img) {
    apply(0.35);
    const run = function () {
      try {
        if (!img.naturalWidth) return;
        const w = 48, h = 28;
        const c = document.createElement("canvas");
        c.width = w; c.height = h;
        const ctx = c.getContext("2d", { willReadFrequently: true });
        ctx.drawImage(img, 0, 0, w, h);
        const px = ctx.getImageData(0, 0, w, h).data;
        let sum = 0, n = 0;
        for (let y = Math.floor(h * 0.5); y < h; y++) {
          for (let x = 0; x < w; x++) {
            const i = (y * w + x) * 4;
            sum += px[i] * 0.2126 + px[i + 1] * 0.7152 + px[i + 2] * 0.0722;
            n++;
          }
        }
        const avg = sum / n;
        apply(Math.min(0.82, Math.max(0.22, (avg - 40) / 210)));
      } catch (e) {}
    };
    if (img.complete) run();
    else img.addEventListener("load", run);
  }
  function watch() {
    const img = document.querySelector(".entry .hero img");
    if (img) tintVeil(img);
  }
  window.addEventListener("hashchange", function () { setTimeout(watch, 40); });
  window.addEventListener("DOMContentLoaded", function () { setTimeout(watch, 40); });
  setTimeout(watch, 80);
})();
