/* calendar-timeline.js (nt18), on codex/calendar.html. A timeline view built only from real
   site data, injected at runtime:
     - the Valoran year to scale (8 months of 50 days plus the 7 days of Godfall), with each
       month's season and its "so named for" line, all read from this page itself;
     - the eras and their dated events, read from codex/timeline.html.
   No example data and no chapter ticks: the site does not record an in-world date per chapter
   yet. Lives in an <aside> at the end of main, which edit mode's srcmap skips, and is not
   built at all during an edit session. */
(function () {
  "use strict";
  var main = document.querySelector("main.read"); if (!main || document.getElementById("nt-timeline")) return;
  var ROOT = new URL("./", document.currentScript.src).href;
  function editing() {
    try { if (sessionStorage.getItem("elorae-edit-session") || localStorage.getItem("elorae-edit-session")) return true; } catch (e) {}
    return /(^|#)edit\b/.test(location.hash) || document.documentElement.classList.contains("ee-editing");
  }
  if (editing()) return;
  var DAYS = { Godfall: 7 };
  function text(n) { return n ? n.textContent.replace(/\s+/g, " ").trim() : ""; }
  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }

  var months = [], season = "", inMonths = false, yearLine = "";
  Array.prototype.forEach.call(main.children, function (n) {
    if (n.tagName === "H2") inMonths = /months/i.test(text(n));
    else if (inMonths && n.tagName === "H3") season = text(n);
    else if (inMonths && n.tagName === "P") {
      var m = /^(?:\d+\.\s*)?([A-Z][a-z]+), (so named for .*)$/.exec(text(n));
      if (m) months.push({ name: m[1], season: season, why: m[2], days: DAYS[m[1]] || 50 });
    }
    if (n.tagName === "P" && !yearLine) { var y = /Year (V-\d+) is the (Year of [A-Z][a-z]+)/.exec(text(n)); if (y) yearLine = y[1] + " \u00b7 the " + y[2]; }
  });
  if (months.length < 9) return;

  var css = document.createElement("style");
  css.id = "nt-timeline-css";
  css.textContent =
    "#nt-timeline{margin-top:64px}" +
    "#nt-timeline .nt-tl-kicker{font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#8f8a82;text-align:center}" +
    ".nt-tl-year{position:relative;display:flex;margin:26px 0 0;border-bottom:1px solid rgba(243,238,230,.25)}" +
    ".nt-tl-month{flex:50 1 0;min-width:0;background:none;border:0;border-left:1px solid rgba(243,238,230,.22);color:#c9c2b6;padding:4px 6px 10px;text-align:left;cursor:pointer;font-family:inherit}" +
    ".nt-tl-month.on,.nt-tl-month:focus-visible{color:#fff;outline:none}" +
    ".nt-tl-month.is-godfall{color:#b08f5a;text-align:center;padding-left:0;padding-right:0}" +
    ".nt-tl-mname{display:block;font-size:13px;letter-spacing:.06em;white-space:nowrap;overflow:hidden;text-overflow:clip}" +
    ".nt-tl-mfull{display:none}" +
    ".nt-tl-mseason{display:block;white-space:nowrap;overflow:hidden;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:#8f8a82}" +
    "#nt-timeline .nt-tl-detail{min-height:1.6em;font-size:15px;font-style:italic;color:#d9d2c6;margin:14px 0 6px}" +
    "#nt-timeline h3{font-weight:400;font-style:italic;margin:40px 0 10px}" +
    ".nt-tl-era{margin:0 0 18px}" +
    "#nt-timeline .nt-tl-era-name{margin:0 0 4px;font-size:15px}" +
    ".nt-tl-era-name .k{display:inline-block;width:2.4em;color:#8f8a82;letter-spacing:.1em}" +
    ".nt-tl-era-name .y{float:right;font-size:12px;color:#8f8a82}" +
    ".nt-tl-era-bar{position:relative;height:12px;border-bottom:1px solid rgba(243,238,230,.25);margin:0 0 6px 2.4em}" +
    ".nt-tl-ev{position:absolute;bottom:-1px;width:1px;height:10px;background:#f3eee6}" +
    "#nt-timeline .nt-tl-ev-line a{color:inherit}#nt-timeline .nt-tl-ev-line{margin:0 0 2px 2.4em;font-size:14px;line-height:1.5;color:#d9d2c6}" +
    ".nt-tl-ev-line .w{display:inline-block;min-width:4.6em;color:#8f8a82;font-size:12px;letter-spacing:.06em}" +
    "@media (min-width:801px){.nt-tl-month:hover{color:#fff}}" +
    "@media (max-width:800px){.nt-tl-year{flex-direction:column;border-bottom:0}" +
    ".nt-tl-month{border-left:0;border-top:1px solid rgba(243,238,230,.18);padding:8px 0;display:flex;justify-content:space-between}" +
    ".nt-tl-mname{display:none}.nt-tl-mfull{display:block;font-size:14px}" +
    "#nt-timeline .nt-tl-ev-line{padding-left:58px;text-indent:-58px}.nt-tl-ev-line .w{text-indent:0;min-width:0;width:58px}}";
  document.head.appendChild(css);

  var sec = el("aside", "nt-tl"); sec.id = "nt-timeline"; sec.setAttribute("aria-label", "Timeline");
  sec.appendChild(el("h2", null, "Timeline"));
  if (yearLine) sec.appendChild(el("div", "nt-tl-kicker", yearLine));
  main.appendChild(sec);

  var strip = el("div", "nt-tl-year"); sec.appendChild(strip);
  var detail = el("div", "nt-tl-detail"); detail.setAttribute("aria-live", "polite");
  months.forEach(function (m) {
    var seg = el("button", "nt-tl-month" + (m.days < 50 ? " is-godfall" : "")); seg.type = "button";
    seg.style.flexGrow = m.days;
    seg.appendChild(el("span", "nt-tl-mname", m.days < 50 ? "\u2726" : m.name));
    seg.appendChild(el("span", "nt-tl-mfull", m.name));
    seg.appendChild(el("span", "nt-tl-mseason", m.days < 50 ? "" : m.season));
    seg.title = m.name;
    seg.addEventListener("click", function () {
      Array.prototype.forEach.call(strip.querySelectorAll(".nt-tl-month"), function (s) { s.classList.toggle("on", s === seg); });
      detail.textContent = m.name + ", " + m.why + " (" + m.days + " days)";
    });
    strip.appendChild(seg);
  });
  sec.appendChild(detail);

  sec.appendChild(el("h3", null, "Eras and dated events"));
  var eraSec = el("div", "nt-tl-eras"); sec.appendChild(eraSec);
  fetch(ROOT + "codex/timeline.html").then(function (r) { return r.text(); }).then(function (t) {
    var d = new DOMParser().parseFromString(t, "text/html");
    var eraBlocks = d.querySelectorAll("section.tl-era-block");
    var dateList = d.querySelector("ul.timeline-list");
    if (!eraBlocks.length || !dateList) return;
    var eras = Array.prototype.map.call(eraBlocks, function (block) {
      var yrs = text(block.querySelector(".era-years")), m = /to\s+[0IVX]+-~?(\d+)|\[[IVX]+-(\d+)\]/.exec(yrs);
      var v = /\[V-(\d+)\]/.exec(yrs), len = v ? Number(v[1]) : m ? Number(m[1] || m[2]) : 0;
      var a = block.querySelector("a.tl-era-name, a[href]");
      return { key: text(block.querySelector(".tl-when")) || block.getAttribute("data-era-key") || "", name: text(a), href: a ? a.getAttribute("href") : "", years: yrs, len: len };
    });
    var events = Array.prototype.map.call(dateList.querySelectorAll("li"), function (li) {
      var w = text(li.querySelector(".tl-when")), m = /^([0IVX]+)-(\d+)$/.exec(w), what = li.querySelector(".tl-what");
      if (!m || !what) return null;
      /* keep the event's own words and inline links; drop only the trailing source links */
      what = what.cloneNode(true);
      for (var last = what.lastChild; last; last = what.lastChild) {
        if (last.nodeType === 3 && /^[\s\u00b7]*$/.test(last.nodeValue)) { last.remove(); continue; }
        if (last.nodeType === 1 && last.tagName === "A" && last.previousSibling && last.previousSibling.nodeType === 3 &&
            /(\.|\u00b7)\s*$/.test(last.previousSibling.nodeValue)) { last.remove(); continue; }
        break;
      }
      Array.prototype.forEach.call(what.querySelectorAll("a[href]"), function (a) { a.href = new URL(a.getAttribute("href"), ROOT + "codex/timeline.html").href; });
      return { era: m[1], year: Number(m[2]), when: w, what: text(what), node: what };
    }).filter(Boolean);
    eras.forEach(function (e) {
      var row = el("div", "nt-tl-era"); eraSec.appendChild(row);
      var head = el("div", "nt-tl-era-name"); head.appendChild(el("span", "k", e.key));
      head.appendChild(document.createTextNode(" " + e.name)); head.appendChild(el("span", "y", e.years)); row.appendChild(head);
      var bar = el("div", "nt-tl-era-bar"); bar.setAttribute("aria-hidden", "true"); row.appendChild(bar);
      events.filter(function (v) { return v.era === e.key; }).forEach(function (v) {
        var tk = el("span", "nt-tl-ev"); tk.style.left = (e.len ? Math.min(100, 100 * v.year / e.len) : 0) + "%";
        tk.title = v.when + " \u00b7 " + v.what; bar.appendChild(tk);
        var item = el("div", "nt-tl-ev-line"); item.appendChild(el("span", "w", v.when)); item.appendChild(document.createTextNode(" "));
        while (v.node.firstChild) item.appendChild(v.node.firstChild);
        row.appendChild(item);
      });
    });
  }).catch(function () {});
  window.addEventListener("elorae-edit-session", function () { sec.remove(); });
})();
