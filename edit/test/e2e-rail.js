/* E2E: Categories rail sections (rail-sections.js, rd1): the arrow and the section title both
   toggle a section open / closed, identically, with no navigation, on the Index and article pages,
   desktop + phone, pinned + unpinned, Guest + player. Entries inside still navigate.
   Run: PLAYWRIGHT=<path> CHROME=/usr/bin/google-chrome node edit/test/e2e-rail.js */
"use strict";
const { chromium } = require(process.env.PLAYWRIGHT || "playwright");
const { serverForTests } = require("./server.js");
const results = [];
function check(name, ok, detail) { results.push({ name, ok: !!ok }); console.log((ok ? "PASS " : "FAIL ") + name + (detail ? "  — " + detail : "")); }
let BASE;
async function ctxFor(browser, who, phone, pinned) {
  const ctx = await browser.newContext(Object.assign({ viewport: phone ? { width: 390, height: 844 } : { width: 1440, height: 900 }, deviceScaleFactor: 1 }, phone ? { isMobile: true, hasTouch: true } : {}));
  await ctx.route((u) => !u.href.startsWith(BASE) && !u.href.startsWith("data:"), (r) => r.abort());
  await ctx.addInitScript(`try{${who === "guest" ? 'localStorage.removeItem("elorae-login");localStorage.setItem("elorae-guest","1");' : `localStorage.setItem("elorae-login",${JSON.stringify(who)});`}localStorage.setItem("elorae-cats-rail",JSON.stringify({pinned:${pinned},phoneOpen:${pinned}}));}catch(e){}`);
  return ctx;
}
const PAGES = ["index/ancients/", "articles/vaerek/", "articles/aghor/", "articles/fell/"];
async function openRail(p, sel, phone) {
  const open = () => p.evaluate((s) => document.querySelector(s).classList.contains("open"), sel);
  if (await open()) return true;
  if (phone) await p.click("#section-bar .sec-toggle"); else await p.evaluate(() => window.__railToggle && window.__railToggle());
  await p.waitForTimeout(350);
  return open();
}
async function press(p, phone, x, y) { if (phone) await p.touchscreen.tap(x, y); else await p.mouse.click(x, y); await p.waitForTimeout(220); }
async function matrix(browser) {
  for (const who of ["guest", "sawyer"]) for (const phone of [false, true]) for (const pinned of [true, false]) for (const pg of PAGES) {
    const ctx = await ctxFor(browser, who, phone, pinned); const p = await ctx.newPage(); const errs = []; p.on("pageerror", (e) => errs.push(e.message));
    await p.goto(BASE + pg, { waitUntil: "load" }); await p.waitForTimeout(700);
    const sel = pg.startsWith("index") ? "aside.toc.index-toc" : "#art-index";
    const railOpen = await openRail(p, sel, phone);
    const n = await p.evaluate((s) => [...document.querySelectorAll(s + " .toc-cat")].filter((b) => b.getClientRects().length && b.querySelector(".toc-tog") && b.querySelector(".toc-nest") && b.querySelector(".toc-nest").children.length).length, sel);
    const bad = [];
    for (let i = 0; i < n; i++) {
      for (const part of [".toc-tog", ".toc-row > a"]) {
        const r = await p.evaluate(([s, i, part]) => {
          const box = [...document.querySelectorAll(s + " .toc-cat")].filter((b) => b.getClientRects().length && b.querySelector(".toc-tog") && b.querySelector(".toc-nest").children.length)[i];
          const t = box.querySelector(part); const panel = box.closest("nav");
          // bring it into the panel's view without moving the page
          const pr = panel.getBoundingClientRect(), tr = t.getBoundingClientRect();
          if (tr.top < pr.top + 30 || tr.bottom > pr.bottom - 30) panel.scrollTop += tr.top - (pr.top + pr.height / 2);
          const q = t.getBoundingClientRect();
          return { x: q.left + Math.min(q.width / 2, 30), y: q.top + q.height / 2, open: box.classList.contains("open"), url: location.href };
        }, [sel, i, part]);
        await press(p, phone, r.x, r.y);
        const a = await p.evaluate(([s, i]) => { const box = [...document.querySelectorAll(s + " .toc-cat")].filter((b) => b.getClientRects().length && b.querySelector(".toc-tog") && b.querySelector(".toc-nest").children.length)[i]; const t = box.querySelector(".toc-row > a"); return { open: box.classList.contains("open"), url: location.href, ae: t.getAttribute("aria-expanded"), te: box.querySelector(".toc-tog").getAttribute("aria-expanded"), role: t.getAttribute("role") }; }, [sel, i]);
        if (a.open === r.open || a.url !== r.url || a.ae !== String(a.open) || a.te !== String(a.open) || a.role !== "button") bad.push(i + part + JSON.stringify(a));
      }
    }
    check(`rail: ${who} ${phone ? 390 : 1440} ${pinned ? "pinned" : "unpinned"} /${pg}: arrow and title each toggle every section (${n}), no navigation`, railOpen && n > 0 && !bad.length && !errs.length, bad.slice(0, 2).join(" ") + errs.join("|"));
    await ctx.close();
  }
}
async function details(browser) {
  const ctx = await ctxFor(browser, "sawyer", false, true); const p = await ctx.newPage();
  await p.goto(BASE + "articles/vaerek/", { waitUntil: "load" }); await p.waitForTimeout(600);
  const row = "#art-index .toc-cat:nth-of-type(1) .toc-row > a";
  await p.focus(row); const before = await p.evaluate((s) => document.querySelector(s).closest(".toc-cat").classList.contains("open"), row);
  await p.keyboard.press("Enter"); await p.waitForTimeout(150);
  const e1 = await p.evaluate((s) => document.querySelector(s).closest(".toc-cat").classList.contains("open"), row);
  await p.keyboard.press(" "); await p.waitForTimeout(150);
  const e2 = await p.evaluate((s) => document.querySelector(s).closest(".toc-cat").classList.contains("open"), row);
  check("rail: keyboard — Enter and Space on the section title toggle it; arrow is not a separate tab stop", e1 !== before && e2 === before && await p.evaluate(() => document.querySelector("#art-index .toc-tog").tabIndex === -1) && /\/articles\/vaerek\/$/.test(p.url()), JSON.stringify({ before, e1, e2 }));
  // An entry inside an open section still navigates.
  await p.evaluate(() => { const b = document.querySelector("#art-index .toc-cat"); if (!b.classList.contains("open")) window.EloraeRailSections.toggle(b); });
  const href = await p.evaluate(() => { const a = [...document.querySelectorAll("#art-index .toc-cat.open .toc-nest a")].find((a) => !/vaerek/.test(a.href) && a.getClientRects().length); a.scrollIntoView({ block: "center" }); return a.getAttribute("href"); });
  await Promise.all([p.waitForNavigation(), p.click(`#art-index .toc-cat.open .toc-nest a[href="${href}"]`)]);
  check("rail: an entry inside the dropdown still opens its article", new URL(p.url()).pathname === href, p.url());
  // Index: title no longer jumps (no hash, no scroll).
  await p.goto(BASE + "index/ancients/", { waitUntil: "load" }); await p.waitForTimeout(600);
  const y0 = await p.evaluate(() => scrollY);
  await p.click('#index-toc-panel .toc-cat:nth-of-type(2) .toc-row > a'); await p.waitForTimeout(500);
  const st = await p.evaluate(() => ({ y: scrollY, hash: location.hash, open: document.querySelector("#index-toc-panel .toc-cat:nth-of-type(2)").classList.contains("open") }));
  check("rail: Index section title toggles without jumping to the section", st.y === y0 && !st.hash && st.open, JSON.stringify(st));
  await p.evaluate(() => scrollTo(0, 3000)); await p.waitForTimeout(500);
  check("rail: Index scrolling does not reset an opened section", await p.evaluate(() => document.querySelector("#index-toc-panel .toc-cat:nth-of-type(2)").classList.contains("open")));
  await ctx.close();
}

async function sync(browser) {
  // Static: every article rail lists each Index section's entries, with an arrow when it has any.
  const fs = require("fs"), path = require("path"), ROOT = path.resolve(__dirname, "../..");
  const ctx = await ctxFor(browser, "devin", false, true); const p = await ctx.newPage();
  await p.goto(BASE + "index/ancients/", { waitUntil: "load" });
  const idx = await p.evaluate(() => [...document.querySelectorAll("#index-toc-panel > .toc-cat")].map((b) => [b.querySelector(".toc-row > a").getAttribute("href").slice(1), b.querySelectorAll(".toc-nest a.toc-name").length]));
  const bad = [];
  for (const d of fs.readdirSync(path.join(ROOT, "articles"))) {
    const f = path.join(ROOT, "articles", d, "index.html"); if (!fs.existsSync(f)) continue;
    const T = fs.readFileSync(f, "utf8"); const m = /<nav class="art-index-panel"[\s\S]*?<\/nav>/.exec(T); if (!m) continue;
    const C = path.join(ROOT, "articles", d + ".html");
    if (fs.existsSync(C) && fs.readFileSync(C, "utf8") !== T) bad.push(d + ": copies differ");
    for (const [sec, n] of idx) {
      const re = new RegExp('<div class="toc-cat[^"]*"><div class="toc-row"><a class="[^"]*" href="/index/ancients/#' + sec + '">[^<]*</a>(<button[^>]*class="toc-tog")?[\\s\\S]*?(?=<div class="toc-cat|</nav>)');
      const b = re.exec(m[0]); if (!b) { bad.push(d + ": no " + sec); continue; }
      const k = (b[0].match(/class="toc-name[^"]*"/g) || []).length;
      if (k !== n || (n > 0) !== !!b[1]) bad.push(`${d}: ${sec} ${k}/${n} arrow ${!!b[1]}`);
    }
  }
  check("rail sync: every article page (both copies) lists each Index section's entries, with an arrow when it has any (Divines included)", !bad.length && idx.some(([s, n]) => s === "divines" && n >= 33), bad.slice(0, 4).join(" | "));
  // Runtime: a stale article rail (no Divines entries) is refreshed from the Index.
  const f = path.join(ROOT, "articles/vaerek/index.html");
  const stale = fs.readFileSync(f, "utf8").replace(/(<a class="" href="\/index\/ancients\/#divines">Divines<\/a>)<button[\s\S]*?<\/button><\/div><div class="toc-nest">[\s\S]*?<\/div><\/div>/, "$1</div></div>");
  for (const who of ["sawyer", "devin"]) {
    const c2 = await ctxFor(browser, who, false, true); const q = await c2.newPage(); const errs = []; q.on("pageerror", (e) => errs.push(e.message));
    await q.route(BASE + "articles/vaerek/", (r) => r.fulfill({ status: 200, contentType: "text/html", body: stale }));
    await q.goto(BASE + "articles/vaerek/", { waitUntil: "load" });
    const before = await q.evaluate(() => { const r = [...document.querySelectorAll("#art-index .toc-row > a")].find((a) => /#divines$/.test(a.getAttribute("href"))); return !!r.parentElement.querySelector(".toc-tog"); });
    await q.waitForFunction(() => { const r = [...document.querySelectorAll("#art-index .toc-row > a")].find((a) => /#divines$/.test(a.getAttribute("href"))); return r && r.parentElement.querySelector(".toc-tog"); }, null, { timeout: 8000 }).catch(() => {});
    const r = await q.evaluate(() => {
      const row = [...document.querySelectorAll("#art-index .toc-row > a")].find((a) => /#divines$/.test(a.getAttribute("href")));
      const box = row.closest(".toc-cat");
      const vis = (s) => [...document.querySelectorAll("#art-index " + s)].filter((a) => getComputedStyle(a).display !== "none" && !a.closest(".private-group[style*='none']")).length;
      const priv = [...document.querySelectorAll("#art-index a.toc-name.private[data-owner='devin']")];
      return { tog: !!box.querySelector(".toc-tog"), n: box.querySelectorAll(".toc-nest a.toc-name").length, first: (box.querySelector(".toc-nest a") || {}).getAttribute && box.querySelector(".toc-nest a").getAttribute("href"), on: (document.querySelector("#art-index .toc-cat.open .toc-name.on") || {}).textContent, privShown: priv.filter((a) => a.getClientRects().length > 0 || getComputedStyle(a).display !== "none").length, priv: priv.length, role: row.getAttribute("role") };
    });
    await q.click('#art-index .toc-row > a[href="/index/ancients/#divines"]'); await q.waitForTimeout(200);
    const opened = await q.evaluate(() => document.querySelector('#art-index .toc-row > a[href="/index/ancients/#divines"]').closest(".toc-cat").classList.contains("open"));
    const privOk = who === "devin" ? r.privShown === r.priv : r.privShown === 0;
    check(`rail sync (${who}): a stale article rail is refreshed from the Index — Divines gets its ${r.n} entries and arrow, toggles, current article still marked, private entries only for their owner`, !before && r.tog && r.n >= 33 && /^\/articles\//.test(r.first) && r.on === "Vaerek Rathkin" && r.role === "button" && opened && r.priv > 0 && privOk && !errs.length, JSON.stringify(Object.assign(r, { opened, errs })));
    await c2.close();
  }
  await ctx.close();
}
(async () => {
  const srv = await serverForTests(); BASE = srv.base;
  const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ["--no-sandbox"] });
  try {
    for (const [n, fn] of [["matrix", matrix], ["details", details], ["sync", sync]]) {
      try { await fn(browser); } catch (e) { check(n + " stage ran without exceptions", false, e.stack.split("\n").slice(0, 3).join(" ")); }
    }
  } finally { await browser.close(); srv.close(); }
  const fail = results.filter((r) => !r.ok);
  console.log(`\n${results.length - fail.length}/${results.length} passed`);
  process.exit(fail.length ? 1 : 0);
})();
