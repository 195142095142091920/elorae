/* E2E: View full art (full-art.js, fa1) on article pages.
   Run: PLAYWRIGHT=<path> CHROME=/usr/bin/google-chrome node edit/test/e2e-fullart.js  (SHOTS=dir for screenshots) */
"use strict";
const { chromium } = require(process.env.PLAYWRIGHT || "playwright");
const { serverForTests } = require("./server.js");
const SHOTS = process.env.SHOTS || "";
const results = [];
function check(name, ok, detail) { results.push({ name, ok: !!ok }); console.log((ok ? "PASS " : "FAIL ") + name + (detail ? "  — " + detail : "")); }
let BASE;
async function ctxFor(browser, phone) {
  const ctx = await browser.newContext(Object.assign({ viewport: phone ? { width: 390, height: 844 } : { width: 1440, height: 900 }, deviceScaleFactor: 1 }, phone ? { isMobile: true, hasTouch: true } : {}));
  await ctx.route((u) => !u.href.startsWith(BASE) && !u.href.startsWith("data:"), (r) => r.abort());
  await ctx.addInitScript(`try{localStorage.setItem("elorae-login","sawyer");localStorage.setItem("elorae-cats-rail",JSON.stringify({pinned:true,phoneOpen:false}));}catch(e){}`);
  return ctx;
}
const geo = (p) => p.evaluate(() => {
  const q = (s) => { const e = document.querySelector(s); if (!e || !e.getClientRects().length) return null; const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height }; };
  const b = document.querySelector(".art-full-btn");
  return { btn: q(".art-full-btn"), op: b ? +getComputedStyle(b).opacity : null, img: q("section.art-hero > img"), others: ["section.art-hero .art-title h1", "section.art-hero .art-epithet", ".art-swap-thumbs", ".art-swap .art-prev", ".art-swap .art-next", "#art-index-panel", ".mast", "#section-bar"].map((s) => [s, q(s)]).filter((x) => x[1]), label: b ? b.textContent.trim() : "", vh: b ? b.querySelector(".vh").getBoundingClientRect().width : null };
});
const hit = (a, b) => a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;
const st = (p) => p.evaluate(() => { const x = document.getElementById("art-full"); const im = x && x.querySelector("img"); return { open: !!(x && !x.hidden), src: im ? im.getAttribute("src") : "", fit: im ? getComputedStyle(im).objectFit : "", bg: x ? getComputedStyle(x).backgroundColor : "", url: location.pathname, hl: history.length, cover: x ? (() => { const r = x.getBoundingClientRect(); return r.width === innerWidth && r.height === innerHeight; })() : false }; });
async function desktop(browser) {
  const ctx = await ctxFor(browser, false); const p = await ctx.newPage(); const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  await p.goto(BASE + "articles/vaerek/", { waitUntil: "load" }); await p.waitForTimeout(900);
  await p.mouse.move(700, 880);
  const g = await geo(p);
  const clash = g.btn ? g.others.filter((o) => hit(g.btn, o[1])).map((o) => o[0]) : ["no button"];
  check("full art: a ~28px icon in the hero's top right, clear of title, thumbnails, arrows, rail and nav", g.btn && Math.round(g.btn.w) === 28 && Math.round(g.btn.h) === 28 && g.btn.r <= 1440 - 8 && g.btn.t >= 56 + 4 && !clash.length, JSON.stringify({ btn: g.btn, clash }));
  check("full art: hero size and crop unchanged (art still fills the hero)", g.img && g.img.l === 220 && g.img.t === 0 && g.img.r === 1440 && g.img.b === 900 && await p.evaluate(() => getComputedStyle(document.querySelector("section.art-hero > img")).objectFit) === "cover", JSON.stringify(g.img));
  check("full art: faint until hovered; label 'View full art' is visually hidden", g.op > 0 && g.op < 0.4 && g.label === "View full art" && g.vh <= 1, JSON.stringify({ op: g.op, label: g.label, vh: g.vh }));
  if (SHOTS) await p.screenshot({ path: SHOTS + "/full-art-icon-1440.png" });
  await p.hover(".art-full-btn"); await p.waitForTimeout(300);
  check("full art: icon at full opacity on hover", (await geo(p)).op === 1);
  if (SHOTS) await p.screenshot({ path: SHOTS + "/full-art-icon-hover-1440.png", clip: { x: 1440 - 260, y: 40, width: 260, height: 140 } });
  // Pick the second art, then open: shows that art, uncropped, original file.
  const want = await p.evaluate(() => { const b = document.querySelectorAll(".art-swap-thumbs button")[1]; return b && b.getAttribute("data-src"); });
  await p.evaluate(() => document.querySelectorAll(".art-swap-thumbs button")[1].click()); await p.waitForTimeout(200);
  const h0 = await p.evaluate(() => history.length);
  await p.click(".art-full-btn"); await p.waitForTimeout(600);
  let s = await st(p);
  check("full art: opens the selected art-swap image uncropped (contain) on a fullscreen black overlay, one history entry", s.open && s.src === want && s.fit === "contain" && s.bg === "rgb(0, 0, 0)" && s.cover && s.hl === h0 + 1, JSON.stringify(s));
  if (SHOTS) await p.screenshot({ path: SHOTS + "/full-art-open-1440.png" });
  await p.keyboard.press("ArrowRight"); await p.waitForTimeout(150);
  check("full art: arrow keys do not swap the hero art behind the overlay", await p.evaluate((w) => document.querySelector(".art-swap-thumbs button.on").getAttribute("data-src") === w, want));
  await p.keyboard.press("Escape"); await p.waitForTimeout(250); s = await st(p);
  check("full art: Esc closes (and removes its history entry)", !s.open && s.url === "/articles/vaerek/", JSON.stringify(s));
  await p.click(".art-full-btn"); await p.waitForTimeout(250); await p.click(".art-full-x"); await p.waitForTimeout(250);
  check("full art: ✕ closes", !(await st(p)).open);
  await p.click(".art-full-btn"); await p.waitForTimeout(250); await p.mouse.click(300, 450); await p.waitForTimeout(250);
  check("full art: a click anywhere closes", !(await st(p)).open);
  await p.click(".art-full-btn"); await p.waitForTimeout(250); await p.goBack(); await p.waitForTimeout(350); s = await st(p);
  check("full art: Back closes and stays on the article", !s.open && s.url === "/articles/vaerek/", JSON.stringify(s));
  // Single-art hero.
  await p.goto(BASE + "articles/aghor/", { waitUntil: "load" }); await p.waitForTimeout(600);
  await p.click(".art-full-btn"); await p.waitForTimeout(300); s = await st(p);
  check("full art: single-art hero opens its art", s.open && s.src === "/assets/Aghor.png", JSON.stringify(s));
  await p.keyboard.press("Escape"); await p.waitForTimeout(200);
  // Edit mode and no-art heroes: no icon.
  await p.evaluate(() => document.documentElement.classList.add("ee-editing")); await p.waitForTimeout(100);
  check("full art: hidden in edit mode", (await geo(p)).btn === null);
  await p.evaluate(() => document.documentElement.classList.remove("ee-editing"));
  await p.evaluate(() => { document.querySelector("section.art-hero > img").remove(); document.documentElement.classList.toggle("zz"); }); await p.waitForTimeout(100);
  check("full art: no icon on a hero with no art", !(await p.$(".art-full-btn")));
  check("full art: no page errors (desktop)", errs.length === 0, errs.join(" | "));
  await ctx.close();
}
async function phone(browser) {
  const ctx = await ctxFor(browser, true); const p = await ctx.newPage(); const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  await p.goto(BASE + "articles/vaerek/", { waitUntil: "load" }); await p.waitForTimeout(900);
  const g = await geo(p);
  const clash = g.btn ? g.others.filter((o) => hit(g.btn, o[1])).map((o) => o[0]) : ["no button"];
  check("full art (phone): icon always faintly visible, clear of the nav, section bar, title and arrows", g.btn && g.op >= 0.4 && g.op < 0.7 && !clash.length && g.btn.r <= 390 - 6, JSON.stringify({ btn: g.btn, op: g.op, clash }));
  if (SHOTS) await p.screenshot({ path: SHOTS + "/full-art-icon-390.png" });
  const b = g.btn; await p.touchscreen.tap(b.l + b.w / 2, b.t + b.h / 2); await p.waitForTimeout(400);
  let s = await st(p);
  check("full art (phone): tap opens the art full screen, contain", s.open && s.fit === "contain" && s.cover, JSON.stringify(s));
  if (SHOTS) await p.screenshot({ path: SHOTS + "/full-art-open-390.png" });
  await p.touchscreen.tap(195, 420); await p.waitForTimeout(300);
  check("full art (phone): a tap closes", !(await st(p)).open);
  check("full art: no page errors (phone)", errs.length === 0, errs.join(" | "));
  await ctx.close();
}
(async () => {
  const srv = await serverForTests(); BASE = srv.base;
  const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ["--no-sandbox"] });
  try {
    for (const [n, fn] of [["desktop", desktop], ["phone", phone]]) {
      try { await fn(browser); } catch (e) { check(n + " stage ran without exceptions", false, e.stack.split("\n").slice(0, 3).join(" ")); }
    }
  } finally { await browser.close(); srv.close(); }
  const fail = results.filter((r) => !r.ok);
  console.log(`\n${results.length - fail.length}/${results.length} passed`);
  process.exit(fail.length ? 1 : 0);
})();
