/* E2E: Back / Forward returns to the previous scroll position (back-scroll.js, bs1).
   Run: PLAYWRIGHT=<path> CHROME=/usr/bin/google-chrome node edit/test/e2e-backscroll.js */
"use strict";
const { chromium } = require(process.env.PLAYWRIGHT || "playwright");
const { serverForTests } = require("./server.js");
const results = [];
function check(name, ok, detail) { results.push({ name, ok: !!ok }); console.log((ok ? "PASS " : "FAIL ") + name + (detail ? "  — " + detail : "")); }
let BASE;
async function ctxFor(browser, who, vp, extra) {
  const ctx = await browser.newContext(Object.assign({ viewport: vp || { width: 1440, height: 900 }, deviceScaleFactor: 1 }, extra || {}));
  await ctx.route((u) => !u.href.startsWith(BASE) && !u.href.startsWith("data:"), (r) => r.abort());
  if (who === "guest") await ctx.addInitScript(`try{localStorage.removeItem("elorae-login");localStorage.setItem("elorae-guest","1");}catch(e){}`);
  else await ctx.addInitScript(`try{localStorage.setItem("elorae-login",${JSON.stringify(who)});document.cookie="elorae-login=${who};path=/";}catch(e){}`);
  return ctx;
}
const PHONE = [{ width: 390, height: 844 }, { hasTouch: true, isMobile: true }];
const y = (p) => p.evaluate(() => Math.round(scrollY));
async function roundTrip(p, page, Y, leave) {
  await p.goto(BASE + page, { waitUntil: "load" }); await p.waitForTimeout(700);
  await p.evaluate((v) => scrollTo(0, v), Y); await p.waitForTimeout(250);
  const y0 = await y(p);
  if (leave) await leave(p);
  else await Promise.all([p.waitForNavigation(), p.evaluate(() => { location.href = "/articles/vaerek/"; })]);
  await p.waitForTimeout(500);
  await p.goBack({ waitUntil: "load" }); await p.waitForTimeout(1900);
  return { y0, y1: await y(p), url: await p.evaluate(() => location.pathname) };
}
async function cases(browser) {
  const runs = [
    ["guest", "index/ancients/", 2400, null], ["sawyer", "index/ancients/", 2400, null], ["guest", "index/ancients/", 2400, PHONE],
    ["sawyer", "journal/", 3000, null], ["sawyer", "journal/", 3000, PHONE], ["guest", "codex/lore/", 3000, PHONE],
    // Jason's Ghostly Wanderer pages set scrollRestoration = "manual" (in-page tabs): these came back at the top.
    ["jason", "journal/ghostly-wanderer/heldrancs-tale/", 3000, null], ["jason", "journal/ghostly-wanderer/heldrancs-tale/", 3000, PHONE],
  ];
  for (const [who, page, Y, vp] of runs) {
    const ctx = await ctxFor(browser, who, vp ? vp[0] : null, vp ? vp[1] : null); const p = await ctx.newPage();
    const r = await roundTrip(p, page, Y);
    check(`back: ${who} ${vp ? 390 : 1440} /${page} returns to where you were`, r.y0 > 0 && Math.abs(r.y1 - r.y0) <= 2 && r.url === "/" + page, JSON.stringify(r));
    await ctx.close();
  }
}
async function peekCase(browser) {
  for (const vp of [null, PHONE]) {
    const ctx = await ctxFor(browser, "sawyer", vp ? vp[0] : null, vp ? vp[1] : null); const p = await ctx.newPage(); const errs = []; p.on("pageerror", (e) => errs.push(e.message));
    const r = await roundTrip(p, "index/ancients/", 1500, async (p) => {
      const pt = await p.evaluate(() => { const a = [...document.querySelectorAll("main a.index-card")].find((a) => { const r = a.getBoundingClientRect(); const e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return r.top > 120 && r.bottom < innerHeight - 20 && e && a.contains(e); }); const b = a.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; });
      if (vp) await p.touchscreen.tap(pt.x, pt.y); else await p.mouse.click(pt.x, pt.y);
      await p.waitForSelector("#peek.peek-open"); await p.waitForTimeout(350);
      check(`back+peek ${vp ? 390 : 1440}: opening the peek does not move the page`, Math.abs((await y(p)) - 1500) <= 2, String(await y(p)));
      await Promise.all([p.waitForNavigation(), p.click("#peek .peek-read")]);
    });
    const open = await p.evaluate(() => !!document.querySelector("#peek.peek-open"));
    check(`back+peek ${vp ? 390 : 1440}: Back from the full article lands on the Index at the same place, peek closed`, Math.abs(r.y1 - r.y0) <= 2 && r.url === "/index/ancients/" && !open, JSON.stringify(r));
    await p.goto(BASE + "index/ancients/", { waitUntil: "load" }); await p.waitForTimeout(400);
    await p.click('main a.index-card[href="/articles/vaerek/"]'); await p.waitForSelector("#peek.peek-open");
    await p.goBack(); await p.waitForTimeout(300);
    check(`back+peek ${vp ? 390 : 1440}: Back still just closes an open peek`, await p.evaluate(() => !document.querySelector("#peek.peek-open") && location.pathname === "/index/ancients/"));
    check(`back+peek ${vp ? 390 : 1440}: no page errors`, errs.length === 0, errs.join(" | "));
    await ctx.close();
  }
}
async function skips(browser) {
  const ctx = await ctxFor(browser, "sawyer"); const p = await ctx.newPage();
  await p.goto(BASE + "index/ancients/", { waitUntil: "load" }); await p.evaluate(() => scrollTo(0, 2000)); await p.waitForTimeout(200);
  await Promise.all([p.waitForNavigation(), p.evaluate(() => { location.href = "/articles/vaerek/"; })]);
  await p.goto(BASE + "index/ancients/", { waitUntil: "load" }); await p.waitForTimeout(1900);
  check("back: a fresh visit (link / typed URL, not Back) starts at the top", (await y(p)) === 0, String(await y(p)));
  const saved = await p.evaluate(() => sessionStorage.getItem("elorae-scroll:/index/ancients/"));
  check("back: position is kept per page in sessionStorage", !!saved && /"y":\d+/.test(saved), saved);
  // User scrolls during the restore window: we stop fighting them.
  await p.evaluate(() => scrollTo(0, 2000)); await p.waitForTimeout(200);
  await Promise.all([p.waitForNavigation(), p.evaluate(() => { location.href = "/articles/vaerek/"; })]);
  await p.goBack({ waitUntil: "domcontentloaded" }); await p.mouse.move(700, 500); await p.mouse.wheel(0, -600); await p.waitForTimeout(1900);
  const yy = await y(p);
  check("back: a wheel scroll during restore wins (no snapping back)", yy < 1900, String(yy));
  await ctx.close();
}
(async () => {
  const srv = await serverForTests(); BASE = srv.base;
  const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ["--no-sandbox"] });
  try {
    for (const [n, fn] of [["cases", cases], ["peek", peekCase], ["skips", skips]]) {
      try { await fn(browser); } catch (e) { check(n + " stage ran without exceptions", false, e.stack.split("\n").slice(0, 3).join(" ")); }
    }
  } finally { await browser.close(); srv.close(); }
  const fail = results.filter((r) => !r.ok);
  console.log(`\n${results.length - fail.length}/${results.length} passed`);
  process.exit(fail.length ? 1 : 0);
})();
