/* E2E: quick visibility control (edit/visset.js vt1) on the article edit bar and on Index cards in
   the organizer, plus gating as Guest / Sawyer (shared) / Jack (not shared) / Devin.
   Run: PLAYWRIGHT=<path> CHROME=/usr/bin/google-chrome node edit/test/e2e-vis.js
   The browser is served the mock's main for every file a save changed, so gating is checked on
   exactly what was committed. SHOTS=<dir> also writes vis-toggle-article-1440.png / -card-1440.png. */
"use strict";
const fs = require("fs");
const path = require("path");
const { chromium } = require(process.env.PLAYWRIGHT || "playwright-core");
const { MockGitHub } = require("./mock-github.js");
const { serverForTests, ROOT } = require("./server.js");
const VS = require("../visset.js");

const REPO = "195142095142091920/elorae";
const OUT = process.env.SHOTS || "/tmp/ee-vis";
fs.mkdirSync(OUT, { recursive: true });
const PROFILES = { repo: REPO, profiles: {
  "devin-gh": { name: "Devin", person: "devin", role: "admin", title: "GM", permissions: ["**"], save: "direct" },
  "sawyer-gh": { name: "Sawyer", person: "sawyer", role: "editor", permissions: ["articles/vaerek.html"], save: "pr" },
  "julie-gh": { name: "Julie", person: "julie", role: "editor", permissions: ["articles/saoirse.html"], save: "pr" } } };
const results = [];
function check(name, ok, detail) { results.push({ name, ok: !!ok, detail }); console.log((ok ? "PASS " : "FAIL ") + name + (detail ? "  — " + detail : "")); }
const disk = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
let BASE, mock;
const VP = { width: 1440, height: 900 };

function repoPathOf(u) {
  let p = decodeURIComponent(u.pathname).replace(/^\//, "");
  if (p === "" || p.endsWith("/")) p += "index.html";
  return p;
}
async function ctxFor(browser, who, edit) {
  const ctx = await browser.newContext({ viewport: VP, deviceScaleFactor: 1, reducedMotion: "reduce" });
  await ctx.route("https://api.github.com/**", (r) => mock.handle(r));
  // Same-origin: whatever main has after the saves (falls through to disk for untouched files).
  await ctx.route((u) => u.href.startsWith(BASE), (r) => {
    const u = new URL(r.request().url()), p = repoPathOf(u);
    const head = mock.commits[mock.heads.main].files;
    if (Object.prototype.hasOwnProperty.call(head, p) && head[p] != null) {
      const ct = /\.json$/.test(p) ? "application/json" : /\.js$/.test(p) ? "application/javascript" : /\.css$/.test(p) ? "text/css" : "text/html; charset=utf-8";
      return r.fulfill({ status: 200, contentType: ct, body: Buffer.isBuffer(head[p]) ? head[p] : String(head[p]) });
    }
    return r.continue();
  });
  await ctx.route((u) => !u.href.startsWith(BASE) && !u.href.startsWith("data:") && !u.href.startsWith("https://api.github.com"), (r) => r.abort());
  let init = "";
  if (who === "guest") init = `localStorage.setItem("elorae-guest","1");`;
  else init = `localStorage.setItem("elorae-login",${JSON.stringify(who)});document.cookie="elorae-login=${who};path=/";`;
  if (edit) {
    const sess = JSON.stringify({ token: "ghp_test_" + who, login: who + "-gh", person: who, role: who === "devin" ? "admin" : "editor", remember: true });
    init += `localStorage.setItem("elorae-edit-session",${JSON.stringify(sess)});`;
  }
  await ctx.addInitScript(`try{${init}}catch(e){}`);
  return ctx;
}
function watch(page) { const errs = []; page.on("pageerror", (e) => errs.push(e.message)); page.on("dialog", (d) => d.dismiss().catch(() => {})); return errs; }
async function enterEdit(page, url) {
  await page.goto(BASE + url, { waitUntil: "load" });
  await page.waitForFunction(() => window.EloraeEditor && window.EloraeEditor.state && window.EloraeEditor.state.profile, null, { timeout: 15000 });
  await page.evaluate(() => window.EloraeEditor.tryEnterEdit());
}
function commitsSince(n) { return mock.log.slice(n).filter((e) => e.committed); }
function priv(tag, owner) { return tag && / class="[^"]*\bprivate\b/.test(tag) && tag.includes('data-owner="' + owner + '"'); }
function tags(text, re) { return text.match(re) || []; }

(async () => {
  // ---- pure helpers ----
  const idx = disk("index/ancients.html");
  ["yena", "cursed-of-olesh", "bel-harath"].forEach((s) => {
    const sec = JSON.parse(disk("edit/visibility.json")).secrets;
    const id = Object.keys(sec).find((k) => sec[k].path === "articles/" + s + ".html");
    check(`helpers: re-applying ${s}'s current mark changes nothing (same model as the existing secrets)`, VS.applyIndex(idx, s, sec[id].owner).text === idx && VS.applyArticle(disk("articles/" + s + ".html"), s, sec[id].owner).text === disk("articles/" + s + ".html"));
  });
  const x = VS.applyIndex(idx, "saoirse", "devin");
  check("helpers: Saoirse's 3 Index cards + 3 Categories entries", x.cards === 3 && x.rail === 3, x.cards + "/" + x.rail);
  check("helpers: Everyone restores the Index byte for byte", VS.applyIndex(x.text, "saoirse", null).text === idx);

  const srv = await serverForTests(); BASE = srv.base;
  mock = new MockGitHub({ repo: REPO, root: ROOT, tokens: { "ghp_test_devin": "devin-gh", "ghp_test_sawyer": "sawyer-gh" }, overrides: { "edit/profiles.json": JSON.stringify(PROFILES, null, 2) } });
  const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ["--no-sandbox"] });
  try {
    // ---- 1) Article edit bar: Saoirse -> Sawyer (+ Devin), with one clash retried ----
    let ctx = await ctxFor(browser, "devin", true), page = await ctx.newPage(), errs = watch(page);
    await enterEdit(page, "articles/saoirse/");
    await page.waitForSelector("#ee-vis", { timeout: 15000 });
    await page.waitForFunction(() => /^Visibility: /.test(document.querySelector("#ee-vis").getAttribute("aria-label") || ""), null, { timeout: 5000 });
    const visLbl = () => page.getAttribute("#ee-vis", "aria-label");
    check("article: Visibility button on the edit bar shows the state (Everyone)", /Everyone/.test(await visLbl()), await visLbl());
    check("article: the old Share button is replaced", !(await page.$("#ee-share")));
    await page.click("#ee-vis");
    await page.waitForSelector("#ee-vis-pop .ee-vis-people input", { timeout: 10000 });
    check("article: popover lists Everyone / Devin only / Chosen players + 6 players", (await page.$$("#ee-vis-pop input[name=ee-vis-mode]")).length === 3 && (await page.$$("#ee-vis-pop .ee-vis-people input")).length === 6);
    check("article: popover marks whose character it is (\u2605 by Julie), no help text", /Julie\s*\u2605/.test(await page.textContent("#ee-vis-pop .ee-vis-people")) && !(await page.$("#ee-vis-pop .ee-vis-note")) && !/guests too/.test(await page.textContent("#ee-vis-pop")));
    check("article: Cancel / Save are icon buttons", await page.evaluate(() => ["cancel", "save"].every((a) => { const b = document.querySelector('#ee-vis-pop [data-vis-act="' + a + '"]'); return b && b.classList.contains("ee-ic") && !!b.querySelector("svg") && !b.textContent.trim(); })));
    await page.check('#ee-vis-pop .ee-vis-people input[value="sawyer"]');
    check("article: ticking a player switches to Chosen players", await page.isChecked('#ee-vis-pop input[value="players"]'));
    await page.screenshot({ path: path.join(OUT, "vis-toggle-article-1440.png") });
    let raced = false;
    mock.hooks.before = (e) => { if (!raced && e.method === "PATCH" && /git\/refs\/heads/.test(e.path)) { raced = true; mock.setUpstream("README.md", disk("README.md") + "\nclash\n"); } };
    const n0 = mock.log.length;
    await page.click('#ee-vis-pop [data-vis-act="save"]');
    await page.waitForSelector("#ee-vis-pop", { state: "detached", timeout: 20000 });
    mock.hooks.before = null;
    const c1 = commitsSince(n0);
    check("article: one commit after one clash retry (E.retrySave)", raced && c1.length === 1, c1.map((c) => c.committed.message).join(" | "));
    const changed = c1[0] ? c1[0].committed.message : "";
    check("article: commit message names the people", /Saoirse .* shown to devin, sawyer/.test(changed), changed);
    const art1 = String(mock.file("articles/saoirse.html")), art2 = String(mock.file("articles/saoirse/index.html"));
    [["articles/saoirse.html", art1], ["articles/saoirse/index.html", art2]].forEach(([p, t]) => {
      check(`article: ${p} hero + body private (data-owner devin)`, priv((t.match(/<section\b[^>]*art-hero[^>]*>/) || [])[0], "devin") && priv((t.match(/<main\b[^>]*art-body[^>]*>/) || [])[0], "devin"));
      check(`article: ${p} own Categories entries marked`, tags(t, /<a class="toc-name[^>]*href="\/articles\/saoirse\/"[^>]*>/g).every((g) => priv(g, "devin")));
    });
    ["index/ancients.html", "index/ancients/index.html"].forEach((p) => {
      const t = String(mock.file(p));
      const cards = tags(t, /<a class="index-card[^>]*href="\/articles\/saoirse\/"[^>]*>/g), rail = tags(t, /<a class="toc-name[^>]*href="#[a-z-]+-saoirse"[^>]*>/g);
      check(`index: ${p} all 3 Saoirse cards + 3 rail entries private`, cards.length === 3 && rail.length === 3 && cards.concat(rail).every((g) => priv(g, "devin")), cards.length + "/" + rail.length);
      const before = disk(p).length, after = t.length;
      check(`index: ${p} only those tags changed`, after - before === 6 * ' private data-owner="devin"'.length, after - before + " bytes");
    });
    const man = JSON.parse(mock.file("edit/visibility.json")).secrets.saoirse;
    check("manifest: saoirse { owner devin, allowed [devin, sawyer], everyone false }", man && man.owner === "devin" && JSON.stringify(man.allowed) === '["devin","sawyer"]' && man.everyone === false && man.path === "articles/saoirse.html", JSON.stringify(man));
    const si = String(mock.file("search-index.js")); const se = JSON.parse(si.slice(si.indexOf("["), si.lastIndexOf("]") + 1)).find((e) => e.href === "articles/saoirse.html");
    check("search index: Saoirse private (owner devin)", se && se.private === true && se.owner === "devin");
    check("article: bar shows the new state at a glance", /Sawyer/.test(await visLbl()) && /Visible to Sawyer/.test(await page.textContent("body")), await visLbl());
    check("article: live page updated (hero/body private)", await page.evaluate(() => document.querySelector("main.art-body").classList.contains("private") && document.querySelector("section.art-hero").getAttribute("data-owner") === "devin"));
    // A text save afterwards keeps the mark.
    await page.evaluate(() => { const p = document.querySelector("main.art-body #lore p") || document.querySelector("main.art-body p"); p.textContent = p.textContent + " Zqv"; p.dispatchEvent(new Event("input", { bubbles: true })); });
    await page.click("#ee-save"); await page.waitForTimeout(2500);
    const art3 = String(mock.file("articles/saoirse/index.html"));
    check("article: a later text save keeps the visibility mark", art3.includes("Zqv") && priv((art3.match(/<main\b[^>]*art-body[^>]*>/) || [])[0], "devin"));
    check("article: no page errors (Devin)", !errs.length, errs.join(" | "));
    await ctx.close();

    // ---- 2) Index organizer: per-card marks + Baiji -> Devin only ----
    ctx = await ctxFor(browser, "devin", true); page = await ctx.newPage(); errs = watch(page);
    await enterEdit(page, "index/ancients/");
    await page.waitForSelector("#ee-idx-save", { timeout: 15000 });
    await page.waitForFunction(() => document.querySelectorAll(".ee-index-vis").length > 50, null, { timeout: 10000 });
    const marks = await page.evaluate(() => ({ n: document.querySelectorAll("main.index-flow a.index-card").length, b: document.querySelectorAll("main.index-flow a.index-card > .ee-index-vis").length,
      sa: Array.from(document.querySelectorAll('a.index-card[href="/articles/saoirse/"] .ee-index-vis')).map((b) => b.getAttribute("data-mode") + b.textContent),
      yena: (document.querySelector('a.index-card[href="/articles/yena/"] .ee-index-vis') || {}).title,
      cursed: (document.querySelector('a.index-card[href="/articles/cursed-of-olesh/"] .ee-index-vis') || {}).getAttribute("data-mode") }));
    check("organizer: a visibility button on every card", marks.n === marks.b, marks.b + "/" + marks.n);
    check("organizer: Saoirse's 3 cards marked limited (1 player)", marks.sa.length === 3 && marks.sa.every((m) => m === "players1"), marks.sa.join());
    check("organizer: existing secrets marked (Yena: Devin only since pr1; Cursed of Olesh: Devin only)", /Devin only/.test(marks.yena || "") && !/Jack/.test(marks.yena || "") && marks.cursed === "devin", marks.yena + " / " + marks.cursed);
    const baiji = 'a.index-card[href="/articles/baiji/"] .ee-index-vis';
    await page.locator(baiji).first().scrollIntoViewIfNeeded();
    await page.click(baiji);
    await page.waitForSelector("#ee-vis-pop .ee-vis-people input", { timeout: 10000 });
    check("organizer: clicking the button opens the popover, not card selection", !(await page.$(".ee-index-selected")));
    await page.check('#ee-vis-pop input[value="devin"]');
    await page.screenshot({ path: path.join(OUT, "vis-toggle-card-1440.png") });
    const n1 = mock.log.length;
    await page.click('#ee-vis-pop [data-vis-act="save"]');
    await page.waitForSelector("#ee-vis-pop", { state: "detached", timeout: 20000 });
    const c2 = commitsSince(n1);
    check("organizer: one commit", c2.length === 1, c2.map((c) => c.committed.message).join(" | "));
    const bt = String(mock.file("index/ancients/index.html")), bt2 = String(mock.file("index/ancients.html"));
    check("organizer: both Index copies identical and Baiji card + entry private", bt === bt2 && priv((bt.match(/<a class="index-card[^>]*href="\/articles\/baiji\/"[^>]*>/) || [])[0], "devin") && priv((bt.match(/<a class="toc-name[^>]*href="#[a-z-]+-baiji"[^>]*>/) || [])[0], "devin"));
    check("organizer: Baiji article (both copies) private", ["articles/baiji.html", "articles/baiji/index.html"].every((p) => priv((String(mock.file(p)).match(/<main\b[^>]*art-body[^>]*>/) || [])[0], "devin")));
    check("organizer: Saoirse kept (earlier save not undone)", priv((bt.match(/<a class="index-card[^>]*id="heroes-saoirse"[^>]*>/) || [])[0], "devin"));
    check("organizer: card mark now a lock", await page.evaluate((s) => document.querySelector(s).getAttribute("data-mode") === "devin", baiji));
    // Organizer Save after that: no visibility undone, no runtime buttons in the file.
    await page.evaluate(() => { const h = document.querySelector("main.index-flow section.index-cat#divines > h2"); h.textContent = h.textContent + " Zq"; h.dispatchEvent(new Event("input", { bubbles: true })); h.dispatchEvent(new Event("blur")); });
    await page.click("#ee-idx-save"); await page.waitForTimeout(2500);
    const bt3 = String(mock.file("index/ancients/index.html"));
    check("organizer: a later organizer save keeps both marks and writes no buttons", !bt3.includes("ee-index-vis") && priv((bt3.match(/<a class="index-card[^>]*href="\/articles\/baiji\/"[^>]*>/) || [])[0], "devin") && priv((bt3.match(/<a class="index-card[^>]*id="kindred-saoirse"[^>]*>/) || [])[0], "devin"), bt3.includes("Zq") ? "heading saved" : "heading not saved");
    // Cancel keeps the committed state on screen.
    await page.click("#ee-idx-cancel").catch(() => {}); await page.waitForTimeout(300);
    check("organizer: Cancel leaves the saved visibility on the page", await page.evaluate(() => document.querySelector('a.index-card[href="/articles/baiji/"]').classList.contains("private") && !document.querySelector(".ee-index-vis")));
    check("organizer: no page errors", !errs.length, errs.join(" | "));
    await ctx.close();

    // ---- 3) Players can't change it ----
    ctx = await ctxFor(browser, "sawyer", true); page = await ctx.newPage(); errs = watch(page);
    await page.goto(BASE + "articles/vaerek/#edit", { waitUntil: "load" }); await page.waitForTimeout(1500);
    check("player (nd2): no Edit, no Gallery, no editor at all on Sawyer's own article", !(await page.$("#ee-edit")) && !(await page.$("#ee-gallery")) && !(await page.evaluate(() => !!window.EloraeEditor)) && !(await page.$("#ee-vis")) && !!(await page.$("#login-logout")));
    await ctx.close();

    // ---- 4) Gating as Guest / Sawyer / Jack / Devin ----
    const expect = { guest: false, sawyer: true, jack: false, devin: true };
    for (const who of Object.keys(expect)) {
      const see = expect[who];
      ctx = await ctxFor(browser, who, false); page = await ctx.newPage(); errs = watch(page);
      await page.goto(BASE + "index/ancients/", { waitUntil: "load" }); await page.waitForTimeout(1200);
      const g = await page.evaluate(() => {
        const vis = (n) => !!n && n.getClientRects().length > 0;
        const h = document.getElementById("heartroot");
        return { cards: Array.from(document.querySelectorAll('a.index-card[href="/articles/saoirse/"]')).map(vis),
          rail: Array.from(document.querySelectorAll('#index-toc-panel a.toc-name[href$="-saoirse"]')).map((a) => !a.classList.contains("private") || document.body.classList.contains("login-devin")),
          heart: vis(h), heartToc: vis((document.querySelector('#index-toc-panel a[href="#heartroot"]') || {}).closest ? document.querySelector('#index-toc-panel a[href="#heartroot"]').closest(".toc-group,.toc-cat") : null),
          baiji: vis(document.querySelector('a.index-card[href="/articles/baiji/"]')) };
      });
      check(`${who}: Index — Saoirse cards ${see ? "shown" : "hidden"} (3 copies)`, g.cards.length === 3 && g.cards.every((v) => v === see), g.cards.join());
      check(`${who}: Index — Saoirse Categories entries ${see ? "shown" : "hidden"}`, g.rail.length === 3 && g.rail.every((v) => v === see), g.rail.join());
      check(`${who}: Index — Heartroot (only Saoirse) ${see ? "shown" : "hidden as empty"}`, g.heart === see, "section " + g.heart + ", toc " + g.heartToc);
      check(`${who}: Index — Baiji (Devin only) ${who === "devin" ? "shown" : "hidden"}`, g.baiji === (who === "devin"));
      const pk = await page.evaluate(() => window.EloraePeek.load("saoirse").then((d) => !!d, () => "err"));
      const pb = await page.evaluate(() => window.EloraePeek.load("baiji").then((d) => !!d, () => "err"));
      check(`${who}: peek / hover card data for Saoirse ${see ? "given" : "withheld"}; Baiji ${who === "devin" ? "given" : "withheld"}`, pk === see && pb === (who === "devin"), pk + "/" + pb);
      if (see) {
        // cc1: the peek opens from the card's eye button (a plain click goes to the article).
        await page.hover('a.index-card[id="heroes-saoirse"]'); await page.waitForSelector("#peek-eye.peek-eye-on"); await page.waitForTimeout(300);
        await page.click("#peek-eye"); await page.waitForTimeout(900);
        check(`${who}: Index peek opens for Saoirse`, await page.evaluate(() => { const p = document.querySelector(".peek-panel, #peek, [class*=peek]"); return !!p && /Saoirse/.test(document.body.innerText); }));
      }
      await page.goto(BASE + "articles/saoirse/", { waitUntil: "load" }); await page.waitForTimeout(600);
      const av = await page.evaluate(() => { const v = (n) => !!n && n.getClientRects().length > 0; return { hero: v(document.querySelector("section.art-hero")), body: v(document.querySelector("main.art-body")) }; });
      check(`${who}: article Saoirse ${see ? "shown" : "hidden"}`, av.hero === see && av.body === see, JSON.stringify(av));
      // Another article's rail (baked copy is stale; it follows the Index at runtime).
      await page.goto(BASE + "articles/aghor/", { waitUntil: "load" });
      await page.waitForTimeout(2000);
      const rv = await page.evaluate(() => Array.from(document.querySelectorAll('#art-index-panel a.toc-name[href="/articles/saoirse/"]')).map((a) => !a.classList.contains("private") || document.body.classList.contains("login-devin")));
      check(`${who}: article rail (Aghor) Saoirse entries ${see ? "shown" : "hidden"}`, rv.length === 3 && rv.every((v) => v === see), rv.join());
      // Hover card on a prose link to Saoirse.
      const hv = await page.evaluate(async () => {
        const a = document.createElement("a"); a.href = "/articles/saoirse/"; a.textContent = "Saoirse"; a.id = "zq-link";
        (document.querySelector("main.art-body #lore") || document.querySelector("main.art-body")).appendChild(a); return true; });
      const zl = await page.$("#zq-link"); await zl.scrollIntoViewIfNeeded();
      await page.mouse.move(5, 300); const zb = await zl.boundingBox();
      await page.mouse.move(zb.x + zb.width / 2, zb.y + zb.height / 2);
      await page.waitForTimeout(1500);
      const hc = await page.evaluate(() => { const c = document.querySelector("#hover-card.hover-card-on"); return !!c && !c.hidden && /Saoirse/.test(c.textContent); });
      check(`${who}: hover card for a link to Saoirse ${see ? "shown" : "not shown"}`, hc === see, String(hc));
      check(`${who}: no page errors`, !errs.length, errs.join(" | "));
      await ctx.close();
    }

    // ---- 4b) pr1: the old Private section is gone; its 14 cards sit in Unsorted, Devin only ----
    const UNSORTED = ["the-beckoning-bell", "bel-harath", "cressana", "darcdressil", "darmstadt", "elraim", "haethlin-dream", "imani-valash", "ito-gangara", "rathalon", "sen-teloch-ini", "the-six-kings", "vallorca", "yena"];
    {
      const man = JSON.parse(disk("edit/visibility.json")).secrets;
      const bad = UNSORTED.filter((sl) => { const e = Object.values(man).find((x) => x.path === "articles/" + sl + ".html"); return !e || e.owner !== "devin" || e.everyone || JSON.stringify(e.allowed) !== '["devin"]'; });
      check("pr1: visibility.json — all 14 Unsorted entries owner devin, allowed [devin], not everyone", !bad.length, bad.join());
      const idx = disk("index/ancients/index.html");
      check("pr1: no Private section / private-group left; Unsorted is the last section", !/private-group|id="private"|>Private</.test(idx) && /<section class="index-cat" id="unsorted"><h2>Unsorted<\/h2>/.test(idx) && idx.lastIndexOf('<section class="index-cat"') === idx.indexOf('id="unsorted"') - 27);
      const ungated = UNSORTED.filter((sl) => ["articles/" + sl + ".html", "articles/" + sl + "/index.html"].some((p) => { const t = disk(p); return !/<main class="art-body private" data-owner="devin">/.test(t) || !/<section class="art-hero[^"]*private[^"]*" data-owner="devin">/.test(t); }));
      check("pr1: every Unsorted article (both copies) hero + body private to Devin", !ungated.length, ungated.join());
    }
    for (const who of ["guest", "jack", "sawyer", "devin"]) {
      const see = who === "devin";
      ctx = await ctxFor(browser, who, false); page = await ctx.newPage(); errs = watch(page);
      await page.goto(BASE + "index/ancients/", { waitUntil: "load" }); await page.waitForTimeout(1500);
      const u = await page.evaluate((sl) => {
        const vis = (n) => !!n && n.getClientRects().length > 0;
        const cards = sl.map((s) => Array.from(document.querySelectorAll('a.index-card[href="/articles/' + s + '/"]')).some(vis));
        const rail = Array.from(document.querySelectorAll('#index-toc-panel a.toc-name[href^="#unsorted-"]')).filter((a) => getComputedStyle(a).display !== "none" && !a.closest(".ix-hide")).length;
        const priv = vis(document.getElementById("private")) || vis(document.querySelector('#index-toc-panel a[href="#private"]'));
        return { cards: cards.filter(Boolean).length, rail, inSec: document.querySelectorAll("#unsorted a.index-card").length, sec: vis(document.getElementById("unsorted")), toc: vis(document.querySelector('#index-toc-panel a[href="#unsorted"]')), priv };
      }, UNSORTED);
      check(`pr1 ${who}: Index — the 14 cards ${see ? "all shown (Unsorted or wherever Devin moved them)" : "none shown"}, rail entries, section`, see ? (u.cards === 14 && u.rail === u.inSec && u.inSec > 0 && u.sec && u.toc) : (u.cards === 0 && u.rail === 0 && !u.sec && !u.toc), JSON.stringify(u));
      check(`pr1 ${who}: no Private section anywhere`, !u.priv);
      const pk = await page.evaluate((sl) => Promise.all(sl.map((s) => window.EloraePeek.load(s).then((d) => !!d, () => false))), UNSORTED);
      check(`pr1 ${who}: peek data for the 14 ${see ? "given" : "withheld"}`, pk.every((v) => v === see), pk.join());
      const sr = await page.evaluate(() => new Promise((res) => { const go = () => res((window.SEARCH_INDEX || []).filter((e) => /^articles\/(the-beckoning-bell|bel-harath|darmstadt|elraim|haethlin-dream|imani-valash|ito-gangara|rathalon|sen-teloch-ini|vallorca|yena)\.html$/.test(e.href)).map((e) => !!e.private && e.owner === "devin")); if (window.SEARCH_INDEX) go(); else { const s = document.createElement("script"); s.src = "/search-index.js"; s.onload = go; document.head.appendChild(s); } }));
      check(`pr1 ${who}: search entries of the 14 all private to Devin`, sr.length === 10 && sr.every(Boolean), sr.length + "");
      for (const sl of ["bel-harath", "cressana", "the-six-kings", "yena"]) {
        await page.goto(BASE + "articles/" + sl + "/", { waitUntil: "load" }); await page.waitForTimeout(500);
        const av = await page.evaluate(() => { const v = (n) => !!n && n.getClientRects().length > 0; return { hero: v(document.querySelector("section.art-hero")), body: v(document.querySelector("main.art-body")) }; });
        check(`pr1 ${who}: direct URL /articles/${sl}/ ${see ? "shown" : "hidden"}`, av.hero === see && av.body === see, JSON.stringify(av));
      }
      const rv = await page.evaluate(() => { const v = (n) => !!n && n.getClientRects().length > 0; return { n: Array.from(document.querySelectorAll('#art-index-panel a.toc-name')).filter((a) => /\/articles\/(the-beckoning-bell|bel-harath|cressana|darcdressil|darmstadt|elraim|haethlin-dream|imani-valash|ito-gangara|rathalon|sen-teloch-ini|the-six-kings|vallorca|yena)\//.test(a.getAttribute("href")) && getComputedStyle(a).display !== "none" && !a.closest(".ix-hide")).length, unsorted: v(document.querySelector('#art-index-panel a[href$="#unsorted"]')), priv: !!document.querySelector('#art-index-panel a[href$="#private"]') }; });
      check(`pr1 ${who}: article rail — Unsorted entries ${see ? "shown" : "hidden"}, no Private`, (see ? rv.n === 14 && rv.unsorted : rv.n === 0 && !rv.unsorted) && !rv.priv, JSON.stringify(rv));
      check(`pr1 ${who}: no page errors`, !errs.length, errs.join(" | "));
      await ctx.close();
    }

    // ---- 5) Back to Everyone restores every file ----
    ctx = await ctxFor(browser, "devin", true); page = await ctx.newPage();
    await enterEdit(page, "articles/baiji/");
    await page.waitForSelector("#ee-vis"); await page.click("#ee-vis");
    await page.waitForSelector("#ee-vis-pop .ee-vis-people input");
    check("article: popover opens on the saved state (Devin only)", await page.isChecked('#ee-vis-pop input[value="devin"]'));
    await page.check('#ee-vis-pop input[value="everyone"]');
    await page.click('#ee-vis-pop [data-vis-act="save"]');
    await page.waitForSelector("#ee-vis-pop", { state: "detached", timeout: 20000 });
    check("everyone: Baiji article back to the original bytes", String(mock.file("articles/baiji.html")) === disk("articles/baiji.html") && String(mock.file("articles/baiji/index.html")) === disk("articles/baiji/index.html"));
    check("everyone: Baiji Index card public again", !/private/.test((String(mock.file("index/ancients.html")).match(/<a class="index-card[^>]*href="\/articles\/baiji\/"[^>]*>/) || [""])[0]));
    check("everyone: no Baiji entry in visibility.json", !Object.values(JSON.parse(mock.file("edit/visibility.json")).secrets).some((s) => /baiji/.test(s.path)));
    await ctx.close();
  } finally {
    await browser.close(); srv.close();
  }
  const ok = results.filter((r) => r.ok).length;
  console.log(`\n${ok}/${results.length} passed`);
  process.exit(ok === results.length ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(2); });
