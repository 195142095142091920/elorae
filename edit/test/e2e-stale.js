/* E2E: stale-page save guard (core.js sg1). A page loaded before someone else changed its file must
   not save over it: the save writes nothing, a small pill shows, the page reloads once the site
   serves the new version. Consecutive own saves in one session still work.
   Run: PLAYWRIGHT=<path> CHROME=/usr/bin/google-chrome node edit/test/e2e-stale.js (SHOTS=<dir> for the pill). */
"use strict";
const fs = require("fs");
const path = require("path");
const { chromium } = require(process.env.PLAYWRIGHT || "playwright-core");
const { MockGitHub } = require("./mock-github.js");
const { serverForTests, ROOT } = require("./server.js");
const VS = require("../visset.js");

const REPO = "195142095142091920/elorae";
const OUT = process.env.SHOTS || "/tmp/ee-stale";
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
async function idxEdit(page, tag) {
  await page.evaluate((t) => { const h = document.querySelector("main.index-flow section.index-cat#divines > h2"); h.textContent = h.textContent + " " + t; h.dispatchEvent(new Event("input", { bubbles: true })); h.dispatchEvent(new Event("blur")); }, tag);
}
async function artEdit(page, tag) {
  await page.evaluate((t) => { const p = document.querySelector("main.art-body #lore p") || document.querySelector("main.art-body p"); p.textContent = p.textContent + " " + t; p.dispatchEvent(new Event("input", { bubbles: true })); }, tag);
}
const reloadSpy = () => { window.__eeReloads = 0; const E = window.EloraeEdit; if (E) E.__reload = () => { window.__eeReloads++; }; };
(async () => {
  const srv = await serverForTests(); BASE = srv.base;
  mock = new MockGitHub({ repo: REPO, root: ROOT, tokens: { "ghp_test_devin": "devin-gh" }, overrides: { "edit/profiles.json": JSON.stringify(PROFILES, null, 2) } });
  const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ["--no-sandbox"] });
  try {
    // ---- 1) Index organizer: two own saves pass ----
    let ctx = await ctxFor(browser, "devin", true), page = await ctx.newPage(), errs = watch(page);
    await enterEdit(page, "index/ancients/");
    await page.waitForSelector("#ee-idx-save", { timeout: 15000 });
    await page.evaluate(reloadSpy);
    for (const t of ["Zq1", "Zq2"]) {
      const n = mock.log.length;
      await idxEdit(page, t); await page.click("#ee-idx-save");
      await page.waitForFunction(() => document.getElementById("ee-toast"), null, { timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(400);
      check(`organizer: own save ${t} commits`, commitsSince(n).length === 1 && String(mock.file("index/ancients/index.html")).includes(t), commitsSince(n).map((c) => c.committed.message).join(" | "));
      await page.evaluate(() => { const t = document.getElementById("ee-toast"); if (t) t.remove(); });
    }
    check("organizer: no stale pill on own saves", !(await page.$("#ee-stale")));
    // ---- 2) someone else changes the Index; this page saves -> nothing written, pill, reload ----
    mock.setUpstream("index/ancients/index.html", String(mock.file("index/ancients/index.html")).replace("<h2>Unsorted</h2>", "<h2>Unsorted Zremote</h2>"));
    let n = mock.log.length;
    await idxEdit(page, "Zq3"); await page.click("#ee-idx-save");
    await page.waitForSelector("#ee-stale", { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(OUT, "stale-pill-1440.png") });
    check("organizer stale: pill shown", !!(await page.$("#ee-stale")));
    check("organizer stale: nothing written", commitsSince(n).length === 0 && !String(mock.file("index/ancients/index.html")).includes("Zq3") && String(mock.file("index/ancients/index.html")).includes("Zremote"));
    await page.waitForFunction(() => window.__eeReloads > 0, null, { timeout: 15000 }).catch(() => {});
    check("organizer stale: page reloads once the new version is served", await page.evaluate(() => window.__eeReloads > 0));
    // a real reload then saves normally
    await page.goto(BASE + "index/ancients/", { waitUntil: "load" });
    await page.waitForFunction(() => window.EloraeEditor && window.EloraeEditor.state && window.EloraeEditor.state.profile, null, { timeout: 15000 });
    await page.evaluate(() => window.EloraeEditor.tryEnterEdit());
    await page.waitForSelector("#ee-idx-save", { timeout: 15000 });
    n = mock.log.length;
    await idxEdit(page, "Zq4"); await page.click("#ee-idx-save");
    await page.waitForFunction(() => document.getElementById("ee-toast"), null, { timeout: 15000 }).catch(() => {});
    check("organizer: after the reload a save works and keeps the remote change", commitsSince(n).length === 1 && /Zq4/.test(String(mock.file("index/ancients/index.html"))) && /Zremote/.test(String(mock.file("index/ancients/index.html"))));
    check("organizer: no page errors", !errs.length, errs.join(" | "));
    await ctx.close();

    // ---- 3) Article: consecutive saves pass; a remote change to its twin copy stops the next save ----
    ctx = await ctxFor(browser, "devin", true); page = await ctx.newPage(); errs = watch(page);
    await enterEdit(page, "articles/baiji/");
    await page.waitForSelector("#ee-save", { timeout: 15000 });
    await page.evaluate(reloadSpy);
    for (const t of ["Zqa", "Zqb"]) {
      n = mock.log.length;
      await artEdit(page, t); await page.click("#ee-save");
      await page.waitForFunction(() => !document.getElementById("ee-save") || document.getElementById("ee-toast") || document.querySelector("#ee-bar.ee-pill"), null, { timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(500);
      check(`article: own save ${t} commits`, commitsSince(n).length === 1 && String(mock.file("articles/baiji/index.html")).includes(t), commitsSince(n).map((c) => c.committed.message).join(" | "));
      if (!(await page.$("#ee-save"))) { await page.evaluate(() => window.EloraeEditor.tryEnterEdit()); await page.waitForSelector("#ee-save", { timeout: 15000 }); }
    }
    mock.setUpstream("articles/baiji.html", String(mock.file("articles/baiji.html")).replace("</h1>", " Zremote</h1>"));
    n = mock.log.length;
    await artEdit(page, "Zqc"); await page.click("#ee-save");
    await page.waitForSelector("#ee-stale", { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(500);
    check("article stale: pill shown, nothing written", !!(await page.$("#ee-stale")) && commitsSince(n).length === 0 && !String(mock.file("articles/baiji/index.html")).includes("Zqc"));
    check("article: no page errors", !errs.length, errs.join(" | "));
    await ctx.close();
    // ---- 4) sg2: Art strip — upload a new art, save; then a second save (own writes never trip the guard) ----
    {
      const UP = path.join(OUT, "Zq Dawn.png");
      fs.writeFileSync(UP, Buffer.from("89504e470d0a1a0a0000000d4948445200000002000000020802000000fdd49a730000001649444154789c63f8cfc0f09f81e1ff7f0606860c0c0c00271a04fd7c3d3f720000000049454e44ae426082", "hex"));
      ctx = await ctxFor(browser, "devin", true); page = await ctx.newPage(); errs = watch(page);
      await enterEdit(page, "articles/aghor/");
      await page.waitForSelector("#ee-save", { timeout: 15000 });
      await page.evaluate(reloadSpy);
      await page.click("#ee-arts-btn"); await page.waitForSelector("#ee-arts .ee-art-item");
      await page.click("#ee-arts-add");
      const upSel = (await page.waitForSelector("#ee-pick-file, #ee-galm-file", { state: "attached", timeout: 10000 }).then((h) => h.evaluate((x) => "#" + x.id)));
      await page.setInputFiles(upSel, UP);
      if (upSel === "#ee-galm-file") await page.click("#ee-galm-upload");
      await page.waitForFunction(() => document.querySelectorAll("#ee-arts .ee-art-item").length === 2, null, { timeout: 20000 });
      n = mock.log.length;
      await page.click("#ee-save");
      await page.waitForFunction(() => /Saved|failed|refused/i.test(((document.getElementById("ee-bar") || {}).textContent || "") + ((document.getElementById("ee-toast") || {}).textContent || "")), null, { timeout: 30000 }).catch(() => {});
      await page.waitForTimeout(600);
      const c1 = commitsSince(n), a1 = String(mock.file("articles/aghor/index.html"));
      check("art add: upload + save commits once, the new art is in the page, no stale pill", c1.length === 1 && /zq-dawn/i.test(a1) && !(await page.$("#ee-stale")), c1.map((c) => c.committed.message).join(" | ") + " " + JSON.stringify(await page.evaluate(() => window.__eeStaleInfo || null)));
      if (!(await page.$("#ee-save"))) { await page.evaluate(() => window.EloraeEditor.tryEnterEdit()); await page.waitForSelector("#ee-save", { timeout: 15000 }); }
      n = mock.log.length;
      await artEdit(page, "Zqd"); await page.click("#ee-save");
      await page.waitForTimeout(2500);
      check("art add: a second save right after also commits", commitsSince(n).length === 1 && !(await page.$("#ee-stale")) && String(mock.file("articles/aghor/index.html")).includes("Zqd"));
      check("art add: no page errors", !errs.length, errs.join(" | "));
      await ctx.close();
    }
  } finally {
    await browser.close(); srv.close();
  }
  const ok = results.filter((r) => r.ok).length;
  console.log(`\n${ok}/${results.length} passed`);
  process.exit(ok === results.length ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(2); });
