/* E2E: site-wide auto-links (autolink.js al1): journal + article linking, privacy, no self links,
   hover cards, edit-mode removal + save round-trips with no generated markup, and a Gallery tag edit
   that refreshes autolink.json and links the word on the next load. */
"use strict";
const fs = require("fs");
const path = require("path");
const { chromium } = require(process.env.PLAYWRIGHT || "playwright-core");
const { MockGitHub } = require("./mock-github.js");
const { serverForTests, ROOT } = require("./server.js");
const VS = require("../visset.js");

const REPO = "195142095142091920/elorae";
const OUT = process.env.SHOTS || "/tmp/ee-autolink";
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
const J = "journal/", JF = "journal/index.html";
const links = () => [...document.querySelectorAll("a.al-link")].map((a) => [a.textContent, a.getAttribute("href")]);
const ready = (page) => page.waitForFunction(() => window.EloraeAutolink && window.EloraeAutolink.map() && document.documentElement.hasAttribute("data-autolinked"), null, { timeout: 10000 }).catch(() => {});
(async () => {
  const srv = await serverForTests(); BASE = srv.base;
  // A journal paragraph with a made-up word that only a Gallery tag will turn into a link.
  const jt = disk(JF).replace(/(<main[^>]*>[\s\S]*?<p>)/, "$1Zqrath rode ahead. ");
  mock = new MockGitHub({ repo: REPO, root: ROOT, tokens: { "ghp_test_devin": "devin-gh" }, overrides: { "edit/profiles.json": JSON.stringify(PROFILES, null, 2) } });
  mock.setUpstream(JF, jt);
  const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ["--no-sandbox"] });
  try {
    // 1. Guest on a Journal chapter.
    let ctx = await ctxFor(browser, "guest", false), page = await ctx.newPage(), errs = watch(page);
    await page.goto(BASE + J, { waitUntil: "load" }); await ready(page);
    let L = await page.evaluate(links);
    const v = L.filter((x) => x[0] === "Vaerek");
    check("journal (guest): every plain 'Vaerek' links to /articles/vaerek/", v.length >= 2 && v.every((x) => x[1] === "/articles/vaerek/"), JSON.stringify(L.slice(0, 12)));
    const poss = await page.evaluate(() => [...document.querySelectorAll("a.al-link")].some((a) => a.textContent === "Vaerek" && /^['\u2019]s/.test((a.nextSibling || {}).nodeValue || "")));
    check("journal: possessive Vaerek's links the name only", poss);
    const bad = await page.evaluate(() => [...document.querySelectorAll("a.al-link")].filter((a) => a.closest("h1,h2,h3,h4,h5,h6,nav,aside,.toc,#section-bar,button") || a.parentElement.closest("a:not(.al-link)") || a.querySelector("a")).length);
    check("journal: no links in headings, nav, rails, asides, or inside other links", bad === 0, String(bad));
    check("journal: the made-up word is plain text before any tag", !L.some((x) => x[0] === "Zqrath") && (await page.evaluate(() => document.querySelector("main.read").textContent.includes("Zqrath rode"))));
    const cls = await page.evaluate(() => { const a = document.querySelector("a.al-link"), cs = getComputedStyle(a), p = getComputedStyle(a.parentElement); return { c: cs.color === p.color, fs: cs.fontSize === p.fontSize, d: cs.textDecorationStyle }; });
    check("look: same color and size as the text, dotted underline (no layout shift)", cls.c && cls.fs && cls.d === "dotted", JSON.stringify(cls));
    const shot = await page.evaluate(() => { const a = [...document.querySelectorAll("main.read p a.al-link")].find((x) => x.textContent === "Vaerek") || document.querySelector("main.read p a.al-link"); const p = a.closest("p"); p.scrollIntoView({ block: "center" }); return true; });
    await page.waitForTimeout(300);
    const para = await page.evaluateHandle(() => { const a = [...document.querySelectorAll("main.read p a.al-link")].find((x) => x.textContent === "Vaerek") || document.querySelector("main.read p a.al-link"); return a.closest("p"); });
    await para.asElement().screenshot({ path: path.join(OUT, "autolink-journal-paragraph.png") });
    // hover card works on an auto-link
    const al = await page.$("main.read a.al-link[href='/articles/vaerek/']"); const bb = await al.boundingBox();
    await page.mouse.move(5, 300); await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2);
    const hc = await page.waitForSelector("#hover-card.hover-card-on", { timeout: 4000 }).then(() => true, () => false);
    check("hover: an auto-link shows the article's hover card", hc);
    check("journal: no page errors", !errs.length, errs.join(" | "));
    // Private article name: plain for a guest.
    await page.goto(BASE + "codex/lore/", { waitUntil: "load" }); await ready(page);
    L = await page.evaluate(links);
    check("private (guest): Elraim (Devin's private article) stays plain text; public names still link", !L.some((x) => /elraim/.test(x[1])) && L.length > 0, String(L.length));
    // Own article: no self links, others link.
    await page.goto(BASE + "articles/vaerek/", { waitUntil: "load" }); await ready(page);
    L = await page.evaluate(links);
    check("article: its own name is never linked on its own page; other names are", !L.some((x) => /\/vaerek\//.test(x[1])) && L.length > 0, JSON.stringify(L.slice(0, 6)));
    await ctx.close();

    // 2. Devin: private names link.
    ctx = await ctxFor(browser, "devin", false); page = await ctx.newPage(); errs = watch(page);
    await page.goto(BASE + "codex/lore/", { waitUntil: "load" }); await ready(page);
    L = await page.evaluate(links);
    check("private (Devin): Elraim links to his private article", L.some((x) => x[0] === "Elraim" && x[1] === "/articles/elraim/"));
    await ctx.close();

    // 3. Editor round-trip: links are gone in edit mode and never saved (article + journal).
    ctx = await ctxFor(browser, "devin", true); page = await ctx.newPage(); errs = watch(page);
    const A = "articles/vaerek/index.html", orig = disk(A);
    await page.goto(BASE + "articles/vaerek/", { waitUntil: "load" }); await ready(page);
    const pre = await page.evaluate(() => document.querySelectorAll("main a.al-link").length);
    check("Devin with an edit session still sees auto-links when not editing", pre > 0, String(pre));
    await page.waitForFunction(() => window.EloraeEditor && window.EloraeEditor.state && window.EloraeEditor.state.profile, null, { timeout: 15000 });
    await page.evaluate(() => window.EloraeEditor.tryEnterEdit());
    await page.waitForSelector("#ee-save", { timeout: 15000 }); await page.waitForTimeout(300);
    check("edit mode: no auto-links on the page", (await page.evaluate(() => document.querySelectorAll("a.al-link").length)) === 0);
    let n = mock.log.length;
    await page.evaluate(() => { const p = document.querySelector("main.art-body #lore p.art-life"); p.textContent = p.textContent + " Zal"; p.dispatchEvent(new Event("input", { bubbles: true })); });
    await page.click("#ee-save");
    await page.waitForFunction(() => /Saved|failed|refused/i.test(((document.getElementById("ee-bar") || {}).textContent || "") + ((document.getElementById("ee-toast") || {}).textContent || "")), null, { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(500);
    const s1 = String(mock.file(A)), exp = orig.replace(/(<p class="art-life">[^<]*)(<\/p>)/, "$1 Zal$2");
    check("article save: file = original + the word, no auto-link markup", commitsSince(n).length === 1 && s1 === exp && !/al-link/.test(s1), s1 === exp ? "" : "diff");
    if (s1 !== exp) { fs.writeFileSync(path.join(OUT, "got.html"), s1); fs.writeFileSync(path.join(OUT, "exp.html"), exp); }
    // Journal page round-trip.
    await page.goto(BASE + J, { waitUntil: "load" }); await ready(page);
    const jpre = await page.evaluate(() => document.querySelectorAll("a.al-link").length);
    await page.waitForFunction(() => window.EloraeEditor && window.EloraeEditor.state && window.EloraeEditor.state.profile, null, { timeout: 15000 });
    await page.evaluate(() => window.EloraeEditor.tryEnterEdit());
    await page.waitForSelector("#ee-save", { timeout: 15000 }); await page.waitForTimeout(300);
    const jin = await page.evaluate(() => document.querySelectorAll("a.al-link").length);
    const jorig = String(mock.file(JF)); n = mock.log.length;
    const target = await page.evaluate(() => { const ps = [...document.querySelectorAll("main.read p")]; const p = ps.find((x) => /Vaerek/.test(x.textContent) && !x.querySelector("a,em,strong,i,b,span,br")); if (!p) return null; p.textContent = p.textContent + " Zjl"; p.dispatchEvent(new Event("input", { bubbles: true })); return p.textContent.slice(0, -4); });
    await page.click("#ee-save");
    await page.waitForFunction(() => /Saved|failed|refused/i.test(((document.getElementById("ee-bar") || {}).textContent || "") + ((document.getElementById("ee-toast") || {}).textContent || "")), null, { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(500);
    const j1 = String(mock.file(JF));
    const jexp = target ? jorig.replace(target + "</p>", target + " Zjl</p>") : null;
    check("journal save: links gone while editing; file = original + the word, no auto-link markup", jpre > 0 && jin === 0 && target && j1 !== jorig && j1 === jexp && !/al-link/.test(j1), JSON.stringify({ jpre, jin, t: !!target, same: j1 === jexp, c: commitsSince(n).map((c) => c.committed.message), al: /al-link/.test(j1), msg: await page.evaluate(() => ((document.getElementById("ee-bar") || {}).textContent || "") + "/" + ((document.getElementById("ee-toast") || {}).textContent || "")), ed: await page.evaluate(() => document.querySelectorAll("main [contenteditable=true]").length) }));
    check("edit: no page errors", !errs.length, errs.join(" | "));

    // 4. Gallery tag -> map -> links on the next load.
    await page.goto(BASE + J, { waitUntil: "load" });
    await page.waitForFunction(() => window.EloraeEditor && window.EloraeEditor.openGalleryManager && window.EloraeEditor.state.profile, null, { timeout: 15000 });
    await page.evaluate(() => window.EloraeEditor.openGalleryManager());
    await page.waitForSelector('#ee-galm-wrap [data-gal-id="vaerek-at-ease"]', { timeout: 15000 });
    await page.click('#ee-galm-wrap [data-gal-id="vaerek-at-ease"]');
    await page.waitForSelector("#ee-galm-tags");
    await page.fill("#ee-galm-tags", "site, seed, Zqrath");
    n = mock.log.length;
    await page.click("#ee-galm-save");
    await page.waitForFunction((k) => true, null).catch(() => {});
    await page.waitForTimeout(2500);
    const cm = commitsSince(n), map = JSON.parse(String(mock.file("autolink.json")));
    check("gallery tag save: the same commit refreshes autolink.json (Zqrath -> vaerek)", cm.length === 1 && map.terms.Zqrath === "vaerek", JSON.stringify({ commits: cm.length, t: map.terms.Zqrath }));
    await ctx.close();
    ctx = await ctxFor(browser, "guest", false); page = await ctx.newPage(); errs = watch(page);
    await page.goto(BASE + J, { waitUntil: "load" }); await ready(page);
    L = await page.evaluate(links);
    check("next load: the new tag word links to Vaerek's article", L.some((x) => x[0] === "Zqrath" && x[1] === "/articles/vaerek/"), JSON.stringify(await page.evaluate(() => { const m = window.EloraeAutolink.map(); const i = document.body.innerHTML.indexOf("Zqrath"); return { t: m && m.terms.Zqrath, ctx: document.body.innerHTML.slice(i - 200, i + 40), p: document.querySelector("main.read p").textContent.slice(0, 80), u: location.href }; })));
    check("guest: no page errors", !errs.length, errs.join(" | "));
    await ctx.close();
  } finally {
    await browser.close(); srv.close();
  }
  const bad = results.filter((r) => !r.ok);
  console.log(`\n${results.length - bad.length}/${results.length} passed`);
  process.exit(bad.length ? 1 : 0);
})();
