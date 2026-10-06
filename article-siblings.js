/* Article siblings (nt10). Loaded with ?v= on articles/*.html. "‹ Saoirse   Perstrin Naba ›" at the foot of an
   article, linking the previous / next article in the same Index category, read from the
   article's own Categories rail (aside.art-index: the category holding the current
   a.toc-name.on, preferring the open category; a Factions sub-group counts as its own list).
   Renders as a <nav>
   appended at the end of main.art-body (edit/ skips <nav>, so it is never an editable block).
   Sealed entries (.sealed, .sealed-group, any [data-owner] link) are skipped for every reader,
   unlocked or not, and nothing is rendered on a sealed article itself. */
(function () {
  if (!document.body.classList.contains("article")) return;
  var main = document.querySelector("main.art-body");
  var on = document.querySelector("aside.art-index .toc-cat.open a.toc-name.on") || document.querySelector("aside.art-index a.toc-name.on");
  if (!main || !on || document.querySelector(".nt-siblings")) return;
  var group = on.closest(".toc-group") || on.closest(".toc-nest") || on.closest(".toc-cat");
  if (!group) return;
  /* Sealed entries are never used, for anyone: the site gates them with CSS only
     (body.seal-<owner>), so their titles must not be copied into a visible element. */
  function publicLink(a) {
    return !a.closest(".sealed,.sealed-group,[hidden]") && !a.hasAttribute("data-owner");
  }
  var links = Array.prototype.slice.call(group.querySelectorAll("a.toc-name")).filter(publicLink);
  var i = links.indexOf(on);
  if (on.closest(".sealed,.sealed-group") || on.hasAttribute("data-owner") || i < 0 || links.length < 2) return;
  var prev = links[i - 1], next = links[i + 1];
  var css = document.createElement("style");
  css.textContent =
    ".nt-siblings{display:flex;justify-content:space-between;gap:24px}" +
    ".nt-siblings a{font-family:Helvetica,Arial,sans-serif;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#8f8a82;text-decoration:none}" +
    ".nt-siblings a:hover,.nt-siblings a:focus-visible{color:#f3eee6;outline:none}" +
    ".nt-siblings .nt-next{margin-left:auto}" +
    "@media (min-width:801px){.nt-siblings{margin:40px 0 24px}}" +
    "@media (max-width:800px){.nt-siblings{margin:32px 0 16px}.nt-siblings a{padding:8px 0}}";
  document.head.appendChild(css);
  var nav = document.createElement("nav");
  nav.className = "nt-siblings"; nav.setAttribute("aria-label", "More in this category");
  function mk(a, cls, txt, rel) { var x = document.createElement("a"); x.href = a.href; x.className = cls; x.rel = rel; x.textContent = txt; nav.appendChild(x); }
  if (prev) mk(prev, "nt-prev", "\u2039\u2002" + prev.textContent.trim(), "prev");
  if (next) mk(next, "nt-next", next.textContent.trim() + "\u2002\u203a", "next");
  var ref = main.querySelector("section.art-sec:last-of-type");
  if (ref) { var rc = getComputedStyle(ref); nav.style.maxWidth = rc.maxWidth; nav.style.marginLeft = rc.marginLeft === "0px" ? "" : "auto"; nav.style.marginRight = nav.style.marginLeft; nav.style.paddingLeft = rc.paddingLeft; nav.style.paddingRight = rc.paddingRight; }
  main.appendChild(nav);
})();
