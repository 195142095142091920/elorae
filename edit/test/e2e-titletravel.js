/* E2E: on article pages the name + epithet travel from the art into the top of the text panel as
   you scroll (title-travel.js tt1). Checks the start / mid / settled poses at 1440 and 390, the
   reverse, fast jumps, the rAF fallback (no scroll timelines), reduced motion, rail pinned vs
   unpinned, art-swap arrows + click-to-fit still working, a no-art hero, one announced title,
   edit mode off and nothing saved.
   Run: PLAYWRIGHT=<path> CHROME=/usr/bin/google-chrome node edit/test/e2e-titletravel.js */
"use strict";
const { chromium } = require(process.env.PLAYWRIGHT || "playwright");
const { MockGitHub } = require("./mock-github.js");
const { serverForTests, ROOT } = require("./server.js");
const fs = require("fs"), path = require("path");
const REPO = "195142095142091920/elorae";
const PROFILES = { repo: REPO, profiles: { "devin-gh": { name: "Devin", person: "devin", role: "admin", title: "GM", permissions: ["**"], save: "direct" } } };
const results = [];
function check(name, ok, detail) { results.push({ name, ok: !!ok }); console.log((ok ? "PASS " : "FAIL ") + name + (detail ? "  — " + detail : "")); }
let BASE;
const VP = { desktop: { width: 1440, height: 900 }, phone: { width: 390, height: 844 } };
async function ctxFor(browser, o) {
  o = o || {};
  const phone = o.vp === "phone";
  const ctx = await browser.newContext(Object.assign({ viewport: VP[o.vp || "desktop"], deviceScaleFactor: 1, reducedMotion: o.reduce ? "reduce" : "no-preference" }, phone ? { isMobile: true, hasTouch: true } : {}));
  if (o.mock) await ctx.route("https://api.github.com/**", (r) => o.mock.handle(r));
  await ctx.route((u) => !u.href.startsWith(BASE) && !u.href.startsWith("data:") && !u.href.startsWith("https://api.github.com"), (r) => r.abort());
  const who = o.who || "sawyer", pinned = o.pinned == null ? !phone : o.pinned;
  let init = `try{localStorage.setItem("elorae-login",${JSON.stringify(who)});localStorage.setItem("elorae-cats-rail",JSON.stringify({pinned:${pinned},phoneOpen:false}));}catch(e){}`;
  if (o.mock) init += `try{localStorage.setItem("elorae-edit-session",${JSON.stringify(JSON.stringify({ token: "ghp_test_devin", login: "devin-gh", person: "devin", role: "admin", remember: true }))});document.cookie="elorae-login=devin;path=/";}catch(e){}`;
  if (o.noSda) init += `(function(){var s=CSS.supports.bind(CSS);CSS.supports=function(a,b){return /animation-timeline/.test(String(a)+String(b||""))?false:s.apply(null,arguments);};})();`;
  await ctx.addInitScript(init);
  return ctx;
}
// Pose of the copy vs the hero title (on-screen boxes).
const S = (p) => p.evaluate(() => {
  const d = document.querySelector("main.art-body > .art-tt"), n = d && d.querySelector(".art-tt-name"), h = document.querySelector("section.art-hero > .art-title h1"), t = h && h.parentElement;
  const R = (e) => { const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, w: r.width, h: r.height }; };
  return { has: !!d, y: scrollY, R: window.EloraeTitleTravel ? window.EloraeTitleTravel.range() : 0, n: n && R(n), h: h && R(h), op: t && +getComputedStyle(t).opacity, tf: d && getComputedStyle(d).transform,
    first: d && d.parentElement.firstElementChild === d, aria: d && d.getAttribute("aria-hidden"), pe: d && getComputedStyle(d).pointerEvents, h1s: document.querySelectorAll("h1").length,
    name: n && n.textContent, real: h && h.textContent.trim(), cls: document.documentElement.className };
});
const near = (a, b, tol) => Math.abs(a - b) <= (tol || 2);
const onTitle = (s) => s.n && s.h && near(s.n.l, s.h.l) && near(s.n.t, s.h.t) && near(s.n.w, s.h.w, 3);
const flat = (tf) => tf === "none" || tf === "matrix(1, 0, 0, 1, 0, 0)"; // the scroll animation's end pose is the identity
const settledOk = (s) => flat(s.tf) && s.first;
async function to(p, y) { await p.evaluate((y) => scrollTo(0, y), y); await p.waitForTimeout(250); return S(p); }

async function poses(browser, vp, o) {
  o = o || {};
  const tag = `[${vp}${o.noSda ? ", rAF fallback" : ""}${o.pinned === false ? ", rail unpinned" : ""}]`;
  const ctx = await ctxFor(browser, Object.assign({ vp }, o)); const p = await ctx.newPage(); const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  await p.goto(BASE + "articles/vaerek/", { waitUntil: "load" }); await p.waitForTimeout(800);
  let s = await to(p, 0);
  check(`${tag} start: the copy sits exactly on the hero title, which is hidden; the copy is aria-hidden, no pointer events, one h1`, s.has && onTitle(s) && s.op === 0 && s.aria === "true" && s.pe === "none" && s.h1s === 1 && s.name === s.real && (o.noSda ? !/tt-sda/.test(s.cls) : /tt-sda/.test(s.cls)), JSON.stringify(s));
  const R = s.R;
  const m = await to(p, Math.round(R / 2));
  check(`${tag} mid-scroll: the title holds its height on screen while it shrinks and glides into the column`, near(m.n.t, s.h.t, 3) && m.n.w < s.n.w - 5 && m.n.w > s.n.w * 0.8 - 5, JSON.stringify({ n: m.n, h: s.h }));
  const e = await to(p, Math.round(R + 120));
  check(`${tag} settled: it is the panel's heading (first block of the text, no transform)`, settledOk(e) && e.n.w < s.n.w, JSON.stringify(e));
  const e2 = await to(p, Math.round(R + 320));
  check(`${tag} then it scrolls with the text`, near(e.n.t - e2.n.t, 200, 2) && flat(e2.tf), (e.n.t - e2.n.t).toFixed(1));
  const b = await to(p, 0);
  check(`${tag} scrolling back up reverses it: on the hero title again`, onTitle(b) && b.op === 0, JSON.stringify(b.n));
  let bad = [];
  for (const y of [R * 0.9, 13, R * 3, R * 0.25, 0, R * 0.6]) {
    await p.evaluate((y) => scrollTo(0, y), Math.round(y)); await p.waitForTimeout(120);
    const q = await S(p), want = Math.min(1, q.y / R);
    // expected copy left: from the title's left to its own (settled) left
    const ok = q.y >= R ? flat(q.tf) : near(q.n.t, s.h.t, 3);
    if (!ok) bad.push(Math.round(q.y) + ":" + JSON.stringify(q.n) + ":" + q.tf + ":" + want.toFixed(2));
  }
  check(`${tag} fast jumps up and down: always the right pose, no lag`, bad.length === 0, bad.join(" | "));
  check(`${tag} no page errors`, errs.length === 0, errs.join(" | "));
  await ctx.close();
}

async function interactions(browser) {
  const ctx = await ctxFor(browser, { vp: "desktop" }); const p = await ctx.newPage(); const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  await p.goto(BASE + "articles/vaerek/", { waitUntil: "load" }); await p.waitForTimeout(800);
  // Rail pinned -> unpinned: the hero changes width; the copy follows the title.
  const pinned = await S(p);
  await p.evaluate(() => document.querySelector(".rail-toggle, .index-toc-pin, .art-index-pin") && document.querySelector(".rail-toggle, .index-toc-pin, .art-index-pin").click());
  await p.waitForTimeout(700);
  const un = await S(p);
  check("rail toggled: the copy re-measures and still sits on the hero title", onTitle(un) && (un.h.l !== pinned.h.l || un.cls !== pinned.cls), JSON.stringify({ was: pinned.h.l, now: un.h.l, n: un.n.l }));
  await p.evaluate(() => document.querySelector(".rail-toggle, .index-toc-pin, .art-index-pin") && document.querySelector(".rail-toggle, .index-toc-pin, .art-index-pin").click());
  await p.waitForTimeout(700);
  // Art-swap arrows still work over the art; click-to-fit still toggles.
  const src0 = await p.evaluate(() => document.querySelector("section.art-hero > img").getAttribute("src"));
  await p.hover("section.art-hero .art-swap .art-next"); await p.click("section.art-hero .art-swap .art-next"); await p.waitForTimeout(500);
  const src1 = await p.evaluate(() => document.querySelector("section.art-hero > img").getAttribute("src"));
  const after = await S(p);
  check("art-swap arrow still switches the art, and the copy stays on the title", src1 !== src0 && onTitle(after), src0 + " -> " + src1);
  const pt = await p.evaluate(() => { const h = document.querySelector("section.art-hero"), r = h.getBoundingClientRect(), i = h.querySelector(":scope > img"); for (const [fx, fy] of [[0.6, 0.35], [0.5, 0.3], [0.7, 0.5]]) { const x = r.left + r.width * fx, y = r.top + r.height * fy; if (document.elementFromPoint(x, y) === i) return { x, y }; } return null; });
  await p.mouse.click(pt.x, pt.y); await p.waitForTimeout(500);
  const fit = await p.evaluate(() => document.querySelector("section.art-hero").classList.contains("art-fit-full"));
  // Clicking where the (hidden) hero title is does not toggle the fit.
  const tp = await p.evaluate(() => { const r = document.querySelector("section.art-hero > .art-title h1").getBoundingClientRect(); return { x: r.left + 10, y: r.top + r.height / 2 }; });
  await p.mouse.click(tp.x, tp.y); await p.waitForTimeout(450);
  const fit2 = await p.evaluate(() => document.querySelector("section.art-hero").classList.contains("art-fit-full"));
  check("click-to-fit still works on the art (full by default, a click crops); a click on the title spot does not toggle it", !fit && !fit2, JSON.stringify({ fit, fit2 }));
  // The copy never reaches the accessibility tree; the page title / h1 text is the real name.
  const ax = await p.evaluate(() => { const d = document.querySelector(".art-tt"); return { ah: d.closest("[aria-hidden=true]") === d, h1: document.querySelector("h1").textContent.trim(), sel: getComputedStyle(d).userSelect }; });
  check("one announced title: the copy is aria-hidden and not selectable; the h1 is the real name", ax.ah && ax.h1 === "Vaerek Rathkin" && ax.sel === "none", JSON.stringify(ax));
  check("interactions: no page errors", errs.length === 0, errs.join(" | "));
  await ctx.close();
  // Peek / hover cards read the real name from the article (no copy in the fetched source).
  const c2 = await ctxFor(browser, { vp: "desktop" }); const q = await c2.newPage();
  await q.goto(BASE + "index/ancients/", { waitUntil: "load" });
  await q.click('main a.index-card[href="/articles/vaerek/"]');
  await q.waitForFunction(() => { const x = document.querySelector("#peek"); return x && x.classList.contains("peek-open") && !x.classList.contains("peek-loading"); }, null, { timeout: 8000 });
  const pk = await q.evaluate(() => ({ name: document.querySelector("#peek .peek-name").textContent, tt: !!document.querySelector("#peek .art-tt"), para: document.querySelector("#peek .peek-para").textContent.slice(0, 30) }));
  check("peek reads the real name and first paragraph (the copy is runtime only, never in the page source)", pk.name === "Vaerek Rathkin" && !pk.tt && !/Vaerek Rathkin/.test(pk.para) && !/art-tt/.test(fs.readFileSync(path.join(ROOT, "articles/vaerek/index.html"), "utf8")), JSON.stringify(pk));
  await c2.close();
}

async function reduced(browser) {
  const ctx = await ctxFor(browser, { vp: "desktop", reduce: true }); const p = await ctx.newPage();
  await p.goto(BASE + "articles/vaerek/", { waitUntil: "load" }); await p.waitForTimeout(800);
  const a = await to(p, 0), b = await to(p, 400);
  check("reduced motion: no movement (copy always in the panel), the hero title fades out as the panel arrives", /tt-reduce/.test(a.cls) && a.tf === "none" && a.op === 1 && b.tf === "none" && b.op < 0.05 && a.first, JSON.stringify({ a: [a.tf, a.op], b: [b.tf, b.op] }));
  await ctx.close();
}

async function noArt(browser, vp) {
  const ctx = await ctxFor(browser, { vp }); const p = await ctx.newPage();
  const raw = fs.readFileSync(path.join(ROOT, "articles/aghor/index.html"), "utf8");
  const html = raw.replace(/<section class="art-hero[^"]*"[\s\S]*?<\/section>/, '<section class="art-hero no-art"><div class="art-title"><h1>Zq Noart</h1><p class="art-epithet">Without a picture</p></div></section>');
  await p.route(BASE + "articles/aghor/", (r) => r.fulfill({ status: 200, contentType: "text/html", body: html }));
  await p.goto(BASE + "articles/aghor/", { waitUntil: "load" }); await p.waitForTimeout(800);
  const s = await to(p, 0), e = await to(p, Math.round(s.R + 100));
  check(`[${vp}] no-art hero: the title travels the same way (start on the title, settles in the panel)`, s.has && onTitle(s) && settledOk(e) && s.name === "Zq Noart", JSON.stringify({ s: s.n, h: s.h, e: e.tf }));
  await ctx.close();
}

async function editMode(browser) {
  const mock = new MockGitHub({ repo: REPO, root: ROOT, tokens: { "ghp_test_devin": "devin-gh" }, overrides: { "edit/profiles.json": JSON.stringify(PROFILES, null, 2) } });
  const ctx = await ctxFor(browser, { vp: "desktop", mock, who: "devin" }); const p = await ctx.newPage(); const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  p.on("dialog", (d) => d.accept().catch(() => {}));
  await p.goto(BASE + "articles/vaerek/", { waitUntil: "load" });
  await p.waitForFunction(() => window.EloraeEditor && window.EloraeEditor.state && window.EloraeEditor.state.profile, null, { timeout: 15000 });
  const before = await S(p);
  await p.evaluate(() => window.EloraeEditor.tryEnterEdit()); await p.waitForSelector("#ee-save", { timeout: 15000 }); await p.waitForTimeout(300);
  const ed = await p.evaluate(() => ({ tt: document.querySelectorAll(".art-tt").length, op: +getComputedStyle(document.querySelector("section.art-hero > .art-title")).opacity }));
  check("edit mode: the travel is off (no copy, the hero title is visible and editable)", before.has && ed.tt === 0 && ed.op === 1, JSON.stringify(ed));
  // A small edit + Save: the saved article never contains the copy.
  await p.evaluate(() => { const el = document.querySelector("main.art-body p"); el.focus(); const r = document.createRange(); r.selectNodeContents(el); r.collapse(false); const s = getSelection(); s.removeAllRanges(); s.addRange(r); });
  await p.keyboard.type(" Zq");
  await p.click("#ee-save");
  await p.waitForFunction(() => /Saved|failed|conflict/i.test((document.getElementById("ee-bar") || {}).textContent || ""), null, { timeout: 20000 });
  const saved = String(mock.file("articles/vaerek/index.html"));
  check("edit mode: the saved article has no title copy", saved.includes(" Zq") && !/art-tt|data-ee-ui/.test(saved), saved.includes(" Zq") ? "" : "edit not saved");
  await p.waitForTimeout(400);
  const back = await p.evaluate(() => ({ editing: document.documentElement.classList.contains("ee-editing"), tt: document.querySelectorAll(".art-tt").length }));
  check("after leaving edit mode the travel is back", !back.editing && back.tt === 1, JSON.stringify(back));
  check("edit mode: no page errors", errs.length === 0, errs.join(" | "));
  await ctx.close();
}

(async () => {
  const srv = await serverForTests(); BASE = srv.base;
  const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ["--no-sandbox"] });
  const stage = async (name, fn) => { try { await fn(); } catch (e) { check(name + " stage ran without exceptions", false, e.stack.split("\n").slice(0, 3).join(" ")); } };
  try {
    await stage("desktop", () => poses(browser, "desktop"));
    await stage("desktop unpinned", () => poses(browser, "desktop", { pinned: false }));
    await stage("phone", () => poses(browser, "phone"));
    await stage("desktop rAF", () => poses(browser, "desktop", { noSda: true }));
    await stage("phone rAF", () => poses(browser, "phone", { noSda: true }));
    await stage("interactions", () => interactions(browser));
    await stage("reduced", () => reduced(browser));
    await stage("no-art desktop", () => noArt(browser, "desktop"));
    await stage("no-art phone", () => noArt(browser, "phone"));
    await stage("edit", () => editMode(browser));
  } finally { await browser.close(); srv.close(); }
  const fail = results.filter((r) => !r.ok);
  console.log(`\n${results.length - fail.length}/${results.length} passed`);
  process.exit(fail.length ? 1 : 0);
})();
