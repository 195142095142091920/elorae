/* Ghostly Wanderer tabs: switch in place. Each tab is a normal page; the other tabs are fetched
   once in the background (same-origin, cached by the browser) and parsed. A click on another tab
   swaps the content area (main + the tab's own Contents entries + active tab + title) from memory
   and updates the URL with history.pushState. Back/forward swap the same way. A tab not fetched
   yet is fetched on click (still no full reload); on any error the link just navigates. Paused
   while edit mode is on (html.ee-editing). */
(function () {
  if (window.__gwSwap) return; window.__gwSwap = 1;
  var BASE = "/journal/ghostly-wanderer/";
  var TABS = ["my-tale", "heldrancs-tale", "the-dark", "the-demonic-lords", "the-glaurfeldt", "reference"].map(function (s) { return BASE + s + "/"; });
  function norm(p) {
    try { p = decodeURI(p); } catch (e) {}
    p = p.replace(/\/index\.html$/i, "/").replace(/\.html$/i, "/");
    if (p.charAt(p.length - 1) !== "/") p += "/";
    return p === BASE ? TABS[0] : p;
  }
  var parsed = {}, loading = {};
  function parse(html) {
    var d = new DOMParser().parseFromString(html, "text/html");
    var main = d.querySelector("main.read");
    if (!main) return null;
    return { title: d.title, mainClass: main.className, main: main, side: Array.prototype.slice.call(d.querySelectorAll("aside.toc [data-gwt]")) };
  }
  function load(path) {
    if (parsed[path]) return Promise.resolve(parsed[path]);
    if (!loading[path]) loading[path] = fetch(path, { credentials: "same-origin" }).then(function (r) {
      if (!r.ok) throw new Error(r.status); return r.text();
    }).then(function (t) { var p = parse(t); if (!p) throw new Error("no main"); return (parsed[path] = p); })
      .catch(function (e) { delete loading[path]; throw e; });
    return loading[path];
  }
  var cur = norm(location.pathname);
  parsed[cur] = null; // the page itself is already shown
  function render(path, p, hash, scrollTo) {
    var main = document.querySelector("main.read"); if (!main) return false;
    if (window.gwLightboxClose) window.gwLightboxClose();
    main.className = p.mainClass;
    main.replaceChildren.apply(main, Array.prototype.map.call(p.main.childNodes, function (n) { return document.importNode(n, true); }));
    var old = document.querySelectorAll("aside.toc [data-gwt]");
    var par = old.length ? old[0].parentNode : document.querySelector("aside.toc .toc-list"), at = old.length ? old[old.length - 1].nextSibling : null;
    if (par) {
      Array.prototype.forEach.call(old, function (n) { n.remove(); });
      p.side.forEach(function (n) { par.insertBefore(document.importNode(n, true), at); });
    }
    var bar = document.getElementById("section-bar");
    if (bar) {
      Array.prototype.forEach.call(bar.querySelectorAll("a"), function (a) { a.classList.toggle("active", norm(a.getAttribute("href")) === path); });
      var on = bar.querySelector("a.active");
      if (on && bar.scrollWidth > bar.clientWidth) bar.scrollLeft = Math.max(0, on.offsetLeft - (bar.clientWidth - on.offsetWidth) / 2);
    }
    document.title = p.title;
    cur = path;
    if (window.gwLightboxMark) window.gwLightboxMark();
    var t = hash && hash.length > 1 && document.getElementById(decodeURIComponent(hash.slice(1)));
    if (t) t.scrollIntoView(); else window.scrollTo(0, scrollTo || 0);
    return true;
  }
  // After the URL is updated, so listeners (edit mode's page path) see the new page.
  function swapped(path) { window.dispatchEvent(new CustomEvent("elorae-content-swapped", { detail: { path: path } }));
  }
  function editing() { return document.documentElement.classList.contains("ee-editing"); }
  try { history.scrollRestoration = "manual"; } catch (e) {}
  history.replaceState(Object.assign({}, history.state, { gw: cur, y: window.scrollY }), "");
  var saveT = 0;
  window.addEventListener("scroll", function () {
    clearTimeout(saveT);
    saveT = setTimeout(function () { try { history.replaceState(Object.assign({}, history.state, { gw: cur, y: window.scrollY }), ""); } catch (e) {} }, 120);
  }, { passive: true });
  document.addEventListener("click", function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target.closest && e.target.closest("a[href]");
    if (!a || (a.target && a.target !== "_self") || a.hasAttribute("download")) return;
    var u; try { u = new URL(a.getAttribute("href"), location.href); } catch (x) { return; }
    if (u.origin !== location.origin) return;
    var path = norm(u.pathname);
    if (TABS.indexOf(path) < 0 || editing()) return;
    if (path === cur) { if (!u.hash) { e.preventDefault(); window.scrollTo(0, 0); } return; }
    e.preventDefault();
    try { history.replaceState(Object.assign({}, history.state, { gw: cur, y: window.scrollY }), ""); } catch (x) {}
    var go = function (p) { if (render(path, p, u.hash, 0)) { history.pushState({ gw: path, y: 0 }, "", u.pathname + u.hash); swapped(path); } else location.href = u.href; };
    if (parsed[path]) go(parsed[path]);
    else load(path).then(go, function () { location.href = u.href; });
  });
  window.addEventListener("popstate", function (e) {
    var path = norm(location.pathname);
    if (TABS.indexOf(path) < 0 || path === cur) return;
    if (editing()) { location.reload(); return; }
    var y = (e.state && e.state.y) || 0;
    load(path).then(function (p) { if (render(path, p, "", y)) swapped(path); else location.reload(); }, function () { location.reload(); });
  });
  /* fetch + parse the other tabs ahead, so every click is instant */
  var idle = window.requestIdleCallback || function (f) { setTimeout(f, 300); };
  idle(function () { TABS.filter(function (p) { return p !== cur; }).reduce(function (q, p) { return q.then(function () { return load(p).catch(function () {}); }); }, Promise.resolve()); });
})();
