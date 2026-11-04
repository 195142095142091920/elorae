/* E2E: opt-in Codex article layout (codex-layout.js cx1) on Vaerek. View: plates from the page arts, side box,
   originals hidden. Edit mode: copies gone, classic sections back; a lore edit and an art add save
   round-trip with no generated markup in the file; the layout comes back after. */
"use strict";
const fs = require("fs");
const path = require("path");
const { chromium } = require(process.env.PLAYWRIGHT || "playwright-core");
const { MockGitHub } = require("./mock-github.js");
const { serverForTests, ROOT } = require("./server.js");
const VS = require("../visset.js");

const REPO = "195142095142091920/elorae";
const OUT = process.env.SHOTS || "/tmp/ee-codex";
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
const A = "articles/vaerek/index.html", A2 = "articles/vaerek.html";
const view = () => ({
  on: document.documentElement.classList.contains("cx-on"),
  plates: document.querySelectorAll(".cx-plates .cx-plate").length,
  swaps: document.querySelectorAll(".art-swap-thumbs button").length,
  side: !!document.querySelector("#lore > .cx-side"),
  links: document.querySelectorAll(".cx-side .cx-links a").length,
  rel: (document.getElementById("related") || {}).offsetHeight || 0,
  desc: (document.getElementById("description") || {}).offsetHeight || 0,
  gen: document.querySelectorAll(".cx-gen").length,
});
(async () => {
  const srv = await serverForTests(); BASE = srv.base;
  mock = new MockGitHub({ repo: REPO, root: ROOT, tokens: { "ghp_test_devin": "devin-gh" }, overrides: { "edit/profiles.json": JSON.stringify(PROFILES, null, 2) } });
  const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ["--no-sandbox"] });
  try {
    const orig = disk(A);
    let ctx = await ctxFor(browser, "guest", false), page = await ctx.newPage(), errs = watch(page);
    await page.goto(BASE + "articles/vaerek/", { waitUntil: "load" }); await page.waitForTimeout(600);
    let v = await page.evaluate(view);
    check("view (guest): codex on, one plate per page art, side box, Description + Related hidden", v.on && v.plates === v.swaps && v.plates >= 2 && v.side && v.links >= 5 && !v.rel && !v.desc, JSON.stringify(v));
    await page.click(".cx-plate:nth-child(2)"); await page.waitForTimeout(900);
    check("view: tapping Plate II puts that art in the hero", await page.evaluate(() => document.querySelector(".art-hero > img").getAttribute("src") === document.querySelector(".cx-plate:nth-child(2)").getAttribute("data-src") && document.querySelector(".cx-plate:nth-child(2)").classList.contains("on")));
    await page.screenshot({ path: path.join(OUT, "codex-view-1440.png"), fullPage: true });
    check("view: no page errors", !errs.length, errs.join(" | "));
    await ctx.close();

    ctx = await ctxFor(browser, "devin", true); page = await ctx.newPage(); errs = watch(page);
    await enterEdit(page, "articles/vaerek/");
    await page.waitForSelector("#ee-save", { timeout: 15000 }); await page.waitForTimeout(300);
    v = await page.evaluate(view);
    check("edit mode: generated copies gone, classic sections back (Description, Related)", !v.on && !v.gen && v.desc > 0 && v.rel > 0, JSON.stringify(v));
    let n = mock.log.length;
    await page.evaluate(() => { const p = document.querySelector("main.art-body #lore p.art-life"); p.textContent = p.textContent + " Zcx"; p.dispatchEvent(new Event("input", { bubbles: true })); });
    await page.click("#ee-save");
    await page.waitForFunction(() => /Saved|failed|refused/i.test(((document.getElementById("ee-bar") || {}).textContent || "") + ((document.getElementById("ee-toast") || {}).textContent || "")), null, { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(500);
    const s1 = String(mock.file(A)), s1b = String(mock.file(A2));
    const exp = orig.replace(/(<p class="art-life">[^<]*)(<\/p>)/, "$1 Zcx$2");
    check("lore edit: one commit, both copies, file = original + the word (no cx markup, layout tags kept)", commitsSince(n).length === 1 && s1 === s1b && s1 === exp && !/cx-gen|cx-plate|cx-side/.test(s1) && s1.includes('class="article art-codex"'), s1 === exp ? "" : "diff");
    if (s1 !== exp) { fs.writeFileSync(path.join(OUT, "got.html"), s1); fs.writeFileSync(path.join(OUT, "exp.html"), exp); }
    // Art add (upload) + save: the plates follow the page arts.
    const UP = path.join(OUT, "Vaerek, Zq Plate.png");
    fs.writeFileSync(UP, Buffer.from("89504e470d0a1a0a0000000d4948445200000002000000020802000000fdd49a730000001649444154789c63f8cfc0f09f81e1ff7f0606860c0c0c00271a04fd7c3d3f720000000049454e44ae426082", "hex"));
    if (!(await page.$("#ee-save"))) { await page.evaluate(() => window.EloraeEditor.tryEnterEdit()); await page.waitForSelector("#ee-save", { timeout: 15000 }); }
    await page.click("#ee-arts-btn"); await page.waitForSelector("#ee-arts .ee-art-item");
    const before = await page.$$eval("#ee-arts .ee-art-item", (x) => x.length);
    await page.click("#ee-arts-add"); await page.waitForSelector("#ee-galm-file", { state: "attached", timeout: 10000 });
    await page.setInputFiles("#ee-galm-file", UP);
    if (await page.$("#ee-galm-upload")) await page.click("#ee-galm-upload");
    await page.waitForFunction((b) => document.querySelectorAll("#ee-arts .ee-art-item").length === b + 1, before, { timeout: 20000 });
    n = mock.log.length;
    await page.click("#ee-save");
    await page.waitForTimeout(2500);
    const s2 = String(mock.file(A));
    check("art add: one commit, the new art is in the page, no stale pill", commitsSince(n).length === 1 && /Zq%20Plate|Zq Plate|zq-plate/i.test(s2) && !(await page.$("#ee-stale")) && !/cx-gen/.test(s2), commitsSince(n).map((c) => c.committed.message).join(" | "));
    check("edit: no page errors", !errs.length, errs.join(" | "));
    await ctx.close();

    ctx = await ctxFor(browser, "guest", false); page = await ctx.newPage(); errs = watch(page);
    await page.goto(BASE + "articles/vaerek/", { waitUntil: "load" }); await page.waitForTimeout(600);
    v = await page.evaluate(view);
    check("after saves: layout back, plates follow the page arts (+1)", v.on && v.plates === v.swaps && v.plates === before + 1 && v.side, JSON.stringify(v));
    await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(400);
    const ph = await page.evaluate(() => { const s = document.querySelector("#lore > .cx-side"), p = document.querySelector("#lore > p.art-life"); return s && p && s.getBoundingClientRect().bottom <= p.getBoundingClientRect().top + 1; });
    check("phone: side box sits above the lore text", ph);
    await ctx.close();
  } finally {
    await browser.close(); srv.close();
  }
  const bad = results.filter((r) => !r.ok);
  console.log(`\n${results.length - bad.length}/${results.length} passed`);
  process.exit(bad.length ? 1 : 0);
})();
