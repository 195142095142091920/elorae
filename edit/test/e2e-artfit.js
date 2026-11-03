/* E2E: click the article hero art to fit the whole picture in the frame and back (art-fit.js, af1).
   Run: PLAYWRIGHT=<path> CHROME=/usr/bin/google-chrome node edit/test/e2e-artfit.js  (SHOTS=dir for screenshots) */
"use strict";
const { chromium } = require(process.env.PLAYWRIGHT || "playwright");
const { serverForTests } = require("./server.js");
const SHOTS = process.env.SHOTS || "";
const results = [];
function check(name, ok, detail) { results.push({ name, ok: !!ok }); console.log((ok ? "PASS " : "FAIL ") + name + (detail ? "  — " + detail : "")); }
let BASE;
async function ctxFor(browser, phone, extra) {
  const ctx = await browser.newContext(Object.assign({ viewport: phone ? { width: 390, height: 844 } : { width: 1440, height: 900 }, deviceScaleFactor: 1 }, phone ? { isMobile: true, hasTouch: true } : {}, extra || {}));
  await ctx.route((u) => !u.href.startsWith(BASE) && !u.href.startsWith("data:"), (r) => r.abort());
  await ctx.addInitScript(`try{localStorage.setItem("elorae-login","sawyer");localStorage.setItem("elorae-cats-rail",JSON.stringify({pinned:${!phone},phoneOpen:false}));}catch(e){}`);
  return ctx;
}
const S = (p) => p.evaluate(() => {
  const h = document.querySelector("section.art-hero"), i = h.querySelector(":scope > img");
  const R = (e) => { const r = e.getBoundingClientRect(); return { l: Math.round(r.left), t: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) }; };
  const cs = getComputedStyle(i);
  return { hero: R(h), img: R(i), ratio: i.naturalWidth / i.naturalHeight, pressed: i.getAttribute("aria-pressed"), role: i.getAttribute("role"), tab: i.getAttribute("tabindex"), full: h.classList.contains("art-fit-full"), cursor: cs.cursor, pos: cs.objectPosition, fit: cs.objectFit, mask: cs.maskImage || cs.webkitMaskImage, sticky: getComputedStyle(h).position, src: i.getAttribute("src"), navT: parseInt(getComputedStyle(document.documentElement).getPropertyValue("--af-top")) || 0, navB: Math.round(Math.max(...[".topbar","#section-bar"].map(q => { const n = document.querySelector(q); if (!n) return 0; const r = n.getBoundingClientRect(); return r.height && r.top < 220 && getComputedStyle(n).display !== "none" ? r.bottom : 0; }))) };
});
const contained = (s) => { const r = s.img.w / s.img.h; return Math.abs(r - s.ratio) < 0.02 && s.img.w <= s.hero.w + 1 && s.img.t === s.hero.t + s.navT && Math.abs(s.img.t - s.navB) <= 1 && s.img.t + s.img.h <= s.hero.t + s.hero.h + 1 && (Math.abs(s.img.w - s.hero.w) <= 1 || Math.abs(s.img.h - (s.hero.h - s.navT)) <= 1); };
const covers = (s) => s.img.l === s.hero.l && s.img.t === s.hero.t && s.img.w === s.hero.w && s.img.h === s.hero.h;
async function artPoint(p) {
  return p.evaluate(() => { const h = document.querySelector("section.art-hero"), r = h.getBoundingClientRect(), i = h.querySelector(":scope > img"); for (const [fx, fy] of [[0.6, 0.35], [0.5, 0.3], [0.7, 0.5], [0.4, 0.2]]) { const x = r.left + r.width * fx, y = r.top + r.height * fy; if (document.elementFromPoint(x, y) === i) return { x, y }; } return null; });
}
async function desktop(browser) {
  const ctx = await ctxFor(browser, false); const p = await ctx.newPage(); const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  await p.goto(BASE + "articles/vaerek/", { waitUntil: "load" }); await p.waitForTimeout(900);
  { const d = await S(p); check("art fit (afd1): full art is the default at load, top edge right under the nav bar, bottom fade only", d.full && contained(d) && d.pressed === "true" && !/transparent 0/.test(d.mask || "x"), JSON.stringify(d));
    if (SHOTS) await p.screenshot({ path: SHOTS + "/art-fit-default-1440.png" });
    const q = await artPoint(p); await p.mouse.click(q.x, q.y); await p.waitForTimeout(500); }
  let s0 = await S(p);
  check("art fit: art is the cover crop at load, a role=button with aria-pressed=false and tabindex, zoom-in cursor", covers(s0) && s0.fit === "cover" && s0.role === "button" && s0.tab === "0" && s0.pressed === "false" && s0.cursor === "zoom-in" && s0.sticky === "sticky", JSON.stringify(s0));
  if (SHOTS) await p.screenshot({ path: SHOTS + "/art-fit-crop-1440.png" });
  const pt = await artPoint(p);
  await p.mouse.click(pt.x, pt.y); await p.waitForTimeout(150);
  const mid = await S(p);
  await p.waitForTimeout(400);
  let s = await S(p);
  check("art fit: a click shrinks it smoothly to the whole picture inside the same hero (box unchanged, centred, proportions kept)", s.full && contained(s) && JSON.stringify(s.hero) === JSON.stringify(s0.hero) && mid.img.h < s0.img.h && mid.img.h > s.img.h, JSON.stringify({ mid: mid.img, end: s.img, hero: s.hero }));
  check("art fit: full mode has soft top/bottom fades, aria-pressed=true, zoom-out cursor, still sticky (aov1)", /linear-gradient/.test(s.mask || "") && s.pressed === "true" && s.cursor === "zoom-out" && s.sticky === "sticky", JSON.stringify({ mask: s.mask, pressed: s.pressed, cursor: s.cursor }));
  if (SHOTS) await p.screenshot({ path: SHOTS + "/art-fit-full-1440.png" });
  // Clicks that must not toggle.
  const before = (await S(p)).full; const bad = [];
  for (const sel of [".art-title h1", ".art-title .art-epithet", ".art-swap .art-prev", "#art-index-panel .toc-row > a"]) {
    const ok = await p.$(sel); if (!ok) { bad.push("missing " + sel); continue; }
    await p.click(sel); await p.waitForTimeout(120);
    if ((await S(p)).full !== before) { bad.push(sel); await p.evaluate(() => window.EloraeArtFit.toggle()); await p.waitForTimeout(400); }
  }
  s = await S(p);
  check("art fit: name, epithet, art-swap arrows and the Categories rail do not toggle it; art-swap keeps full mode and fits the new art", !bad.length && s.full && contained(s) && s.src !== s0.src, JSON.stringify({ bad, src: s.src, img: s.img, ratio: s.ratio }));
  await p.hover(".art-swap .art-next"); await p.waitForTimeout(300);
  await p.click(".art-swap-thumbs button:nth-child(1)"); await p.waitForTimeout(500); s = await S(p);
  check("art fit: a thumbnail click swaps art without toggling", s.full && contained(s) && s.src === s0.src, JSON.stringify({ full: s.full, src: s.src }));
  await p.mouse.click(pt.x, pt.y); await p.waitForTimeout(500); s = await S(p);
  check("art fit: another click zooms back to the cover crop (inline sizing cleared)", !s.full && covers(s) && s.pressed === "false" && await p.evaluate(() => !document.querySelector("section.art-hero > img").style.width), JSON.stringify(s.img));
  await p.focus("section.art-hero > img"); await p.keyboard.press("Enter"); await p.waitForTimeout(450); const k1 = (await S(p)).full;
  await p.keyboard.press(" "); await p.waitForTimeout(450); const k2 = (await S(p)).full;
  check("art fit: Enter and Space on the focused art toggle it", k1 === true && k2 === false, JSON.stringify({ k1, k2 }));
  // Scroll (aov1 overlay) works in full mode too.
  await p.mouse.click(pt.x, pt.y); await p.waitForTimeout(450);
  await p.evaluate(() => scrollTo(0, 400)); await p.waitForTimeout(250);
  const sc = await p.evaluate(() => ({ heroTop: Math.round(document.querySelector("section.art-hero").getBoundingClientRect().top), main: Math.round(document.querySelector("main.art-body").getBoundingClientRect().top), y: scrollY }));
  check("art fit: overlay scroll still works in full mode (hero pinned, text rises over it)", sc.heroTop === 0 && sc.main < 900 && sc.y === 400, JSON.stringify(sc));
  await p.evaluate(() => scrollTo(0, 0));
  // Not persisted.
  await p.reload({ waitUntil: "load" }); await p.waitForTimeout(700); s = await S(p);
  check("art fit: a reload opens in full art again (default)", s.full && contained(s), JSON.stringify(s));
  // Filibeth keeps its inline object-position for the crop, before and after a round trip.
  await p.goto(BASE + "articles/filibeth/", { waitUntil: "load" }); await p.waitForTimeout(700);
  const f0 = await S(p); const fp = await artPoint(p);
  await p.mouse.click(fp.x, fp.y); await p.waitForTimeout(450); const f1 = await S(p);
  await p.mouse.click(fp.x, fp.y); await p.waitForTimeout(450); const f2 = await S(p);
  check("art fit: Filibeth's crop keeps object-position 62% 20%, and fits fully in between", f1.pos === "62% 20%" && covers(f1) && !f1.full && f0.full && contained(f0) && f2.full && contained(f2), JSON.stringify({ p1: f1.pos }));
  // Edit mode and no-art: off.
  await p.evaluate(() => document.documentElement.classList.add("ee-editing")); await p.waitForTimeout(100);
  await p.evaluate(() => document.querySelector("section.art-hero > img").click()); await p.waitForTimeout(200); s = await S(p);
  check("art fit: off in edit mode (no toggle, no button role)", !s.full && s.role === null, JSON.stringify({ full: s.full, role: s.role }));
  await p.evaluate(() => document.documentElement.classList.remove("ee-editing"));
  await p.evaluate(() => { document.querySelector("section.art-hero").classList.add("no-art"); document.documentElement.classList.toggle("zz"); }); await p.waitForTimeout(100);
  await p.evaluate(() => document.querySelector("section.art-hero > img").click()); await p.waitForTimeout(200); s = await S(p);
  check("art fit: off on no-art heroes", !s.full && s.role === null);
  check("art fit: no page errors (desktop)", errs.length === 0, errs.join(" | "));
  await ctx.close();
  // Reduced motion: jumps straight to the end state.
  const rctx = await ctxFor(browser, false, { reducedMotion: "reduce" }); const rp = await rctx.newPage();
  await rp.goto(BASE + "articles/aghor/", { waitUntil: "load" }); await rp.waitForTimeout(700);
  const rpt = await artPoint(rp); await rp.mouse.click(rpt.x, rpt.y); await rp.waitForTimeout(40); s = await S(rp);
  check("art fit: reduced motion — no animation, straight to the crop", !s.full && covers(s), JSON.stringify(s.img));
  await rctx.close();
}
async function phone(browser) {
  const ctx = await ctxFor(browser, true); const p = await ctx.newPage(); const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  await p.goto(BASE + "articles/vaerek/", { waitUntil: "load" }); await p.waitForTimeout(900);
  { const d = await S(p); check("art fit (afd1): full art is the default at load, top edge right under the nav bar, bottom fade only", d.full && contained(d) && d.pressed === "true" && !/transparent 0/.test(d.mask || "x"), JSON.stringify(d));
    if (SHOTS) await p.screenshot({ path: SHOTS + "/art-fit-default-390.png" });
    const q = await artPoint(p); await p.touchscreen.tap(q.x, q.y); await p.waitForTimeout(500); }
  const s0 = await S(p);
  if (SHOTS) await p.screenshot({ path: SHOTS + "/art-fit-crop-390.png" });
  const pt = await artPoint(p);
  await p.touchscreen.tap(pt.x, pt.y); await p.waitForTimeout(500); let s = await S(p);
  check("art fit (phone): a tap fits the whole picture in the same hero (black + fades), no zoom cursor", s.full && contained(s) && JSON.stringify(s.hero) === JSON.stringify(s0.hero) && s0.cursor !== "zoom-in", JSON.stringify({ img: s.img, hero: s.hero, cursor: s0.cursor }));
  if (SHOTS) await p.screenshot({ path: SHOTS + "/art-fit-full-390.png" });
  await p.touchscreen.tap(pt.x, pt.y); await p.waitForTimeout(500); s = await S(p);
  check("art fit (phone): another tap goes back to the crop", !s.full && covers(s));
  const ar = await p.$(".art-swap .art-next"); const b = await ar.boundingBox();
  await p.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); await p.waitForTimeout(400); s = await S(p);
  check("art fit (phone): tapping the art-swap arrow swaps art without toggling", !s.full && s.src !== s0.src, s.src);
  check("art fit: no page errors (phone)", errs.length === 0, errs.join(" | "));
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
