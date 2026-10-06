/* Skip link (nt11). Loaded in <head> on every content page. Prepends a visually hidden
   "Skip to content" link as the first focusable element of <body>; it appears only while it
   has keyboard focus, as bare nav-grey text on the nav's own #070707 at the top-left, above
   the chrome. Enter moves focus (and the view) to the page's content: the article hero /
   title on articles, otherwise <main>. Outside main (never an edit/ block). */
(function () {
  function init() {
    if (document.getElementById("nt-skip")) return;
    var target = document.querySelector("body.article .art-hero") || document.querySelector("main");
    if (!target) return;
    var css = document.createElement("style");
    css.id = "nt-skip-css";
    css.textContent =
      "#nt-skip{position:fixed;left:0;top:0;z-index:10000;transform:translateY(-120%);opacity:0;pointer-events:none;" +
      "background:#070707;color:#f3eee6;font-family:Helvetica,Arial,sans-serif;font-size:12px;font-weight:400;letter-spacing:.14em;" +
      "text-transform:uppercase;text-decoration:none;border:0;outline:none}" +
      "#nt-skip:focus,#nt-skip:focus-visible{transform:none;opacity:1;pointer-events:auto;text-decoration:underline;text-underline-offset:4px}" +
      "@media (min-width:801px){#nt-skip{padding:18px 24px}}" +
      "@media (max-width:800px){#nt-skip{padding:14px 16px calc(14px) calc(16px + env(safe-area-inset-left))}}" +
      "[data-nt-skip-target]:focus{outline:none}";
    document.head.appendChild(css);
    var a = document.createElement("a");
    a.id = "nt-skip";
    a.href = "#";
    a.textContent = "Skip to content";
    a.addEventListener("click", function (e) {
      e.preventDefault();
      if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
      target.setAttribute("data-nt-skip-target", "");
      target.focus({ preventScroll: true });
      var top = target.getBoundingClientRect().top + window.scrollY;
      var main = document.querySelector("main");
      if (target === document.querySelector("body.article .art-hero")) top = 0;
      else if (main && target === main) top = Math.max(0, top - (parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--rail-top")) || 0));
      window.scrollTo({ top: top, behavior: "auto" });
    });
    document.body.insertBefore(a, document.body.firstChild);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
