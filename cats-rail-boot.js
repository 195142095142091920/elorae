/* Categories rail: restore pinned/phone-open from localStorage before first paint.
   Default (no saved state): open. Shared by Index (aside.toc) and articles (.art-index). */
(function () {
  var KEY = "elorae-cats-rail";
  var pinned = true;
  var phoneOpen = true;
  try {
    var raw = localStorage.getItem(KEY);
    if (raw) {
      var o = JSON.parse(raw);
      if (o && typeof o.pinned === "boolean") pinned = o.pinned;
      if (o && typeof o.phoneOpen === "boolean") phoneOpen = o.phoneOpen;
    }
  } catch (e) {}
  window.__catsRail = { key: KEY, pinned: pinned, phoneOpen: phoneOpen };
  var h = document.documentElement;
  h.classList.add("cats-rail-boot");
  if (pinned) h.classList.add("cats-rail-pinned");
  else h.classList.remove("cats-rail-pinned");
  if (phoneOpen) h.classList.add("cats-rail-phone-open");
  else h.classList.remove("cats-rail-phone-open");
})();
