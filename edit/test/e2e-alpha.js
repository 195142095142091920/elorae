/* E2E: Index cards and Categories rails stay A to Z by name, ignoring a leading "The" (media.js
   sortIndex + index-org.js sortBox, ia1). Checks the files as they are, then every way a card's
   place can change: organizer Add card, move between sections (select + Categories, drag), a drag
   inside a section (ignored, with the hint), and an article rename from the editor.
   Run: PLAYWRIGHT=<path> CHROME=/usr/bin/google-chrome node edit/test/e2e-alpha.js */
"use strict";
const fs = require("fs");
const path = require("path");
const cp = require("child_process");
const { chromium } = require(process.env.PLAYWRIGHT || "playwright-core");
const { MockGitHub } = require("./mock-github.js");
const { serverForTests, ROOT } = require("./server.js");

const REPO = "195142095142091920/elorae";
const OUT = process.env.SHOTS || "/tmp/ee-alpha";
fs.mkdirSync(OUT, { recursive: true });
const PROFILES = { repo: REPO, profiles: {
  "devin-gh": { name: "Devin", person: "devin", role: "admin", title: "GM", permissions: ["**"], save: "direct" },
  "sawyer-gh": { name: "Sawyer", person: "sawyer", role: "editor", permissions: ["articles/vaerek.html"], save: "pr", characters: ["Vaerek Rathkin"] },
  "jack-gh": { name: "Jack", person: "jack", role: "editor", permissions: ["articles/galand-helviath.html"], save: "pr", characters: ["Galand Helviath"] } } };
const results = [];
function check(name, ok, detail) { results.push({ name, ok: !!ok, detail }); console.log((ok ? "PASS " : "FAIL ") + name + (detail ? "  — " + detail : "")); }
function newMock() { return new MockGitHub({ repo: REPO, root: ROOT, tokens: { "ghp_test_devin": "devin-gh", "ghp_test_sawyer": "sawyer-gh" }, overrides: { "edit/profiles.json": JSON.stringify(PROFILES, null, 2) } }); }
const VPS = { desktop: { width: 1366, height: 860 }, phone: { width: 390, height: 844 }, tablet: { width: 820, height: 1180 } };
let BASE;

async function ctxFor(browser, mock, vp, who) {
  who = who || "devin";
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1, reducedMotion: "reduce" });
  await ctx.route("https://api.github.com/**", (r) => mock.handle(r));
  await ctx.route((u) => u.href.startsWith(BASE) && /\/edit\/(visibility\.json|secrets\/[^/?]+\.json)$/.test(u.pathname), (r) => {
    const t = mock.file(new URL(r.request().url()).pathname.replace(/^\//, ""));
    return t == null ? r.fulfill({ status: 404, body: "" }) : r.fulfill({ status: 200, contentType: "application/json", body: t });
  });
  await ctx.route((u) => !u.href.startsWith(BASE) && !u.href.startsWith("data:") && !u.href.startsWith("https://api.github.com"), (r) => r.abort());
  // Signed-in site owner (passes the login gate) with a remembered edit session.
  const sess = JSON.stringify({ token: "ghp_test_" + who, login: who + "-gh", person: who, role: who === "devin" ? "admin" : "editor", remember: true });
  await ctx.addInitScript(`try{localStorage.setItem("elorae-edit-session",${JSON.stringify(sess)});localStorage.setItem("elorae-login",${JSON.stringify(who)});document.cookie="elorae-login=${who};path=/";}catch(e){}`);
  return ctx;
}
function watch(page) {
  const errs = [], dialogs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  page.on("dialog", (d) => {
    dialogs.push(d.type() + ": " + d.message());
    const a = page._answer; page._answer = undefined;
    if (a === true) d.accept().catch(() => {}); else if (typeof a === "string") d.accept(a).catch(() => {}); else d.dismiss().catch(() => {});
  });
  return { errs, dialogs };
}
async function openEdit(page, url) {
  await page.goto(BASE + url, { waitUntil: "load" });
  await page.waitForFunction(() => window.EloraeEditor && window.EloraeEditor.state && window.EloraeEditor.state.profile, null, { timeout: 15000 });
  await page.evaluate(() => window.EloraeEditor.tryEnterEdit());
  await page.waitForSelector("#ee-save", { timeout: 15000 });
  await page.waitForTimeout(250);
}
const Media = require("../media.js");
const IDX = "index/ancients/index.html", IDX2 = "index/ancients.html";
const key = (t) => Media.sortKey(t);
const inOrder = (names) => names.every((x, i) => !i || Media.compareNames(names[i - 1], x) <= 0);
const CARD = /<a\b[^>]*\bclass="index-card\b[^"]*"[^>]*>[\s\S]*?<\/a>/g, TOC = /<a\b[^>]*\bclass="toc-name\b[^"]*"[^>]*>[^<]*<\/a>/g;
// Every run of consecutive cards (one box) and rail entries (one list) in a file, as names.
function runs(text, re, nameOf) {
  const out = []; let cur = null, last = -1, m; re.lastIndex = 0;
  while ((m = re.exec(text))) { if (!cur || !/^\s*$/.test(text.slice(last, m.index))) out.push(cur = []); cur.push(nameOf(m[0])); last = m.index + m[0].length; }
  return out;
}
const cardRuns = (t) => runs(t, CARD, (h) => Media.sortKey((/<span>([\s\S]*?)<\/span>/.exec(h) || [])[1] || ""));
const tocRuns = (t) => runs(t, TOC, (h) => Media.sortKey(h.replace(/^<a\b[^>]*>|<\/a>$/g, "")));
const allSorted = (t) => cardRuns(t).every(inOrder) && tocRuns(t).every(inOrder);
function unsorted(t) { return cardRuns(t).concat(tocRuns(t)).filter((r) => !inOrder(r)).map((r) => r.join(",")).slice(0, 2).join(" | "); }

function staticChecks() {
  const a = fs.readFileSync(path.join(ROOT, IDX), "utf8"), b = fs.readFileSync(path.join(ROOT, IDX2), "utf8");
  check("files: both Index copies identical", a === b);
  check("files: every Index section's cards and its Categories list are A to Z (leading 'The' ignored)", allSorted(a), unsorted(a));
  const div = cardRuns(a.slice(a.indexOf('id="divines"'), a.indexOf("</section>", a.indexOf('id="divines"'))))[0] || [];
  check("files: the Divines are all there, A to Z", div.length >= 33 && inOrder(div), div.length + " " + div.slice(0, 4).join(","));
  let bad = [];
  for (const d of fs.readdirSync(path.join(ROOT, "articles"))) {
    const f = path.join(ROOT, "articles", d, "index.html"); if (!fs.existsSync(f)) continue;
    const t = fs.readFileSync(f, "utf8"), i = t.indexOf('<nav class="art-index-panel"'); if (i < 0) continue;
    const nav = t.slice(i, t.indexOf("</nav>", i));
    if (!tocRuns(nav).every(inOrder)) bad.push(d);
  }
  check("files: every article page's Categories rail is A to Z too", bad.length === 0, bad.slice(0, 5).join(","));
  // sortIndex itself: puts a shuffled box back, ignores "The" and case, leaves everything else alone.
  const box = '<div class="index-cards"><a class="index-card" href="/articles/c/"><span>the Zed</span></a><a class="index-card" href="/articles/a/"><span>Bryn</span></a><a class="index-card" href="/articles/b/"><span>The Ash</span></a></div><p>x</p><div class="toc-group"><a class="toc-sub" href="#s">S</a><a class="toc-name" href="#z">The Zed</a><a class="toc-name" href="#a">ash</a></div>';
  const s = Media.sortIndex(box);
  check("sortIndex: A to Z ignoring a leading 'The' and case, rail too, nothing else moves",
    /The Ash[\s\S]*Bryn[\s\S]*the Zed/.test(s) && /toc-sub[\s\S]*ash<\/a><a class="toc-name" href="#z">The Zed/.test(s) && s.includes("</div><p>x</p><div") && Media.sortIndex(s) === s && key("The Ash") === "Ash", s.slice(0, 200));
}

const secNames = (page, sel) => page.evaluate((s) => [...document.querySelectorAll(s)].map((a) => (a.querySelector("span") || a).textContent.replace(/\s+/g, " ").trim()), sel);
const savedSec = (t, id) => { const i = t.indexOf('<section class="index-cat" id="' + id + '"'); return cardRuns(t.slice(i, t.indexOf("</section>", i))); };
const savedToc = (t, id) => { const i = t.indexOf('id="index-toc-panel"'), j = t.indexOf('href="#' + id + '"', i); return tocRuns(t.slice(j, t.indexOf('<div class="toc-cat', j + 1)))[0] || []; };

async function organizer(browser, vpName) {
  const vp = VPS[vpName];
  const mock = newMock(); const ctx = await ctxFor(browser, mock, vp); const page = await ctx.newPage(); const W = watch(page);
  const T = (p) => String(mock.file(p));
  await page.goto(BASE + "index/ancients/", { waitUntil: "load" });
  await page.waitForFunction(() => window.EloraeEditor && window.EloraeEditor.state.profile && window.EloraeIndexOrg, null, { timeout: 15000 });
  await page.evaluate(() => window.EloraeEditor.tryEnterEdit()); await page.waitForSelector("#ee-idx-save", { timeout: 15000 }); await page.waitForTimeout(300);
  const hint = await page.evaluate(() => getComputedStyle(document.getElementById("ee-bar"), "::before").content);
  check(`[${vpName}] organizer: hint says order is automatic`, /sort A.Z .*automatically/.test(hint) && /another category/.test(hint), hint);
  // Add card "Aaz Zq" in Divines: first on screen, first in the saved file (both copies) and rail.
  await page.evaluate(() => document.querySelector("#divines a.index-card").click());
  page._answer = "Aaz Zq"; await page.click("#ee-idx-add");
  await page.waitForSelector("#ee-tpl-pick [data-tpl]", { timeout: 5000 }); await page.click('#ee-tpl-pick [data-tpl=""]');
  await page.waitForFunction(() => /Added|failed|exists/i.test((document.getElementById("ee-bar") || {}).textContent || ""), null, { timeout: 20000 });
  let on = await secNames(page, "#divines a.index-card"), sv = T(IDX);
  check(`[${vpName}] Add card: the new card lands in its A to Z place on screen and in the saved Index + rail (one save)`,
    on[0] === "Aaz Zq" && inOrder(on.map(key)) && savedSec(sv, "divines")[0][0] === "Aaz Zq" && savedToc(sv, "divines")[0] === "Aaz Zq" && sv === T(IDX2) && allSorted(sv), on.slice(0, 3).join(",") + " | " + savedToc(sv, "divines").slice(0, 3));
  // Move Aghor (Ancients) to Vignettes via select + Categories: goes first (A), saved that way.
  await page.evaluate(() => document.querySelector('#ancients a.index-card[href="/articles/aghor/"]').click()); await page.waitForTimeout(120);
  await page.evaluate(() => document.querySelector('#index-toc-panel a[href="#vignettes"]').click()); await page.waitForTimeout(250);
  on = await secNames(page, "#vignettes a.index-card");
  const railOn = await secNames(page, '#index-toc-panel a[href="#vignettes"]').then(() => page.evaluate(() => [...document.querySelector('#index-toc-panel a[href="#vignettes"]').closest(".toc-cat").querySelectorAll("a.toc-name")].map((a) => a.textContent.trim())));
  check(`[${vpName}] move (select + Categories): card goes to its A to Z place, rail follows`, on[0] === "Aghor" && inOrder(on.map(key)) && railOn[0] === "Aghor" && inOrder(railOn.map(key)), on.slice(0, 3).join(",") + " | " + railOn.slice(0, 3));
  // Drag inside Divines: ignored, hint in the bar, order unchanged.
  const before = (await secNames(page, "#divines a.index-card")).join(",");
  await page.evaluate(() => {
    const cards = document.querySelectorAll("#divines a.index-card"), src = cards[cards.length - 1], dst = cards[1], dt = new DataTransfer();
    src.dispatchEvent(new DragEvent("dragstart", { bubbles: true, cancelable: true, dataTransfer: dt }));
    const r = dst.getBoundingClientRect(), x = r.left + 5, y = r.top + 5;
    dst.dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer: dt, clientX: x, clientY: y }));
    dst.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: dt, clientX: x, clientY: y }));
    src.dispatchEvent(new DragEvent("dragend", { bubbles: true, dataTransfer: dt }));
  });
  await page.waitForTimeout(150);
  check(`[${vpName}] drag inside a section: ignored (A to Z kept), the bar says why`, (await secNames(page, "#divines a.index-card")).join(",") === before && /sort A\u2013Z by name automatically/.test(await page.textContent("#ee-bar")), (await page.textContent("#ee-bar")).slice(0, 90));
  await page.click("#ee-idx-save");
  await page.waitForFunction(() => /Saved|failed/i.test((document.getElementById("ee-bar") || {}).textContent || ""), null, { timeout: 20000 });
  sv = T(IDX);
  check(`[${vpName}] save after a move: Vignettes saved A to Z with Aghor first, whole file A to Z, copies identical`, savedSec(sv, "vignettes")[0][0] === "Aghor" && savedToc(sv, "vignettes")[0] === "Aghor" && allSorted(sv) && sv === T(IDX2), unsorted(sv));
  check(`[${vpName}] organizer: no page errors`, W.errs.length === 0, W.errs.join(" | "));
  await ctx.close();
}

// Article rename in the editor: "Amora" -> "Zz Amora" moves its card(s) and rail entry to the end, same commit.
async function rename(browser) {
  const mock = newMock(); const ctx = await ctxFor(browser, mock, VPS.desktop); const page = await ctx.newPage(); const W = watch(page);
  await openEdit(page, "articles/amora/");
  await page.evaluate(() => { const h = document.querySelector(".art-title h1"); h.focus(); const r = document.createRange(); r.selectNodeContents(h); const s = getSelection(); s.removeAllRanges(); s.addRange(r); });
  await page.keyboard.type("Zz Amora");
  mock.log.length = 0;
  await page.click("#ee-save");
  await page.waitForFunction(() => /Saved|failed|conflict/i.test((document.getElementById("ee-bar") || {}).textContent || ""), null, { timeout: 20000 });
  const sv = String(mock.file(IDX)), d = savedSec(sv, "divines")[0] || [], r = savedToc(sv, "divines");
  const commits = mock.log.filter((e) => e.committed);
  check("[desktop] rename in the editor: the card and its rail entry move to their new A to Z place in the same commit (both copies)",
    d[d.length - 1] === "Zz Amora" && r[r.length - 1] === "Zz Amora" && allSorted(sv) && sv === String(mock.file(IDX2)) && commits.length === 1 && commits[0].committed.paths.includes(IDX),
    JSON.stringify({ last: d[d.length - 1], rail: r[r.length - 1], commits: commits.length, unsorted: unsorted(sv) }));
  check("[desktop] rename: no page errors", W.errs.length === 0, W.errs.join(" | "));
  await ctx.close();
}

// Viewer: the Index and an article rail show the lists A to Z.
async function viewer(browser) {
  const ctx = await browser.newContext({ viewport: VPS.desktop }); const page = await ctx.newPage();
  await ctx.addInitScript(() => { try { localStorage.setItem("elorae-guest", "1"); } catch (e) {} });
  await page.goto(BASE + "index/ancients/", { waitUntil: "load" }); await page.waitForTimeout(500);
  const ok1 = await page.evaluate(() => [...document.querySelectorAll("main.index-flow .index-cards")].map((b) => [...b.querySelectorAll("a.index-card span")].map((s) => s.textContent)));
  await page.goto(BASE + "articles/aghor/", { waitUntil: "load" }); await page.waitForTimeout(800);
  const ok2 = await page.evaluate(() => [...document.querySelectorAll("#art-index-panel .toc-nest, #art-index-panel .toc-group")].map((g) => [...g.querySelectorAll(":scope > a.toc-name")].map((a) => a.textContent)));
  check("viewer: Index boxes and the article rail lists read A to Z", ok1.every((r) => inOrder(r)) && ok2.every((r) => inOrder(r)) && ok2.some((r) => r.length > 20), ok1.filter((r) => !inOrder(r)).concat(ok2.filter((r) => !inOrder(r))).map((r) => r.join(",")).slice(0, 2).join(" | "));
  await ctx.close();
}

(async () => {
  staticChecks();
  const srv = await serverForTests(); BASE = srv.base;
  const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ["--no-sandbox"] });
  try {
    for (const vpName of ["desktop", "phone"]) {
      try { await organizer(browser, vpName); } catch (e) { check(`[${vpName}] organizer stage ran without exceptions`, false, e.stack.split("\n").slice(0, 3).join(" ")); }
    }
    try { await rename(browser); } catch (e) { check("rename stage ran without exceptions", false, e.stack.split("\n").slice(0, 3).join(" ")); }
    try { await viewer(browser); } catch (e) { check("viewer stage ran without exceptions", false, e.stack.split("\n").slice(0, 3).join(" ")); }
  } finally { await browser.close(); srv.close(); }
  const fail = results.filter((r) => !r.ok);
  console.log(`\n${results.length - fail.length}/${results.length} passed`);
  process.exit(fail.length ? 1 : 0);
})();
