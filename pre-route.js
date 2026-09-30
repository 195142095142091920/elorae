(function () {
  window.__keepHash = location.hash || "";
  window.__lockNav = true;
  setTimeout(function () { window.__lockNav = false; }, 400);
  try {
    const desc = Object.getOwnPropertyDescriptor(Location.prototype, "hash");
    if (!desc || !desc.set) return;
    Object.defineProperty(Location.prototype, "hash", {
      configurable: true,
      enumerable: desc.enumerable,
      get: desc.get,
      set: function (v) {
        const keep = window.__keepHash || "";
        const next = String(v || "");
        if (window.__lockNav && /(?:#\/)?(?:atlas|codex)(?:\/|$)/i.test(keep) && /gallery/i.test(next) && !/(atlas|codex)/i.test(next)) {
          return;
        }
        return desc.set.call(this, v);
      }
    });
  } catch (e) {}
})();
