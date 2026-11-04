/* E2E: Index peek panel + article hover link cards (peek.js, pk1).
   Run: PLAYWRIGHT=<path> CHROME=/usr/bin/google-chrome node edit/test/e2e-peek.js */
"use strict";
const { chromium } = require(process.env.PLAYWRIGHT || "playwright");
const { serverForTests } = require("./server.js");
const fs = require("fs"), path = require("path");
const ROOT = path.resolve(__dirname, "../..");
const results = [];
function check(name, ok, detail) { results.push({ name, ok: !!ok }); console.log((ok ? "PASS " : "FAIL ") + name + (detail ? "  — " + detail : "")); }
let BASE;
async function ctxFor(browser, who, vp, extra) {
  const ctx = await browser.newContext(Object.assign({ viewport: vp || { width: 1440, height: 900 }, deviceScaleFactor: 1 }, extra || {}));
  await ctx.route((u) => !u.href.startsWith(BASE) && !u.href.startsWith("data:"), (r) => r.abort());
  await ctx.addInitScript(`try{localStorage.setItem("elorae-login",${JSON.stringify(who)});document.cookie="elorae-login=${who};path=/";}catch(e){}`);
  return ctx;
}
const VA = 'main a.index-card[href="/articles/vaerek/"]';
// cc1: the peek opens from the eye button on the hovered card (a plain click goes to the article).
const pk = async (p, sel) => { await p.hover(sel); await p.waitForSelector("#peek-eye.peek-eye-on", { timeout: 4000 }); await p.waitForTimeout(300); await p.click("#peek-eye"); };
const openP = (p) => p.waitForFunction(() => { const x = document.querySelector("#peek"); return x && x.classList.contains("peek-open") && !x.classList.contains("peek-loading"); }, null, { timeout: 8000 });
const st = (p) => p.evaluate(() => { const x = document.querySelector("#peek"); return { open: !!(x && x.classList.contains("peek-open")), name: x ? x.querySelector(".peek-name").textContent : "", dl: x ? [...x.querySelectorAll(".peek-dl dt")].map((d) => d.textContent).join("|") : "", para: x ? x.querySelector(".peek-para").textContent : "", read: x ? x.querySelector(".peek-read").getAttribute("href") : "", url: location.pathname + location.hash, hl: history.length, on: (document.querySelector("a.index-card.peek-on") || {}).id || "" }; });

async function peekTests(browser) {
  const ctx = await ctxFor(browser, "sawyer"); const p = await ctx.newPage(); const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  await p.goto(BASE + "index/ancients/", { waitUntil: "load" });
  const h0 = await p.evaluate(() => history.length);
  await pk(p, VA); await openP(p);
  let s = await st(p);
  check("peek: the eye button on a card opens the panel (no navigation), with name, filled Dossier fields, first Lore paragraph and Read full article", s.open && s.url === "/index/ancients/" && s.name === "Vaerek Rathkin" && s.dl === "Pronunciation|Faction" && /^Bastard son of a Morathi noble/.test(s.para) && s.read === "/articles/vaerek/" && s.hl === h0 + 1 && s.on === "heroes-vaerek", JSON.stringify(s));
  await p.waitForTimeout(450);
  const box = await p.evaluate(() => { const r = document.querySelector("#peek").getBoundingClientRect(); return { l: Math.round(r.left), w: Math.round(r.width), t: Math.round(r.top), b: Math.round(r.bottom), nav: parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--nav-bottom")) }; });
  check("peek: desktop panel is on the right, ~460px wide, below the nav to the bottom", box.w === 460 && box.l === 1440 - 460 && box.t === box.nav && box.b === 900, JSON.stringify(box));
  // Heroes are A to Z (ia1), so Vaerek Rathkin is the last card of the section.
  await p.keyboard.press("ArrowLeft"); await openP(p); s = await st(p);
  const prevId = await p.evaluate(() => { const sec = document.querySelector("#heroes"); const v = [...sec.querySelectorAll("a.index-card")].filter((a) => a.getClientRects().length); return v[v.length - 2].id; });
  check("peek: Left arrow moves to the previous card in the same section (swap in place, no new history entry)", s.on === prevId && s.hl === h0 + 1, JSON.stringify(s));
  await p.click("#peek .peek-next"); await openP(p); s = await st(p);
  check("peek: the panel's › arrow goes forward; › is disabled on the last card", s.on === "heroes-vaerek" && await p.evaluate(() => document.querySelector("#peek .peek-next").disabled), s.on);
  await pk(p, 'main a.index-card[href="/articles/alaric/"]'); await openP(p); s = await st(p);
  check("peek: another card eye while open swaps content in place", s.name === "Alaric Morn" && s.hl === h0 + 1 && s.open, JSON.stringify(s));
  await p.goBack(); await p.waitForTimeout(300); s = await st(p);
  check("peek: Back closes the peek and stays on the Index", !s.open && s.url === "/index/ancients/" && s.on === "", JSON.stringify(s));
  await pk(p, VA); await openP(p); await p.keyboard.press("Escape"); await p.waitForTimeout(200); s = await st(p);
  const h1 = s.hl;
  check("peek: Esc closes (and removes its history entry)", !s.open && s.url === "/index/ancients/", JSON.stringify(s));
  await pk(p, VA); await openP(p); await p.click("#heroes > h2"); await p.waitForTimeout(250); s = await st(p);
  check("peek: a click outside the panel closes it", !s.open, JSON.stringify(s));
  await pk(p, VA); await openP(p); await p.click("#peek .peek-x"); await p.waitForTimeout(250); s = await st(p);
  check("peek: ✕ closes it", !s.open);
  const [tab] = await Promise.all([ctx.waitForEvent("page", { timeout: 5000 }).catch(() => null), p.click(VA, { modifiers: ["Control"] })]);
  await p.waitForTimeout(200); s = await st(p);
  check("peek: Ctrl-click still opens the real article in a new tab, no peek", !!tab && /\/articles\/vaerek\/$/.test(tab.url()) && !s.open, tab ? tab.url() : "no tab");
  if (tab) await tab.close();
  await p.hover(VA); await p.waitForSelector("#peek-eye.peek-eye-on");
  const eb = await p.evaluate((sel) => { const c = document.querySelector(sel).getBoundingClientRect(), e = document.querySelector("#peek-eye").getBoundingClientRect(); return { dx: Math.round(c.right - e.right), dy: Math.round(e.top - c.top), w: Math.round(e.width) }; }, VA);
  await p.waitForTimeout(250); await p.screenshot({ path: "/tmp/ee-peek-eye-1440.png" });
  check("cc1: hovering a card fades in a small eye at its top-right corner", eb.dx === 8 && eb.dy === 8 && eb.w === 28, JSON.stringify(eb));
  await p.mouse.move(5, 450); await p.waitForTimeout(400);
  check("cc1: the eye goes away when the pointer leaves the card", !(await p.$("#peek-eye.peek-eye-on")));
  await Promise.all([p.waitForURL(/\/articles\/vaerek\/$/, { timeout: 8000 }), p.click(VA)]);
  check("cc1: a plain click on a card goes straight to its article (no peek)", /\/articles\/vaerek\/$/.test(p.url()), p.url());
  await p.goto(BASE + "index/ancients/", { waitUntil: "load" });
  await p.focus(VA); await p.keyboard.press("Space"); await openP(p); s = await st(p);
  check("cc1: keyboard, Space on a focused card opens its preview", s.open && s.name === "Vaerek Rathkin", JSON.stringify(s));
  await p.keyboard.press("Escape"); await p.waitForTimeout(200);
  const href = await p.getAttribute(VA, "href");
  check("peek: the card's href is still the article URL", href === "/articles/vaerek/", href);
  await pk(p, VA); await openP(p);
  await Promise.all([p.waitForURL(/\/articles\/vaerek\/$/, { timeout: 8000 }), p.click("#peek .peek-read")]);
  check("peek: Read full article opens the article", /\/articles\/vaerek\/$/.test(p.url()), p.url());
  await p.goto(BASE + "index/ancients/", { waitUntil: "load" });
  await p.evaluate(() => document.documentElement.classList.add("ee-index-org"));
  await p.click(VA, { trial: false }).catch(() => {});
  await p.waitForTimeout(300);
  const orgUrl = p.url(); s = await st(p);
  check("peek: off in the Index organizer (cards keep their old behaviour)", !s.open && /\/articles\/vaerek\/$/.test(orgUrl), orgUrl);
  check("peek: no page errors", errs.length === 0, errs.join(" | "));
  await ctx.close();
}

async function privacyTests(browser) {
  const raw = fs.readFileSync(path.join(ROOT, "articles/vaerek/index.html"), "utf8");
  const doctored = raw
    .replace('<section class="art-sec" id="lore"><h2>Lore</h2>', '<section class="art-sec" id="lore"><h2>Lore</h2><p class="art-life private" data-owner="devin">ZQ-SECRET devin only paragraph.</p>')
    .replace("<dt>Faction</dt>", '<dt class="private" data-owner="devin">Zq Secret</dt><dd class="private" data-owner="devin">ZQ-HIDDEN</dd><dt>Faction</dt>');
  if (doctored === raw) { check("privacy: fixture built", false); return; }
  const gone = raw.replace("<html", '<html data-secret-page="zq-sec" data-owner="devin"');
  for (const who of ["sawyer", "devin"]) {
    const ctx = await ctxFor(browser, who); const p = await ctx.newPage();
    await ctx.route(BASE + "articles/vaerek/", (r) => r.fulfill({ status: 200, contentType: "text/html", body: doctored }));
    await ctx.route(BASE + "articles/saoirse/", (r) => r.fulfill({ status: 200, contentType: "text/html", body: gone.replace(/Vaerek Rathkin/g, "Saoirse") }));
    await p.goto(BASE + "index/ancients/", { waitUntil: "load" });
    await pk(p, VA); await openP(p);
    const s = await st(p);
    const all = await p.evaluate(() => document.querySelector("#peek").textContent);
    if (who === "sawyer") check("privacy: a player never sees another owner's private paragraph or Dossier row in the peek", !/ZQ-SECRET|ZQ-HIDDEN|Zq Secret/.test(all) && /^Bastard son/.test(s.para), s.para.slice(0, 40));
    else check("privacy: Devin sees the private parts he can see on the article", /^ZQ-SECRET/.test(s.para) && /Zq Secret/.test(s.dl), JSON.stringify(s).slice(0, 160));
    await p.keyboard.press("Escape"); await p.waitForTimeout(200); // Saoirse's card sits under the open panel at 1440
    await pk(p, 'main a.index-card[href="/articles/saoirse/"]'); await openP(p);
    const s2 = await st(p);
    if (who === "sawyer") check("privacy: a secret page this viewer may not see gives no fields / text (only the card's own name)", s2.dl === "" && s2.para === "" && s2.name === "Saoirse", JSON.stringify(s2));
    else check("privacy: Devin gets the secret page's content", s2.dl.length > 0, s2.dl);
    await ctx.close();
  }
}

async function emptyFieldTests(browser) {
  const raw = fs.readFileSync(path.join(ROOT, "articles/vaerek/index.html"), "utf8");
  const rows = '<dt>Age</dt><dd></dd><dt>Race</dt><dd> <br> </dd><dt>Titles</dt><dd>&mdash;</dd><dt>Homeland</dt><dd>TBD</dd><dt>Relatives</dt><dd>?</dd>';
  const doc1 = raw.replace("</dl></section>", rows + "</dl></section>");
  const doc2 = raw.replace(/<dl class="art-dossier">[\s\S]*?<\/dl>/, '<dl class="art-dossier">' + rows + "</dl>");
  if (doc1 === raw || doc2 === raw) { check("empty fields: fixture built", false); return; }
  const ctx = await ctxFor(browser, "sawyer"); const p = await ctx.newPage(); const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  await ctx.route(BASE + "articles/vaerek/", (r) => r.fulfill({ status: 200, contentType: "text/html", body: doc1 }));
  await ctx.route(BASE + "articles/saoirse/", (r) => r.fulfill({ status: 200, contentType: "text/html", body: doc2.replace(/Vaerek Rathkin/g, "Saoirse") }));
  await p.goto(BASE + "articles/vaerek/", { waitUntil: "load" });
  const shown = () => p.evaluate(() => [...document.querySelectorAll("dl.art-dossier > dt")].filter((d) => d.getClientRects().length).map((d) => d.textContent).join("|"));
  const v = await shown();
  check("empty fields: viewers see only filled Dossier fields (blank, whitespace/<br>, —, TBD, ? are hidden) on any article", v === "Name|Pronunciation|Faction", v);
  await p.evaluate(() => document.documentElement.classList.add("ee-editing"));
  const e = await shown();
  check("empty fields: edit mode shows every row", e === "Name|Pronunciation|Faction|Age|Race|Titles|Homeland|Relatives", e);
  await p.evaluate(() => document.documentElement.classList.remove("ee-editing"));
  await p.goto(BASE + "articles/saoirse/", { waitUntil: "load" });
  const hid = await p.evaluate(() => getComputedStyle(document.getElementById("dossier")).display);
  check("empty fields: a Dossier whose fields are all unfilled is hidden, heading too", hid === "none", hid);
  await p.goto(BASE + "index/ancients/", { waitUntil: "load" });
  await pk(p, VA); await openP(p);
  const s = await st(p);
  check("empty fields: the peek uses the same rule", s.dl === "Pronunciation|Faction", s.dl);
  check("empty fields: no page errors", errs.length === 0, errs.join(" | "));
  await ctx.close();
}

async function phoneTests(browser) {
  const ctx = await ctxFor(browser, "sawyer", { width: 390, height: 844 }, { hasTouch: true, isMobile: true }); const p = await ctx.newPage(); const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  await p.goto(BASE + "index/ancients/", { waitUntil: "load" });
  const t = await p.$('#section-bar .sec-toggle[aria-expanded="true"]'); if (t) await t.tap();
  await p.waitForTimeout(300);
  const a = await p.$(VA); await a.scrollIntoViewIfNeeded();
  const cdp = await ctx.newCDPSession(p);
  const bb = await a.boundingBox(), tp = [{ x: bb.x + bb.width / 2, y: bb.y + bb.height / 2 }];
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: tp }); await p.waitForTimeout(650);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await openP(p); await p.waitForTimeout(450);
  check("cc1 phone: a long-press on a card opens the preview and stays on the Index", p.url().endsWith("/index/ancients/") && (await st(p)).open, p.url());
  const box = await p.evaluate(() => { const r = document.querySelector("#peek").getBoundingClientRect(); return { l: r.left, w: r.width, t: Math.round(r.top), b: Math.round(r.bottom), nav: parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--nav-bottom")), sw: document.documentElement.scrollWidth }; });
  check("phone: the preview is a full-width sheet below the nav; nothing scrolls sideways", box.l === 0 && box.w === 390 && box.t === box.nav && box.b === 844 && box.sw === 390, JSON.stringify(box));
  await p.goBack(); await p.waitForTimeout(400);
  check("phone: Back closes the sheet", !(await st(p)).open && p.url().endsWith("/index/ancients/"));
  const a2 = await p.$(VA); await a2.scrollIntoViewIfNeeded();
  await Promise.all([p.waitForURL(/\/articles\/vaerek\/$/, { timeout: 8000 }), a2.tap()]);
  check("cc1 phone: tapping a card goes straight to its article", /\/articles\/vaerek\/$/.test(p.url()), p.url());
  await p.goto(BASE + "articles/vaerek/", { waitUntil: "load" });
  const l = await p.$('main a[href="/articles/galand-helviath/"]'); await l.scrollIntoViewIfNeeded();
  await Promise.all([p.waitForURL(/galand-helviath/, { timeout: 8000 }), l.tap()]);
  check("phone: tapping an article link just follows it (no hover card)", /galand-helviath/.test(p.url()) && !(await p.$("#hover-card.hover-card-on")), p.url());
  check("phone: no page errors", errs.length === 0, errs.join(" | "));
  await ctx.close();
}

async function hoverTests(browser) {
  const ctx = await ctxFor(browser, "sawyer"); const p = await ctx.newPage(); const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  await p.goto(BASE + "articles/vaerek/", { waitUntil: "load" });
  const L = 'main a[href="/articles/galand-helviath/"]';
  const l = await p.$(L); await l.scrollIntoViewIfNeeded();
  await p.mouse.move(5, 300);
  const r = await l.boundingBox();
  await p.mouse.move(r.x + r.width / 2, r.y + r.height / 2);
  await p.waitForTimeout(120);
  const early = await p.$("#hover-card.hover-card-on");
  await p.waitForSelector("#hover-card.hover-card-on", { timeout: 4000 });
  const c = await p.evaluate(() => { const h = document.getElementById("hover-card"); const b = h.getBoundingClientRect(); return { name: h.querySelector(".hover-card-name").textContent, ep: (h.querySelector(".hover-card-ep") || {}).textContent, dl: [...h.querySelectorAll("dt")].map((d) => d.textContent).join("|"), img: !!h.querySelector("img"), w: Math.round(b.width), inside: b.left >= 0 && b.right <= innerWidth && b.top >= 0 && b.bottom <= innerHeight }; });
  check("hover: a link to an article shows its card after the delay (not instantly): art, name, epithet, ≤3 filled fields, ~280px, on screen", !early && c.name === "Galand Helviath" && c.ep && c.img && c.dl.split("|").length <= 3 && !/Name/.test(c.dl) && c.w === 280 && c.inside, JSON.stringify(c));
  const hit = await p.evaluate((sel) => { const a = document.querySelector(sel), b = a.getBoundingClientRect(); const e = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2); return e === a || a.contains(e); }, L);
  check("hover: the card never covers the link (still clickable)", hit);
  const hb = await p.$eval("#hover-card", (h) => { const b = h.getBoundingClientRect(); return { x: b.left + 40, y: b.top + 40 }; });
  await p.mouse.move(r.x + r.width / 2, r.y + r.height + 4); await p.mouse.move(hb.x, hb.y, { steps: 3 }); await p.waitForTimeout(300);
  check("hover: moving onto the card keeps it open (grace)", !!(await p.$("#hover-card.hover-card-on")));
  await p.mouse.move(5, 300); await p.waitForTimeout(400);
  check("hover: leaving hides it", !(await p.$("#hover-card.hover-card-on")));
  await p.evaluate(() => document.documentElement.classList.add("ee-editing"));
  await p.mouse.move(r.x + r.width / 2, r.y + r.height / 2); await p.waitForTimeout(700);
  check("hover: off in edit mode", !(await p.$("#hover-card.hover-card-on")));
  await p.evaluate(() => document.documentElement.classList.remove("ee-editing"));
  await p.mouse.move(5, 300); await p.waitForTimeout(300);
  await p.goto(BASE + "index/ancients/", { waitUntil: "load" });
  await p.hover(VA); await p.waitForTimeout(700);
  check("hover: no hover cards on the Index (cards have their own epithet reveal)", !(await p.$("#hover-card.hover-card-on")));
  check("hover: no page errors", errs.length === 0, errs.join(" | "));
  await ctx.close();
}

(async () => {
  const srv = await serverForTests(); BASE = srv.base;
  const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ["--no-sandbox"] });
  try {
    for (const [n, fn] of [["peek", peekTests], ["privacy", privacyTests], ["empty", emptyFieldTests], ["phone", phoneTests], ["hover", hoverTests]]) {
      try { await fn(browser); } catch (e) { check(n + " stage ran without exceptions", false, e.stack.split("\n").filter((l) => !/^\s+-/.test(l)).slice(0, 4).join(" ")); }
    }
  } finally { await browser.close(); srv.close(); }
  const fail = results.filter((r) => !r.ok);
  console.log(`\n${results.length - fail.length}/${results.length} passed`);
  process.exit(fail.length ? 1 : 0);
})();
