/* Full-page editor E2E (headless Chrome, GitHub API mocked). Covers the Critical
   editor fixes: Size/Font/Caption never duplicate or stack, Default resets, paragraph
   sizes shrink the line box, one-word edits save as one-line diffs, conflict check,
   hero Close, unsaved-changes prompts, Index organizer hygiene.
   Run from the repo root (starts its own server on a fresh port):
     PLAYWRIGHT=/path/to/playwright-core CHROME=/usr/bin/google-chrome node edit/test/e2e-editor.js */
"use strict";
const fs = require("fs");
const path = require("path");
const cp = require("child_process");
const { chromium } = require(process.env.PLAYWRIGHT || "playwright-core");
const { MockGitHub } = require("./mock-github.js");
const { serverForTests, ROOT } = require("./server.js");

const REPO = "195142095142091920/elorae";
const OUT = process.env.SHOTS || "/tmp/ee-editor";
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
// Put the caret (or a selection) inside the first matching editable element.
async function caretIn(page, sel, startFrac, endFrac) {
  return page.evaluate(([sel, a, b]) => {
    const all = [...document.querySelectorAll(sel)].filter((n) => !n.closest(".ee-locked"));
    const el = all.find((n) => n.textContent.trim().length > 3) || all[0];
    if (!el) return null;
    el.scrollIntoView({ block: "center" });
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); const texts = []; let t;
    while ((t = w.nextNode())) texts.push(t);
    const total = texts.reduce((s, x) => s + x.nodeValue.length, 0);
    function pt(frac) {
      let n = Math.round(total * frac);
      for (const x of texts) { if (n <= x.nodeValue.length) return [x, n]; n -= x.nodeValue.length; }
      const l = texts[texts.length - 1]; return [l, l.nodeValue.length];
    }
    const r = document.createRange();
    if (!texts.length) { r.setStart(el, 0); r.collapse(true); (el.closest(".ee-editable") || el).focus({ preventScroll: true }); const s0 = getSelection(); s0.removeAllRanges(); s0.addRange(r); window.__el = el; return ""; }
    const p1 = pt(a); r.setStart(p1[0], p1[1]);
    if (b == null) r.collapse(true); else { const p2 = pt(b); r.setEnd(p2[0], p2[1]); }
    (el.closest(".ee-editable") || el).focus({ preventScroll: true });
    const s = getSelection(); s.removeAllRanges(); s.addRange(r);
    window.__el = el;
    return el.textContent;
  }, [sel, startFrac, endFrac == null ? null : endFrac]);
}
async function pick(page, id, value) { await page.selectOption(id, value); await page.waitForTimeout(120); }
const info = (page) => page.evaluate(() => {
  const el = window.__el, cs = getComputedStyle(el);
  return { text: el.textContent, cls: el.getAttribute("class") || "", html: el.innerHTML, h: Math.round(el.getBoundingClientRect().height * 10) / 10,
    fs: parseFloat(cs.fontSize), spans: el.querySelectorAll("span").length,
    pt: el.querySelectorAll("[class*=ee-pt-]").length, nested: el.querySelectorAll("[class*=ee-pt-] [class*=ee-pt-]").length };
});
function diffLines(a, b, tag) {
  fs.writeFileSync(path.join(OUT, tag + ".orig.html"), a); fs.writeFileSync(path.join(OUT, tag + ".saved.html"), b);
  let d = "";
  try { d = cp.execFileSync("diff", [path.join(OUT, tag + ".orig.html"), path.join(OUT, tag + ".saved.html")]).toString(); }
  catch (e) { d = e.stdout.toString(); }
  fs.writeFileSync(path.join(OUT, tag + ".diff"), d);
  return d.split("\n").filter((l) => /^[<>] /.test(l)).length;
}
// Every changed line of a saved page is one of the expected kinds.
function okLines(tag, re) { const d = fs.readFileSync(path.join(OUT, tag + ".diff"), "utf8").split("\n").filter((l) => /^> /.test(l)); return d.length > 0 && d.every((l) => re.test(l)); }
const ARTIFACTS = /contenteditable|ee-locked|data-ee-|nav-fade|--nf|data-eimg|nt-siblings|nt-chapnav|profile-gh-actions|ee-editable|ee-page/;

async function sizeTests(browser, vpName) {
  const mock = newMock(); const ctx = await ctxFor(browser, mock, VPS[vpName]); const page = await ctx.newPage(); const W = watch(page);
  await openEdit(page, "articles/aghor/");
  const opts = await page.evaluate(() => ({ size: [...document.querySelectorAll("#ee-size option")].map((o) => o.textContent), font: [...document.querySelectorAll("#ee-font option")].map((o) => o.textContent) }));
  check(`[${vpName}] Size menu: Default (match paragraph) + 10–24pt`, opts.size.join("|") === "Size|Default (match paragraph)|10pt|11pt|12pt|14pt|16pt|18pt|20pt|24pt", opts.size.join("|"));
  check(`[${vpName}] Font menu: Default font first`, opts.font[1] === "Default font", opts.font.join("|"));
  const LORE = "main.art-body p.art-life";
  const text0 = await caretIn(page, LORE, 0.3);
  const i0 = await info(page);
  await pick(page, "#ee-size", "12");
  const i12 = await info(page);
  check(`[${vpName}] caret Size 12: paragraph not duplicated`, i12.text === text0 && i12.spans === 0, `len ${text0.length}→${i12.text.length}`);
  // Body text is 14pt on desktop and 12pt on phones; every size is scaled by the site text scale --fs (fs125: 1.5094).
  const FSV = await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--fs")) || 1);
  const px12 = 16 * FSV;
  check(`[${vpName}] caret Size 12: class on the paragraph, 12pt (16px × --fs) font, line box follows`, /\bee-pt-12\b/.test(i12.cls) && Math.abs(i12.fs - px12) < 0.1 && (i0.fs > px12 + 0.5 ? i12.h < i0.h : i12.h <= i0.h), `--fs ${FSV} fs ${i0.fs}→${i12.fs} (want ${px12.toFixed(2)}) h ${i0.h}→${i12.h}`);
  await caretIn(page, LORE, 0.6); await pick(page, "#ee-size", "24");
  const i24 = await info(page);
  await caretIn(page, LORE, 0.5); await pick(page, "#ee-size", "12");
  const i12b = await info(page);
  check(`[${vpName}] 24→12 on the paragraph: height returns to the 12pt height, no stacking`, i24.h > i12.h && Math.abs(i12b.h - i12.h) < 0.6 && i12b.cls.split(/\s+/).filter((c) => /^ee-pt-/.test(c)).length === 1, `h12 ${i12.h} h24 ${i24.h} back ${i12b.h} cls "${i12b.cls}"`);
  await pick(page, "#ee-size", "10");
  const i10 = await info(page);
  check(`[${vpName}] 10pt is really smaller than body text`, i10.fs < i0.fs && i10.h < i12.h, `body ${i0.fs}px, 10pt ${i10.fs}px`);
  await caretIn(page, LORE, 0.2); await pick(page, "#ee-size", "default");
  const iD = await info(page);
  check(`[${vpName}] Default (match paragraph) resets size and height`, !/ee-pt-/.test(iD.cls) && iD.fs === i0.fs && Math.abs(iD.h - i0.h) < 0.6 && iD.text === text0, `cls "${iD.cls}" fs ${iD.fs} h ${iD.h} vs ${i0.h}`);
  // Undo for a size change.
  await caretIn(page, LORE, 0.4); await pick(page, "#ee-size", "18");
  const before = await info(page);
  await page.keyboard.press("Control+z"); await page.waitForTimeout(100);
  const undone = await info(page);
  await page.keyboard.press("Control+Shift+z"); await page.waitForTimeout(100);
  const redone = await info(page);
  check(`[${vpName}] Ctrl+Z undoes a Size change (Ctrl+Shift+Z redoes)`, /ee-pt-18/.test(before.cls) && !/ee-pt-/.test(undone.cls) && /ee-pt-18/.test(redone.cls), `"${before.cls}" → "${undone.cls}" → "${redone.cls}"`);
  await page.keyboard.press("Control+z"); await page.waitForTimeout(100);
  // Partial selection: no nesting, Default clears spans.
  await caretIn(page, LORE, 0.10, 0.30); await pick(page, "#ee-size", "24");
  await caretIn(page, LORE, 0.15, 0.25); await pick(page, "#ee-size", "12");
  const ip = await info(page);
  check(`[${vpName}] partial selection 24 then 12 inside it: split, never nested`, ip.nested === 0 && ip.text === text0 && ip.pt >= 2, `spans ${ip.spans} pt ${ip.pt} nested ${ip.nested}`);
  await caretIn(page, LORE, 0.0, 1.0); await pick(page, "#ee-size", "default");
  const ip2 = await info(page);
  check(`[${vpName}] whole-paragraph Default removes every size span`, ip2.pt === 0 && ip2.spans === 0 && ip2.text === text0 && !/ee-pt-/.test(ip2.cls), ip2.html.slice(0, 80));
  // Whole paragraph selected → class on the paragraph.
  await caretIn(page, LORE, 0.0, 1.0); await pick(page, "#ee-size", "11");
  const iw = await info(page);
  check(`[${vpName}] whole-paragraph selection: size goes on the paragraph`, /ee-pt-11/.test(iw.cls) && iw.spans === 0, `"${iw.cls}"`);
  await pick(page, "#ee-size", "default");
  // Font: serif then sans on the same words → one span; Default font clears.
  await caretIn(page, LORE, 0.3, 0.5); await pick(page, "#ee-font", "serif");
  await caretIn(page, LORE, 0.3, 0.5); await pick(page, "#ee-font", "sans");
  const f1 = await page.evaluate(() => ({ serif: window.__el.querySelectorAll(".ee-serif").length, sans: window.__el.querySelectorAll(".ee-sans").length, nested: window.__el.querySelectorAll(".ee-serif .ee-sans, .ee-sans .ee-serif, .ee-sans .ee-sans").length }));
  check(`[${vpName}] Font serif→sans on same words: replaced, not nested`, f1.serif === 0 && f1.sans === 1 && f1.nested === 0, JSON.stringify(f1));
  await caretIn(page, LORE, 0.5); await pick(page, "#ee-font", "default");
  const f2 = await page.evaluate(() => window.__el.querySelectorAll(".ee-serif,.ee-sans").length);
  check(`[${vpName}] Default font clears font spans in the paragraph`, f2 === 0 && (await info(page)).text === text0);
  // Caption with a collapsed caret: no duplication, toggles.
  await caretIn(page, LORE, 0.5); await pick(page, "#ee-block", "cap");
  const c1 = await info(page);
  await caretIn(page, LORE, 0.5); await pick(page, "#ee-block", "cap");
  const c2 = await info(page);
  check(`[${vpName}] caret Caption: no duplication, toggles on/off`, c1.text === text0 && /ee-caption/.test(c1.cls) && !/ee-caption/.test(c2.cls) && c2.text === text0, `"${c1.cls}" → "${c2.cls}"`);
  // Phone/desktop: 12pt never renders larger than the body text on articles.
  await page.screenshot({ path: path.join(OUT, `size-${vpName}.png`) });
  // Journal: paragraph size on .read (leaving a dirty page asks first; accept).
  page._answer = true;
  await openEdit(page, "journal/");
  await caretIn(page, "main.read > p", 0.3);
  const j0 = await info(page); await pick(page, "#ee-size", "10"); const j10 = await info(page);
  await pick(page, "#ee-size", "default"); const jd = await info(page);
  check(`[${vpName}] journal: 10pt paragraph smaller than body; Default restores`, j10.fs < j0.fs && j10.h < j0.h && jd.fs === j0.fs && Math.abs(jd.h - j0.h) < 0.6 && jd.text === j0.text, `fs ${j0.fs}→${j10.fs}→${jd.fs}`);
  check(`[${vpName}] size tests: no page errors`, W.errs.length === 0, W.errs.join(" | "));
  await ctx.close();
}

const PAGES = [
  ["articles/aghor/", "articles/aghor/index.html", "main.art-body p.art-life"],
  ["articles/pethengorom/", "articles/pethengorom/index.html", "main.art-body p.art-life"],
  ["articles/nobunaga-yudai/", "articles/nobunaga-yudai/index.html", "main.art-body p.art-life"],
  ["journal/", "journal/index.html", "main.read > p"],
  ["codex/lore/", "codex/lore/index.html", "main.read blockquote p"],
  ["players/jack/", "players/jack/index.html", "main.read h1"],
  ["atlas/", "atlas/index.html", "main p"]
];
async function diffTests(browser, vpName, counts) {
  for (const [url, file, sel] of PAGES) {
    if (!fs.existsSync(path.join(ROOT, file))) continue;
    const mock = newMock(); const ctx = await ctxFor(browser, mock, VPS[vpName]); const page = await ctx.newPage(); const W = watch(page);
    try {
      await openEdit(page, url);
    } catch (e) { check(`[${vpName}] ${url}: enter edit`, false, e.message.split("\n")[0]); await ctx.close(); continue; }
    await page.waitForTimeout(600); // let late page scripts (navs, cards, image fallbacks) run
    const t = await caretIn(page, sel, 1.0);
    if (t == null || t === undefined) { check(`[${vpName}] ${url}: found an editable paragraph`, false); await ctx.close(); continue; }
    await page.keyboard.type(" Zq");
    await page.click("#ee-save");
    await page.waitForFunction(() => /Saved|No changes|refused|failed|changed this part/i.test((document.getElementById("ee-bar") || {}).textContent || ""), null, { timeout: 15000 }).catch(() => {});
    const orig = fs.readFileSync(path.join(ROOT, file), "utf8");
    const saved = mock.file(file) == null ? null : String(mock.file(file));
    const n = saved === orig ? 0 : diffLines(orig, saved, vpName + "-" + file.replace(/\W+/g, "_"));
    // Article pages have two identical copies (pretty URL + .html): both get the same edit.
    const mirror = /^articles\/([^/]+)\/index\.html$/.test(file) ? file.replace(/\/index\.html$/, ".html") : null;
    if (mirror && fs.existsSync(path.join(ROOT, mirror))) {
      const mo = fs.readFileSync(path.join(ROOT, mirror), "utf8"), ms = String(mock.file(mirror));
      if (mo === orig) check(`[${vpName}] ${url}: the .html copy gets the same edit (copies stay identical)`, ms === saved, `mirror +${ms.length - mo.length} bytes`);
    }
    counts[url] = n;
    const art = saved ? (saved.match(ARTIFACTS) || [""])[0] : "";
    check(`[${vpName}] ${url}: one-word edit saves as a 1-line diff, no live-DOM artifacts`, saved && saved !== orig && n <= 2 && !art && saved.includes("Zq") && saved.length - orig.length === 3, `diff lines ${n}, +${saved ? saved.length - orig.length : "?"} bytes${art ? ", artifact " + art : ""}`);
    check(`[${vpName}] ${url}: no page errors`, W.errs.length === 0, W.errs.join(" | "));
    await ctx.close();
  }
}

async function flowTests(browser, vpName) {
  // Conflict: main changed upstream after edit started → refused, nothing written.
  {
    const mock = newMock(); const ctx = await ctxFor(browser, mock, VPS[vpName]); const page = await ctx.newPage(); watch(page);
    const file = "articles/aghor/index.html", orig = fs.readFileSync(path.join(ROOT, file), "utf8");
    await openEdit(page, "articles/aghor/");
    await caretIn(page, "main.art-body p.art-life", 1.0); await page.keyboard.type(" Mine");
    mock.setUpstream(file, orig.replace('<p class="art-life">Rogue Ancient', '<p class="art-life">(upstream) Rogue Ancient'));
    await page.click("#ee-save"); await page.waitForTimeout(1200);
    const bar = await page.textContent("#ee-bar");
    const now = mock.file(file);
    check(`[${vpName}] conflict: body changed upstream → clear message, upstream kept, nothing written`, /changed this part of the page/.test(bar) && now.includes("(upstream)") && !now.includes(" Mine") && !mock.log.some((e) => e.method === "PUT"), bar.trim().slice(0, 80));
    await ctx.close();
  }
  {
    const mock = newMock(); const ctx = await ctxFor(browser, mock, VPS[vpName]); const page = await ctx.newPage(); watch(page);
    const file = "articles/aghor/index.html", orig = fs.readFileSync(path.join(ROOT, file), "utf8");
    await openEdit(page, "articles/aghor/");
    await caretIn(page, "main.art-body p.art-life", 1.0); await page.keyboard.type(" Mine");
    mock.setUpstream(file, orig.replace("<title>", "<title>Up "));
    await page.click("#ee-save"); await page.waitForTimeout(1200);
    const now = mock.file(file);
    check(`[${vpName}] upstream change outside the body: both kept`, now.includes("<title>Up ") && now.includes(" Mine</p>"), (await page.textContent("#ee-bar")).trim().slice(0, 60));
    await ctx.close();
  }
  // Hero from the gallery: preview only (nothing written), normal edit bar; Save writes it
  // with the page (both copies); Cancel puts the old art back. Lost bar recovers via Edit.
  {
    const mock = newMock(); const ctx = await ctxFor(browser, mock, VPS[vpName]); const page = await ctx.newPage(); watch(page);
    const file = "articles/aghor/index.html";
    await openEdit(page, "articles/aghor/");
    const src0 = await page.getAttribute(".art-hero img", "src");
    await page.click("#ee-art"); await page.waitForSelector(".ee-gal-item", { timeout: 10000 }).catch(() => {});
    const n0 = mock.log.length;
    const item = await page.$('.ee-gal-item:not([data-gal-id="aghor"])');
    const pickId = item && await item.getAttribute("data-gal-id");
    if (item) { await item.click(); await page.waitForTimeout(600); }
    const after = await page.evaluate(() => ({ save: !!document.getElementById("ee-save"), cancel: !!document.getElementById("ee-cancel"), x: !!document.getElementById("ee-x"), editing: window.EloraeEditor.state.editing, src: document.querySelector(".art-hero img").getAttribute("src"), bar: (document.getElementById("ee-bar") || {}).textContent }));
    const wrote = mock.log.slice(n0).some((e) => e.method !== "GET");
    check(`[${vpName}] hero pick from gallery: preview only, nothing written until Save; Save/Cancel bar`, item && !wrote && after.src !== src0 && after.save && after.cancel && !after.x && after.editing, JSON.stringify(after).slice(0, 160));
    await page.evaluate(() => document.getElementById("ee-bar").remove());
    await page.evaluate(() => window.EloraeEditor.tryEnterEdit());
    await page.waitForTimeout(200);
    check(`[${vpName}] edit mode without a bar recovers via Edit`, !!(await page.$("#ee-save")) && !!(await page.$("#ee-cancel")));
    await page.click("#ee-save"); await page.waitForTimeout(1500);
    const saved = String(mock.file(file)), orig = fs.readFileSync(path.join(ROOT, file), "utf8");
    const heroSrc = (saved.match(/<section class="art-hero[^"]*"><img src="([^"]+)"/) || [])[1];
    const n = diffLines(orig, saved, vpName + "-hero");
    check(`[${vpName}] hero Save: one commit writes the new hero src (both copies), nothing else`, heroSrc && heroSrc !== src0 && heroSrc.indexOf("/assets/") === 0 && okLines(vpName + "-hero", /<section class="art-hero"><img |"og:image"/) && saved.includes('og:image" content="https://elorae.world' + heroSrc) && String(mock.file("articles/aghor.html")) === saved, `hero ${heroSrc}, diff lines ${n} (hero + og:image)`);
    await ctx.close();
  }
  {
    const mock = newMock(); const ctx = await ctxFor(browser, mock, VPS[vpName]); const page = await ctx.newPage(); watch(page);
    await openEdit(page, "articles/aghor/");
    const src0 = await page.getAttribute(".art-hero img", "src");
    await page.click("#ee-art"); await page.waitForSelector(".ee-gal-item", { timeout: 10000 }).catch(() => {});
    await page.click('.ee-gal-item:not([data-gal-id="aghor"])').catch(() => {}); await page.waitForTimeout(300);
    page._answer = true;
    await page.click("#ee-cancel"); await page.waitForTimeout(300);
    const src1 = await page.getAttribute(".art-hero img", "src");
    check(`[${vpName}] hero preview + Cancel: old art back, nothing written`, src1 === src0 && !mock.log.some((e) => e.method !== "GET"), `${src0} → ${src1}`);
    await ctx.close();
  }
  // Unsaved changes: Cancel / in-site link / New article / unload prompt.
  {
    const mock = newMock(); const ctx = await ctxFor(browser, mock, VPS[vpName]); const page = await ctx.newPage(); const W = watch(page);
    await openEdit(page, "articles/aghor/");
    await page.click("#ee-cancel"); await page.waitForTimeout(200);
    check(`[${vpName}] clean Cancel: no prompt, edit mode ends`, W.dialogs.length === 0 && !(await page.evaluate(() => window.EloraeEditor.state.editing)));
    await page.evaluate(() => window.EloraeEditor.tryEnterEdit()); await page.waitForSelector("#ee-save");
    await caretIn(page, "main.art-body p.art-life", 1.0); await page.keyboard.type(" Dirty");
    await page.click("#ee-cancel"); await page.waitForTimeout(200);
    const still = await page.evaluate(() => window.EloraeEditor.state.editing && document.querySelector("main").textContent.includes(" Dirty"));
    check(`[${vpName}] dirty Cancel asks first; declining keeps the edit`, /confirm: Discard your unsaved changes/.test(W.dialogs.join("|")) && still, W.dialogs.join("|"));
    W.dialogs.length = 0;
    await page.click("#ee-newart").catch(() => {}); await page.waitForTimeout(200);
    check(`[${vpName}] dirty New article asks first`, /unsaved changes/.test(W.dialogs.join("|")) && !(await page.$("#ee-newart-form")), W.dialogs.join("|"));
    W.dialogs.length = 0;
    const url0 = page.url();
    await page.evaluate(() => { const a = [...document.querySelectorAll("a[href]")].find((a) => !a.closest(".ee-editable,#ee-bar,#ee-panel") && /\/(journal|atlas|codex)/.test(a.getAttribute("href"))); window.__link = a && a.getAttribute("href"); a.click(); });
    await page.waitForTimeout(500);
    check(`[${vpName}] dirty in-site link asks first; declining stays on the page`, /Leave this page\?/.test(W.dialogs.join("|")) && page.url() === url0, W.dialogs.join("|") + " " + (await page.evaluate(() => window.__link)));
    W.dialogs.length = 0;
    await page.close({ runBeforeUnload: true }); await new Promise((r) => setTimeout(r, 500));
    check(`[${vpName}] dirty tab close/reload triggers the browser's leave prompt`, W.dialogs.some((d) => /^beforeunload/.test(d)), W.dialogs.join("|"));
    const page2 = await ctx.newPage(); const W2 = watch(page2);
    await openEdit(page2, "articles/aghor/");
    await caretIn(page2, "main.art-body p.art-life", 1.0); await page2.keyboard.type(" Dirty");
    page2._answer = true;
    await page2.click("#ee-cancel"); await page2.waitForTimeout(200);
    check(`[${vpName}] confirming Cancel discards the edit`, !(await page2.evaluate(() => window.EloraeEditor.state.editing || document.querySelector("main").textContent.includes(" Dirty"))), W2.dialogs.join("|"));
    await ctx.close();
  }
  // Index organizer: nothing changed → nothing saved; a heading edit → small clean diff.
  {
    const mock = newMock(); const ctx = await ctxFor(browser, mock, VPS[vpName]); const page = await ctx.newPage(); const W = watch(page);
    const file = "index/ancients/index.html", orig = fs.readFileSync(path.join(ROOT, file), "utf8");
    await page.goto(BASE + "index/ancients/", { waitUntil: "load" });
    await page.waitForFunction(() => window.EloraeEditor && window.EloraeEditor.state.profile, null, { timeout: 15000 });
    await page.evaluate(() => window.EloraeEditor.tryEnterEdit()); await page.waitForSelector("#ee-idx-save");
    await page.waitForTimeout(400);
    await page.click("#ee-idx-save"); await page.waitForTimeout(600);
    check(`[${vpName}] index organizer: Save with no changes writes nothing`, /No changes/.test(await page.textContent("#ee-bar")) && !mock.log.some((e) => e.method !== "GET"), (await page.textContent("#ee-bar")).slice(0, 60));
    await page.evaluate(() => { const h = document.querySelector("#divines > h2"); h.focus(); h.textContent = "Divines Zq"; h.blur(); });
    await page.waitForTimeout(200);
    await page.click("#ee-idx-save"); await page.waitForTimeout(1500);
    const saved = String(mock.file(file));
    const n = saved === orig ? 0 : diffLines(orig, saved, vpName + "-index_ancients");
    const art = (saved.match(/nav-fade|--nf|data-eimg|ee-index|aria-expanded="false" href|draggable|contenteditable|is-lore-flipped|class="" style/) || [""])[0];
    const srcsets = [(orig.match(/srcset=/g) || []).length, (saved.match(/srcset=/g) || []).length];
    check(`[${vpName}] index organizer: heading rename saves without runtime artifacts; untouched cards byte-identical`, saved.includes("Divines Zq") && !art && srcsets[0] === srcsets[1] && saved.length - orig.length <= 3 * 4 + 6, `diff lines ${n}, +${saved.length - orig.length} bytes, srcset ${srcsets}, ${art}`);
    check(`[${vpName}] index organizer: the index/ancients.html copy gets the same save`, String(mock.file("index/ancients.html")) === saved);
    // Move a card (select + Categories) → card bytes kept (srcset etc.), only its id changes.
    await page.evaluate(() => document.querySelector("#ancients a.index-card").click());
    await page.waitForTimeout(150);
    await page.evaluate(() => document.querySelector('#index-toc-panel a[href="#demonic"]').click());
    await page.waitForTimeout(300);
    const moved = await page.evaluate(() => !!document.querySelector("#demonic a.index-card[href='/articles/aghor/']"));
    await page.click("#ee-idx-save"); await page.waitForTimeout(1500);
    const saved2 = String(mock.file(file));
    const n2 = diffLines(saved, saved2, vpName + "-index_ancients_move");
    const art2 = (saved2.match(/nav-fade|--nf|data-eimg|ee-index|aria-expanded="false" href|draggable|contenteditable|is-lore-flipped|class="" style|><\/polyline>|><\/path>/) || [""])[0];
    const ss2 = (saved2.match(/srcset=/g) || []).length;
    check(`[${vpName}] index organizer: moved card keeps its source markup (srcset), no runtime artifacts`, moved && saved2.includes('id="demonic-aghor" href="/articles/aghor/"') && !saved2.includes('id="ancients-aghor"') && !art2 && ss2 === srcsets[0], `moved ${moved}, srcset ${ss2}/${srcsets[0]}, ${art2}`);
    check(`[${vpName}] index organizer: no page errors`, W.errs.length === 0, W.errs.join(" | "));
    await ctx.close();
  }
}

const PNG1 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
// Paste into the element under the caret (clipboard HTML / text / a PNG file).
async function pasteInto(page, data) {
  await page.evaluate(({ html, text, png }) => {
    const dt = new DataTransfer();
    if (html) dt.setData("text/html", html);
    dt.setData("text/plain", text || "");
    if (png) { const b = Uint8Array.from(atob(png), (c) => c.charCodeAt(0)); dt.items.add(new File([b], "pasted picture.png", { type: "image/png" })); }
    const n = getSelection().anchorNode; const el = n.nodeType === 1 ? n : n.parentElement;
    el.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }));
  }, data);
  await page.waitForTimeout(400);
}
const writes = (mock, from) => mock.log.slice(from || 0).filter((e) => e.method !== "GET");

async function batch2Tests(browser, vpName) {
  const vp = VPS[vpName], LORE = "main.art-body p.art-life";
  // 1. Enter = new paragraph (same body class), Shift+Enter = line break, Enter after a heading = body paragraph.
  {
    const mock = newMock(); const ctx = await ctxFor(browser, mock, vp); const page = await ctx.newPage(); const W = watch(page);
    const file = "articles/aghor/index.html", orig = fs.readFileSync(path.join(ROOT, file), "utf8");
    await openEdit(page, "articles/aghor/");
    const text0 = await caretIn(page, LORE, 0.5);
    const n0 = await page.evaluate(() => document.querySelectorAll("main p.art-life").length);
    await page.keyboard.press("Enter");
    const e1 = await page.evaluate(() => { const ps = [...document.querySelectorAll("main p.art-life")]; const i = ps.indexOf(window.__el); const nx = ps[i + 1]; return { n: ps.length, cls: nx && nx.getAttribute("class"), id: nx && nx.id, joined: window.__el.textContent + "|" + (nx && nx.textContent), caretIn: nx && nx.contains(getSelection().anchorNode) }; });
    check(`[${vpName}] Enter splits into a new p.art-life (caret in it, no copied id)`, e1.n === n0 + 1 && e1.cls === "art-life" && !e1.id && e1.caretIn, JSON.stringify(e1).slice(0, 140));
    await page.keyboard.type("Zq");
    await page.keyboard.press("Shift+Enter"); await page.keyboard.type("Zr");
    const e2 = await page.evaluate(() => { const ps = [...document.querySelectorAll("main p.art-life")]; const nx = ps[ps.indexOf(window.__el) + 1]; return { n: ps.length, br: nx.querySelectorAll("br").length, html: nx.innerHTML.slice(0, 40) }; });
    check(`[${vpName}] Shift+Enter is a line break inside the same paragraph`, e2.n === n0 + 1 && e2.br === 1, JSON.stringify(e2));
    // Heading, then Enter at its end → a body paragraph.
    await caretIn(page, LORE, 1.0); await page.keyboard.press("Enter");
    await page.keyboard.type("Head Zh"); await pick(page, "#ee-block", "h2");
    await page.evaluate(() => { const h = [...document.querySelectorAll("main h2")].find((x) => x.textContent === "Head Zh"); const r = document.createRange(); r.selectNodeContents(h); r.collapse(false); h.closest(".ee-editable").focus(); getSelection().removeAllRanges(); getSelection().addRange(r); });
    await page.keyboard.press("Enter"); await page.keyboard.type("After Zp");
    const e3 = await page.evaluate(() => { const p = [...document.querySelectorAll("main p")].find((x) => x.textContent === "After Zp"); const h = [...document.querySelectorAll("main h2")].find((x) => x.textContent === "Head Zh"); return { p: p && p.getAttribute("class"), h: h && (h.getAttribute("class") || "") }; });
    check(`[${vpName}] Enter at the end of a heading gives a body paragraph (p.art-life)`, e3.p === "art-life" && e3.h === "", JSON.stringify(e3));
    await page.click("#ee-save"); await page.waitForTimeout(1500);
    const saved = String(mock.file(file));
    const n = diffLines(orig, saved, vpName + "-enter");
    check(`[${vpName}] Enter/heading edits save as clean source (new p.art-life, plain h2, no &nbsp;/ids/artifacts)`, saved.includes('<p class="art-life">Zq<br>Zr') && saved.includes("<h2>Head Zh</h2>") && saved.includes('<p class="art-life">After Zp</p>') && !/&nbsp;Zq|<p class="art-life">&nbsp;/.test(saved) && !ARTIFACTS.test(saved), `diff lines ${n}`);
    check(`[${vpName}] Enter tests: no page errors`, W.errs.length === 0, W.errs.join(" | "));
    await ctx.close();
  }
  // 2. Block menu: Heading = the page's section heading, Subheading = serif h3, Paragraph = p.art-life again.
  {
    const mock = newMock(); const ctx = await ctxFor(browser, mock, vp); const page = await ctx.newPage(); watch(page);
    await openEdit(page, "articles/aghor/");
    const t0 = await caretIn(page, LORE, 0.4);
    const real = await page.evaluate(() => { const h = document.querySelector("main .art-sec > h2"); const cs = getComputedStyle(h); return { fs: cs.fontSize, ff: cs.fontFamily, tt: cs.textTransform }; });
    const p0 = await page.evaluate(() => parseFloat(getComputedStyle(window.__el).fontSize));
    await pick(page, "#ee-block", "h2");
    const h2 = await page.evaluate(() => { const n = getSelection().anchorNode; const b = (n.nodeType === 1 ? n : n.parentElement).closest("h2,h3,p"); const cs = getComputedStyle(b); window.__b = b; return { tag: b.tagName, cls: b.getAttribute("class"), fs: cs.fontSize, ff: cs.fontFamily, tt: cs.textTransform }; });
    check(`[${vpName}] Block → Heading: an h2 styled exactly like the page's section headings`, h2.tag === "H2" && !h2.cls && h2.fs === real.fs && h2.ff === real.ff && h2.tt === real.tt, JSON.stringify(h2));
    await pick(page, "#ee-block", "h3");
    const h3 = await page.evaluate(() => { const n = getSelection().anchorNode; const b = (n.nodeType === 1 ? n : n.parentElement).closest("h2,h3,p"); const cs = getComputedStyle(b); return { tag: b.tagName, cls: b.getAttribute("class"), fs: parseFloat(cs.fontSize), ff: cs.fontFamily, tt: cs.textTransform, fw: cs.fontWeight }; });
    check(`[${vpName}] Block → Subheading: a serif h3 in the body face (not an 11px label, not bold)`, h3.tag === "H3" && !h3.cls && /Iowan|Palatino/.test(h3.ff) && h3.tt === "none" && h3.fs > p0 && h3.fw === "400", JSON.stringify(h3));
    await pick(page, "#ee-block", "p");
    const pp = await page.evaluate(() => { const n = getSelection().anchorNode; const b = (n.nodeType === 1 ? n : n.parentElement).closest("h2,h3,p"); return { tag: b.tagName, cls: b.getAttribute("class"), fs: parseFloat(getComputedStyle(b).fontSize), text: b.textContent }; });
    check(`[${vpName}] Block → Paragraph: back to p.art-life at body size, text intact`, pp.tag === "P" && pp.cls === "art-life" && pp.fs === p0 && pp.text === t0, JSON.stringify(pp).slice(0, 120));
    await ctx.close();
  }
  // 3. Hero name + epithet: admin edits both (epithet loses its ending period); both copies saved.
  {
    const mock = newMock(); const ctx = await ctxFor(browser, mock, vp); const page = await ctx.newPage(); const W = watch(page);
    const file = "articles/vaerek/index.html", orig = fs.readFileSync(path.join(ROOT, file), "utf8");
    await openEdit(page, "articles/vaerek/");
    const ed = await page.evaluate(() => ({ h1: document.querySelector(".art-title h1").isContentEditable, ep: document.querySelector(".art-title .art-epithet").isContentEditable }));
    await caretIn(page, ".art-title h1", 1.0); await page.keyboard.type(" Zq");
    await page.keyboard.press("Enter");
    await caretIn(page, ".art-title .art-epithet", 1.0); await page.keyboard.type(" of Zq.");
    await page.click("#ee-save"); await page.waitForTimeout(1500);
    const saved = String(mock.file(file)), n = diffLines(orig, saved, vpName + "-titles");
    check(`[${vpName}] admin: hero name + epithet editable, saved in place (no ending period, single line)`, ed.h1 && ed.ep && saved.includes("<h1>Vaerek Rathkin Zq</h1>") && saved.includes('<p class="art-epithet">Wreathbound Ranger of Zq</p>') && okLines(vpName + "-titles", /<title>|"og:title"|name="description"|"og:description"|<aside class="art-index"|<div class="art-title">/) && String(mock.file("articles/vaerek.html")) === saved, `diff lines ${n} (title, descriptions, rail, hero)`);
    check(`[${vpName}] titles: no page errors`, W.errs.length === 0, W.errs.join(" | "));
    await ctx.close();
  }
  // 3b/8. Player on his own page's pretty URL: can edit (incl. name/epithet); one PR updates both copies.
  {
    const mock = newMock(); const ctx = await ctxFor(browser, mock, vp, "sawyer"); const page = await ctx.newPage(); const W = watch(page);
    const file = "articles/vaerek/index.html", orig = fs.readFileSync(path.join(ROOT, file), "utf8");
    let ok = true;
    try { await openEdit(page, "articles/vaerek/"); } catch (e) { ok = false; }
    check(`[${vpName}] player: edits his own article at its pretty URL (articles/x/index.html)`, ok);
    if (ok) {
      const ed = await page.evaluate(() => document.querySelector(".art-title .art-epithet").isContentEditable);
      await caretIn(page, ".art-title .art-epithet", 1.0); await page.keyboard.type(" Zs");
      await caretIn(page, LORE, 1.0); await page.keyboard.type(" Zb");
      await page.click("#ee-save"); await page.waitForTimeout(1800);
      const pr = mock.pulls[0];
      const br = pr && pr.head;
      const a = br ? String(mock.file(file, br)) : "", b = br ? String(mock.file("articles/vaerek.html", br)) : "";
      check(`[${vpName}] player: name/epithet editable; one PR updates both copies identically`, ed && pr && a.includes("Wreathbound Ranger Zs</p>") && a.includes(" Zb") && a === b && String(mock.file(file)) === orig && writes(mock).filter((e) => /\/git\/refs\/heads\//.test(e.path)).length === 1, `pr ${pr && pr.number} branch ${br}`);
    }
    const page2 = await ctx.newPage(); watch(page2);
    await page2.goto(BASE + "articles/aghor/", { waitUntil: "load" });
    await page2.waitForFunction(() => window.EloraeEditor && window.EloraeEditor.state.profile, null, { timeout: 15000 }).catch(() => {});
    await page2.waitForTimeout(300);
    check(`[${vpName}] player: no Edit on someone else's article`, !(await page2.$("#ee-glyph")) && !(await page2.$("#ee-edit")) && !(await page2.evaluate(() => window.EloraeEditor.tryEnterEdit())));
    check(`[${vpName}] player tests: no page errors`, W.errs.length === 0, W.errs.join(" | "));
    await ctx.close();
  }
  // Article pages: no floating EDIT on the hero art; the top-nav EDIT opens the editor (Devin, and a
  // player on his own article); in edit mode the bars never cover the hero. Other pages keep the glyph.
  for (const who of ["devin", "sawyer"]) {
    const mock = newMock(); const ctx = await ctxFor(browser, mock, vp, who); const page = await ctx.newPage(); const W = watch(page);
    await page.goto(BASE + "articles/vaerek/", { waitUntil: "load" });
    await page.waitForFunction(() => window.EloraeEditor && window.EloraeEditor.state.profile, null, { timeout: 15000 });
    await page.waitForTimeout(300);
    const v = await page.evaluate(() => { const a = document.getElementById("ee-edit"); const r = a && a.getBoundingClientRect(); return { glyph: !!document.getElementById("ee-glyph"), inMast: !!(a && a.closest(".mast")), shown: !!(r && r.width > 0 && r.height > 0) }; });
    check(`[${vpName}] ${who}: article has no floating EDIT; top-nav EDIT shown`, !v.glyph && v.inMast && v.shown, JSON.stringify(v));
    await page.click("#ee-edit");
    let ok = true; try { await page.waitForSelector("#ee-save", { timeout: 10000 }); } catch (e) { ok = false; }
    await page.waitForTimeout(400);
    const e = await page.evaluate(() => {
      const h = document.querySelector("section.art-hero").getBoundingClientRect();
      const tops = ["ee-bar", "ee-stylebar"].map((id) => document.getElementById(id)).filter(Boolean).map((x) => x.getBoundingClientRect().top);
      const t = document.querySelector(".art-title").getBoundingClientRect();
      return { arts: !!document.getElementById("ee-arts-btn"), heroBottom: Math.round(h.bottom), titleBottom: Math.round(t.bottom), barTop: Math.round(Math.min.apply(null, tops)), glyph: !!document.getElementById("ee-glyph") };
    });
    check(`[${vpName}] ${who}: top-nav EDIT opens the editor with the Arts panel button`, ok && e.arts && !e.glyph, JSON.stringify(e));
    check(`[${vpName}] ${who}: edit mode — the edit/style bars start below the hero (name, epithet, Arts not covered)`, e.heroBottom <= e.barTop + 1 && e.titleBottom <= e.barTop + 1, JSON.stringify(e));
    await page.click("#ee-edit"); await page.waitForTimeout(200);
    check(`[${vpName}] ${who}: top-nav EDIT while editing keeps the edit bar`, !!(await page.$("#ee-save")));
    await page.click("#ee-cancel").catch(() => {}); await page.waitForTimeout(300);
    const after = await page.evaluate(() => ({ dock: document.documentElement.style.getPropertyValue("--ee-dock"), h: Math.round(document.querySelector("section.art-hero").getBoundingClientRect().height), vh: innerHeight }));
    check(`[${vpName}] ${who}: after Cancel the hero is full height again`, !after.dock && Math.abs(after.h - after.vh) <= 1, JSON.stringify(after));
    if (who === "devin") {
      await page.goto(BASE + "journal/", { waitUntil: "load" });
      await page.waitForFunction(() => window.EloraeEditor && window.EloraeEditor.state.profile, null, { timeout: 15000 });
      await page.waitForTimeout(300);
      check(`[${vpName}] devin: journal has only the nav Edit (no floating glyph)`, !(await page.$("#ee-glyph")) && !!(await page.$("#ee-edit")));
    }
    check(`[${vpName}] ${who}: article nav EDIT — no page errors`, W.errs.length === 0, W.errs.join(" | "));
    await ctx.close();
  }
  // Article templates: Template on the edit bar adds the type's empty Dossier rows after the existing
  // ones (no duplicate labels), remembers the type (tpl-<id> on the dl), switching keeps filled rows and
  // drops the old type's empty ones; viewers never see empty rows. Players on their own character too.
  if (vpName === "desktop" || vpName === "phone") {
    const mock = newMock(); const ctx = await ctxFor(browser, mock, VPS[vpName]); const page = await ctx.newPage(); const W = watch(page);
    {
      const sctx = await ctxFor(browser, newMock(), VPS[vpName], "sawyer"); const sp = await sctx.newPage();
      await sp.goto(BASE + "articles/vaerek/", { waitUntil: "load" });
      await sp.waitForFunction(() => window.EloraeEditor && window.EloraeEditor.state.profile, null, { timeout: 15000 });
      await sp.click("#ee-edit"); await sp.waitForSelector("#ee-tpl"); await sp.click("#ee-tpl"); await sp.click('#ee-tpl-menu [data-tpl="race"]');
      const sr = await sp.evaluate(() => [...document.querySelectorAll("main.art-body dl.art-dossier > dt")].map((d) => d.textContent).join("|"));
      check(`[${vpName}] template: a player can use templates on their own character (Race adds Land of Origin, Aliases)`, sr === "Name|Pronunciation|Faction|Land of Origin|Aliases", sr);
      await sp.goto(BASE + "articles/cressana/", { waitUntil: "load" });
      await sp.waitForFunction(() => window.EloraeEditor && window.EloraeEditor.state.profile, null, { timeout: 15000 });
      check(`[${vpName}] template: no Edit / Template on someone else's article for a player`, !(await sp.$("#ee-edit")) && !(await sp.$("#ee-tpl")));
      await sctx.close();
    }
    await page.goto(BASE + "articles/vaerek/", { waitUntil: "load" });
    await page.waitForFunction(() => window.EloraeEditor && window.EloraeEditor.state.profile, null, { timeout: 15000 });
    await page.click("#ee-edit"); await page.waitForSelector("#ee-tpl");
    await page.click("#ee-tpl"); await page.waitForSelector("#ee-tpl-menu");
    const menu = await page.evaluate(() => { const m = document.getElementById("ee-tpl-menu").getBoundingClientRect(); return { items: [...document.querySelectorAll("#ee-tpl-menu [data-tpl]")].map((b) => b.textContent + (b.classList.contains("ee-on") ? "*" : "")).join("|"), inside: m.left >= 0 && m.right <= innerWidth && m.top >= 0 && m.bottom <= innerHeight }; });
    check(`[${vpName}] template: Template menu on the edit bar lists None + the 7 types, None selected, on screen `, menu.items === "None*|Faction|Location (City)|Location (Region)|People|Conflict|Item|Race" && menu.inside, JSON.stringify(menu));
    await page.click('#ee-tpl-menu [data-tpl="people"]');
    const rows = () => page.evaluate(() => { const dl = document.querySelector("main.art-body dl.art-dossier"); return { cls: dl.className, rows: [...dl.querySelectorAll(":scope > dt")].map((d) => d.textContent + "=" + d.nextElementSibling.textContent.trim()) }; });
    const r1 = await rows();
    check(`[${vpName}] template: People adds its empty fields after the existing ones, in order`, r1.cls === "art-dossier tpl-people" && r1.rows.join("|") === "Name=Vaerek Rathkin|Pronunciation=(VAIR-ek RATH-kin)|Faction=Draconic Kindred|Homeland=|Age=|Race=|Titles=|Relatives=|Affiliation=", JSON.stringify(r1));
    // Fill two of them, then switch to Faction: filled rows stay, still-empty People rows go.
    await page.evaluate(() => { const dl = document.querySelector("main.art-body dl.art-dossier"); const dd = (l) => [...dl.querySelectorAll("dt")].find((d) => d.textContent === l).nextElementSibling; dd("Homeland").textContent = "Morath"; dd("Age").innerHTML = "<br>"; dd("Titles").textContent = "Wreathbound"; });
    await page.click("#ee-tpl"); await page.click('#ee-tpl-menu [data-tpl="faction"]');
    const r2 = await rows();
    check(`[${vpName}] template: switching to Faction keeps filled rows, drops the old type's empty ones, adds Founded/Leadership/Aliases`, r2.cls === "art-dossier tpl-faction" && r2.rows.join("|") === "Name=Vaerek Rathkin|Pronunciation=(VAIR-ek RATH-kin)|Faction=Draconic Kindred|Homeland=Morath|Titles=Wreathbound|Founded=|Leadership=|Aliases=", JSON.stringify(r2));
    await page.click("#ee-tpl"); await page.click('#ee-tpl-menu [data-tpl="people"]');
    mock.log.length = 0;
    await page.click("#ee-save");
    await page.waitForFunction(() => /Saved|failed|conflict/i.test((document.getElementById("ee-bar") || {}).textContent || ""), null, { timeout: 20000 });
    const f1 = String(mock.file("articles/vaerek/index.html")), f2 = String(mock.file("articles/vaerek.html"));
    const want = '<dl class="art-dossier tpl-people"><dt>Name</dt><dd>Vaerek Rathkin</dd><dt>Pronunciation</dt><dd>(VAIR-ek RATH-kin)</dd><dt>Faction</dt><dd><a href="/index/ancients/#kindred">Draconic Kindred</a></dd><dt>Homeland</dt><dd>Morath</dd><dt>Titles</dt><dd>Wreathbound</dd><dt>Age</dt><dd></dd><dt>Race</dt><dd></dd><dt>Relatives</dt><dd></dd><dt>Affiliation</dt><dd></dd></dl>';
    const commits = mock.log.filter((e) => e.committed);
    check(`[${vpName}] template: Save writes the type + rows into both copies (one commit), emptied fields saved empty, no editor residue`, commits.length === 1 && f1.includes(want) && f2.includes(want) && !/contenteditable|data-ee-|ee-tpl/.test(f1.replace(/<script[\s\S]*?<\/script>/g, "")), JSON.stringify({ c: commits.length, f1: f1.includes(want), f2: f2.includes(want), dl: (f1.match(/<dl class="art-dossier[\s\S]*?<\/dl>/) || ["none"])[0], res: (f1.replace(/<script[\s\S]*?<\/script>/g, "").match(/.{40}(contenteditable|data-ee-|ee-tpl).{40}/) || [""])[0] }));
    // Viewer: empty rows hidden, filled ones shown; the editor shows the type as selected next time.
    const vctx = await ctxFor(browser, mock, VPS[vpName]); const vp = await vctx.newPage();
    await vp.route(BASE + "articles/vaerek/", (r) => r.fulfill({ status: 200, contentType: "text/html", body: f1 }));
    await vp.goto(BASE + "articles/vaerek/", { waitUntil: "load" });
    const seen = await vp.evaluate(() => [...document.querySelectorAll("main.art-body dl.art-dossier > dt")].filter((d) => d.getClientRects().length).map((d) => d.textContent).join("|"));
    check(`[${vpName}] template: viewers see only filled fields`, seen === "Name|Pronunciation|Faction|Homeland|Titles", seen);
    await vp.waitForFunction(() => window.EloraeEditor && window.EloraeEditor.state.profile, null, { timeout: 15000 });
    await vp.click("#ee-edit"); await vp.waitForSelector("#ee-tpl"); await vp.click("#ee-tpl");
    const sel = await vp.evaluate(() => { const on = document.querySelector("#ee-tpl-menu .ee-on"); return on && on.textContent; });
    const allShown = await vp.evaluate(() => [...document.querySelectorAll("main.art-body dl.art-dossier > dt")].filter((d) => d.getClientRects().length).length);
    check(`[${vpName}] template: next edit shows People selected and every field (empty ones too) to fill`, sel === "People" && allShown === 9, JSON.stringify({ sel, allShown }));
    // None: the still-empty People fields go again.
    await vp.click('#ee-tpl-menu [data-tpl=""]');
    const r3 = await vp.evaluate(() => { const dl = document.querySelector("main.art-body dl.art-dossier"); return dl.className + " " + [...dl.querySelectorAll(":scope > dt")].map((d) => d.textContent).join("|"); });
    check(`[${vpName}] template: None removes the empty template fields, keeps the filled ones`, r3 === "art-dossier Name|Pronunciation|Faction|Homeland|Titles", r3);
    await vp.evaluate(() => { const dl = document.querySelector("main.art-body dl.art-dossier"); const dt = document.createElement("dt"); dt.textContent = "Zq Blank"; const dd = document.createElement("dd"); dd.textContent = "\u2014"; dl.append(dt, dd); });
    await vp.unroute(BASE + "articles/vaerek/");
    await vp.click("#ee-save");
    await vp.waitForFunction(() => /Saved|failed|conflict/i.test((document.getElementById("ee-bar") || {}).textContent || ""), null, { timeout: 20000 });
    const f3 = String(mock.file("articles/vaerek/index.html"));
    const shown3 = await vp.evaluate(() => [...document.querySelectorAll("main.art-body dl.art-dossier > dt")].filter((d) => d.getClientRects().length).map((d) => d.textContent).join("|"));
    check(`[${vpName}] empty fields: unfilled-row marks never reach the saved file; after Save the placeholder row is hidden again for viewing`, !/data-ee-empty/.test(f3) && f3.includes("<dt>Zq Blank</dt><dd>\u2014</dd>") && shown3 === "Name|Pronunciation|Faction|Homeland|Titles", JSON.stringify({ mark: /data-ee-empty/.test(f3), row: f3.includes("<dt>Zq Blank</dt>"), shown3 }));
    await vctx.close();
    // An article with no Dossier: the template creates one (after Description, before Lore); all-empty Dossier hidden for viewers.
    check(`[${vpName}] template: no page errors`, W.errs.length === 0, W.errs.join(" | "));
    await ctx.close();
    const dctx = await ctxFor(browser, mock, VPS[vpName]); const dp = await dctx.newPage(); const W2 = watch(dp);
    await dp.goto(BASE + "articles/cressana/", { waitUntil: "load" });
    await dp.waitForFunction(() => window.EloraeEditor && window.EloraeEditor.state.profile, null, { timeout: 15000 });
    await dp.click("#ee-edit"); await dp.waitForSelector("#ee-tpl"); await dp.click("#ee-tpl"); await dp.click('#ee-tpl-menu [data-tpl="item"]');
    mock.log.length = 0;
    await dp.click("#ee-save");
    await dp.waitForFunction(() => /Saved|failed|conflict/i.test((document.getElementById("ee-bar") || {}).textContent || ""), null, { timeout: 20000 });
    const c1 = String(mock.file("articles/cressana/index.html"));
    check(`[${vpName}] template: Devin on an article with no Dossier: Item creates one before Lore`, c1.includes('<section class="art-sec" id="dossier"><h2>Dossier</h2><dl class="art-dossier tpl-item"><dt>Owners</dt><dd></dd><dt>Origin</dt><dd></dd></dl></section>') && c1.indexOf('id="dossier"') < c1.indexOf('id="lore"'), (c1.match(/<main[\s\S]{0,300}/) || [""])[0]);
    await dp.route(BASE + "articles/cressana/", (r) => r.fulfill({ status: 200, contentType: "text/html", body: c1 }));
    await dp.goto(BASE + "articles/cressana/", { waitUntil: "load" });
    const hid = await dp.evaluate(() => { const s = document.getElementById("dossier"); return s && getComputedStyle(s).display; });
    check(`[${vpName}] template: a Dossier with only empty fields is hidden from viewers (heading too)`, hid === "none", hid);
    check(`[${vpName}] template (Devin): no page errors`, W2.errs.length === 0, W2.errs.join(" | "));
    await dctx.close();
  }
  // Top-nav GALLERY (Devin only, any page): opens the gallery manager without edit mode; a change is one catalog commit.
  if (vpName === "desktop" || vpName === "phone") {
    const mock = newMock(); const ctx = await ctxFor(browser, mock, VPS[vpName]); const page = await ctx.newPage(); const W = watch(page);
    await page.goto(BASE + "journal/", { waitUntil: "load" });
    await page.waitForFunction(() => window.EloraeEditor && window.EloraeEditor.state.profile, null, { timeout: 15000 });
    const order = await page.evaluate(() => { const g = document.getElementById("ee-gallery"); const p = g && g.previousElementSibling; return g ? (p && p.id) + ">" + g.textContent.trim() : "none"; });
    check(`[${vpName}] gallery: GALLERY leads the top nav row (no DASHBOARD)`, /^(null|undefined)>Gallery$/i.test(order), order);
    await page.click("#ee-gallery");
    await page.waitForSelector("#ee-galm-wrap .ee-gal-item", { timeout: 10000 });
    const g = await page.evaluate(() => { const b = document.querySelector("#ee-panel .ee-box").getBoundingClientRect(); return { editing: document.documentElement.classList.contains("ee-editing"), n: document.querySelectorAll("#ee-galm-wrap .ee-gal-item").length, l: Math.round(b.left), r: Math.round(innerWidth - b.right), t: Math.round(b.top), bt: Math.round(innerHeight - b.bottom) }; });
    check(`[${vpName}] gallery: manager opens centred, inside the screen, without edit mode`, !g.editing && g.n > 5 && Math.abs(g.l - g.r) <= 2 && g.t >= 0 && g.bt >= 0, JSON.stringify(g));
    await page.click("#ee-galm-wrap .ee-gal-item"); await page.waitForSelector("#ee-galm-title");
    const id = await page.evaluate(() => document.querySelector("#ee-galm-wrap .ee-gal-item.ee-on").getAttribute("data-gal-id"));
    await page.fill("#ee-galm-title", "Zg Renamed Art"); await page.fill("#ee-galm-tags", "zg, test");
    mock.log.length = 0;
    await page.click("#ee-galm-save"); await page.waitForTimeout(1500);
    const cat = JSON.parse(String(mock.file("edit/media/catalog.json")));
    const commits = mock.log.filter((e) => e.committed);
    check(`[${vpName}] gallery: rename + tags saved as one catalog commit`, commits.length === 1 && cat.media[id] && cat.media[id].title === "Zg Renamed Art" && cat.media[id].tags.join(",") === "zg,test" && /Saved at/.test(await page.textContent("#ee-galm-msg")), JSON.stringify({ commits: commits.length, e: cat.media[id] }));
    check(`[${vpName}] gallery: no page errors`, W.errs.length === 0, W.errs.join(" | "));
    await ctx.close();
    const ctx2 = await ctxFor(browser, newMock(), VPS[vpName], "sawyer"); const p2 = await ctx2.newPage();
    await p2.goto(BASE + "articles/vaerek/", { waitUntil: "load" });
    await p2.waitForFunction(() => window.EloraeEditor && window.EloraeEditor.state.profile, null, { timeout: 15000 });
    check(`[${vpName}] gallery: players get no GALLERY link`, !(await p2.$("#ee-gallery")));
    await ctx2.close();
  }
  // Rename -> every Index card of the article (both copies) + its Categories entries, same commit; a
  // card that already said something else is corrected too; a stale Index organizer tab can't revert it.
  if (vpName === "desktop") {
    const mock = newMock(); const ctx = await ctxFor(browser, mock, vp); const W = { errs: [] };
    for (const f of ["index/ancients/index.html", "index/ancients.html"]) mock.setUpstream(f, String(mock.file(f)).replace(/<span>Vaerek Rathkin<\/span>/g, "<span>Vaerek Stale</span>"));
    const org = await ctx.newPage(); org.on("pageerror", (e) => W.errs.push(e.message));
    await org.goto(BASE + "index/ancients/", { waitUntil: "load" });
    await org.waitForFunction(() => window.EloraeEditor && window.EloraeEditor.state.profile, null, { timeout: 15000 });
    await org.evaluate(() => window.EloraeEditor.tryEnterEdit()); await org.waitForSelector("#ee-idx-save");
    const page = await ctx.newPage(); page.on("pageerror", (e) => W.errs.push(e.message));
    await openEdit(page, "articles/vaerek/");
    await caretIn(page, ".art-title h1", 1.0); await page.keyboard.type(" Zn");
    await caretIn(page, ".art-title .art-epithet", 1.0); await page.keyboard.type(" Zp");
    mock.log.length = 0;
    await page.click("#ee-save"); await page.waitForTimeout(2500);
    const commits = mock.log.filter((e) => e.committed);
    const a = String(mock.file("index/ancients/index.html")), b = String(mock.file("index/ancients.html"));
    const nCards = (a.match(/<span>Vaerek Rathkin Zn<\/span>/g) || []).length, nToc = (a.match(/>Vaerek Rathkin Zn<\/a>/g) || []).length;
    const ep = (a.match(/data-epithet="Wreathbound Ranger Zp"/g) || []).length;
    check(`[${vpName}] rename: both Index copies' cards + Categories entries take the new name/epithet in the same commit`,
      commits.length === 1 && commits[0].committed.paths.includes("index/ancients.html") && nCards === 2 && nToc === 2 && ep === 2 && a === b && !a.includes("Vaerek Stale"),
      JSON.stringify({ commits: commits.length, nCards, nToc, ep, same: a === b, stale: a.includes("Vaerek Stale") }));
    await org.evaluate(() => { const h = document.querySelector("#divines > h2"); h.focus(); h.textContent = "Divines Zt"; h.blur(); });
    await org.click("#ee-idx-save"); await org.waitForTimeout(2500);
    const c = String(mock.file("index/ancients/index.html"));
    check(`[${vpName}] rename: an Index organizer opened before the rename does not revert it on Save`, c.includes("Divines Zt") && (c.match(/<span>Vaerek Rathkin Zn<\/span>/g) || []).length === 2 && (c.match(/data-epithet="Wreathbound Ranger Zp"/g) || []).length === 2 && !c.includes("Vaerek Stale"), JSON.stringify({ zt: c.includes("Divines Zt"), stale: c.includes("Vaerek Stale"), bar: (await org.textContent("#ee-bar")).slice(0, 80) }));
    check(`[${vpName}] rename tests: no page errors`, W.errs.length === 0, W.errs.join(" | "));
    await ctx.close();
  }
  // Save races: someone pushes to main between our read and our write (GitHub: 409 stale sha /
  // 422 "Update is not a fast forward"). Saves re-read main, re-apply, retry; only a lasting race errors.
  if (vpName === "desktop") {
    const mock = newMock(); const ctx = await ctxFor(browser, mock, vp); const page = await ctx.newPage(); const W = watch(page);
    let races = 0;
    const raceOn = (file, times) => { races = 0; mock.hooks.before = (e) => {
      const write = (e.method === "PATCH" && /\/git\/refs\/heads\/main$/.test(e.path)) || (e.method === "PUT" && /\/contents\//.test(e.path) && (!e.body || !e.body.branch || e.body.branch === "main"));
      if (write && races < times) { races++; mock.setUpstream(file, String(mock.file(file)).replace("</body>", "<!-- upstream " + races + " -->\n</body>")); }
      return null;
    }; };
    // Index organizer
    const idx = "index/ancients/index.html";
    await page.goto(BASE + "index/ancients/", { waitUntil: "load" });
    await page.waitForFunction(() => window.EloraeEditor && window.EloraeEditor.state.profile, null, { timeout: 15000 });
    await page.evaluate(() => window.EloraeEditor.tryEnterEdit()); await page.waitForSelector("#ee-idx-save");
    await page.evaluate(() => { const h = document.querySelector("#divines > h2"); h.focus(); h.textContent = "Divines Zr"; h.blur(); });
    raceOn(idx, 1);
    await page.click("#ee-idx-save"); await page.waitForTimeout(4000);
    let a = String(mock.file(idx)), b = String(mock.file("index/ancients.html"));
    check(`[${vpName}] race: Index save retried on the new main — both changes kept, copies identical`, races === 1 && a.includes("Divines Zr") && a.includes("<!-- upstream 1 -->") && a === b, JSON.stringify({ races, zr: a.includes("Divines Zr"), up: a.includes("upstream 1"), same: a === b, bar: (await page.textContent("#ee-bar")).slice(0, 80) }));
    await page.evaluate(() => { const h = document.querySelector("#divines > h2"); h.focus(); h.textContent = "Divines Zs"; h.blur(); });
    raceOn(idx, 99);
    await page.click("#ee-idx-save"); await page.waitForTimeout(9000);
    const barT = await page.textContent("#ee-bar");
    check(`[${vpName}] race: a lasting race gives a plain message and keeps the unsaved edit`, /Someone else saved at the same time/.test(barT) && races === 4 && (await page.evaluate(() => document.querySelector("#divines > h2").textContent)) === "Divines Zs" && !String(mock.file(idx)).includes("Divines Zs"), JSON.stringify({ races, bar: barT.slice(0, 120) }));
    mock.hooks.before = null;
    await page.evaluate(() => { try { window.EloraeIndexOrg.cancel && window.EloraeIndexOrg.cancel(); } catch (e) {} });
    // Article editor (one file -> contents PUT with a stale sha -> 409)
    const art = "articles/vaerek/index.html";
    page._answer = true;
    await openEdit(page, "articles/vaerek/");
    await caretIn(page, LORE, 1.0); await page.keyboard.type(" Zrace");
    raceOn(art, 2);
    await page.click("#ee-save"); await page.waitForTimeout(6500);
    a = String(mock.file(art));
    check(`[${vpName}] race: article save retried twice on the new main — edit and the other save both kept`, races === 2 && a.includes(" Zrace") && a.includes("<!-- upstream 2 -->") && /Saved at/.test(await page.textContent("#ee-bar")), JSON.stringify({ races, z: a.includes(" Zrace"), bar: (await page.textContent("#ee-bar")).slice(0, 100) }));
    mock.hooks.before = null;
    check(`[${vpName}] race tests: no page errors`, W.errs.length === 0, W.errs.join(" | "));
    await ctx.close();
  }
  {
    const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1 });
    await ctx.route((u) => !u.href.startsWith(BASE) && !u.href.startsWith("data:"), (r) => r.abort());
    await ctx.addInitScript(`try{localStorage.setItem("elorae-login","jack");document.cookie="elorae-login=jack;path=/";}catch(e){}`);
    const page = await ctx.newPage();
    await page.goto(BASE + "articles/vaerek/", { waitUntil: "load" }); await page.waitForTimeout(400);
    const src0 = await page.evaluate(() => document.querySelector("section.art-hero > img, section.art-hero img").currentSrc);
    const nb = await page.$(".art-swap .art-next");
    if (nb) { await page.click(".art-swap .art-next", { force: vpName !== "phone" }); await page.waitForTimeout(600); }
    const r = await page.evaluate(() => ({ src: document.querySelector("section.art-hero > img, section.art-hero img").currentSrc, edit: !!document.getElementById("ee-edit") || !!document.getElementById("ee-glyph") }));
    check(`[${vpName}] viewer: no EDIT anywhere on the article; Arts arrows still switch the art`, !!nb && r.src !== src0 && !r.edit, JSON.stringify({ src0: src0.slice(-40), src: r.src.slice(-40), edit: r.edit }));
    await ctx.close();
  }
  // 4/5. Gallery Insert goes after the caret's paragraph (as a captioned figure); pasted pictures wait for Save and go in one commit.
  {
    const mock = newMock(); const ctx = await ctxFor(browser, mock, vp); const page = await ctx.newPage(); const W = watch(page);
    const file = "articles/aghor/index.html";
    await openEdit(page, "articles/aghor/");
    const t0 = await caretIn(page, LORE, 0.5);
    await page.click("#ee-art"); await page.waitForSelector(".ee-gal-item", { timeout: 10000 }).catch(() => {});
    await page.check('input[name="ee-gal-act"][value="insert"]');
    await page.click(".ee-gal-item"); await page.waitForTimeout(400);
    // ic1: a figure can't sit inside a <p>, so the captioned picture goes right after the paragraph
    // holding the caret (not at the page end), with the paragraph's text left whole.
    const g = await page.evaluate((t0) => { const p = window.__el, f = p && p.nextElementSibling, im = f && f.tagName === "FIGURE" && f.querySelector(":scope > img"), fc = f && f.querySelector(":scope > figcaption");
      return { inP: !!(p && p.querySelector("img, figure")), fig: !!im, cap: !!(fc && fc.hasAttribute("data-ee-empty")), whole: p && p.textContent === t0, src: im ? im.getAttribute("src") : null, sel: !!(fc && window.getSelection().anchorNode && fc.contains(window.getSelection().anchorNode)) }; }, t0);
    check(`[${vpName}] gallery Insert: captioned figure goes right after the caret's paragraph (not inside it, not the page end)`, g && !g.inP && g.fig && g.cap && g.whole && g.sel && /^\/assets\//.test(g.src), JSON.stringify(g));
    const n0 = mock.log.length;
    await caretIn(page, LORE, 1.0);
    await pasteInto(page, { png: PNG1 });
    const pend = await page.evaluate(() => [...document.querySelectorAll("main img[data-ee-pending]")].map((i) => i.getAttribute("src").slice(0, 5)));
    check(`[${vpName}] pasted picture: shown at once, nothing uploaded before Save`, pend.length === 1 && pend[0] === "blob:" && writes(mock, n0).length === 0, JSON.stringify(pend));
    await page.click("#ee-save"); await page.waitForTimeout(2000);
    const commits = writes(mock, n0).filter((e) => e.committed);
    const c = commits[0] && commits[0].committed;
    const saved = String(mock.file(file));
    const asset = (saved.match(/<img src="(\/assets\/pasted-picture[^"]*\.png)"/) || [])[1];
    const cat = JSON.parse(String(mock.file("edit/media/catalog.json")));
    check(`[${vpName}] Save: one commit with the page (both copies), the picture and the catalog`, commits.length === 1 && asset && mock.file(asset.slice(1)) && Object.values(cat.media).some((m) => "/" + m.path === asset) && String(mock.file("articles/aghor.html")) === saved && !/blob:|data-ee-pending/.test(saved), `commits ${commits.length}, asset ${asset}`);
    check(`[${vpName}] gallery/paste: no page errors`, W.errs.length === 0, W.errs.join(" | "));
    await ctx.close();
  }
  // 6/7. Rich paste cleanup; Font on overlapping partial selections never nests.
  {
    const mock = newMock(); const ctx = await ctxFor(browser, mock, vp); const page = await ctx.newPage(); const W = watch(page);
    await openEdit(page, "articles/aghor/");
    await caretIn(page, LORE, 0.5);
    await pasteInto(page, { html: '<meta charset="utf-8"><b style="font-weight:normal;" id="docs-internal-guid-1"><span style="font-size:11pt;font-family:Arial;font-weight:700">Docs</span><span style="font-size:11pt;font-family:Arial"> plain</span></b>', text: "Docs plain" });
    const d = await page.evaluate(() => window.__el.innerHTML.match(/.{0,20}Docs plain.{0,4}|.{0,30}Docs<\/strong>.{0,10}/)?.[0] || window.__el.innerHTML.slice(0, 80));
    const dn = await page.evaluate(() => ({ strong: window.__el.querySelectorAll("strong").length, junk: window.__el.querySelectorAll("b, span, font, [style]").length, ps: document.querySelectorAll("main p.art-life").length }));
    check(`[${vpName}] Google Docs paste inline: only the bold run is bold, merged into the paragraph`, dn.strong === 1 && dn.junk === 0 && /<strong>Docs<\/strong> plain/.test(d), d + " " + JSON.stringify(dn));
    await caretIn(page, LORE, 1.0);
    const word = '<html><head><style>p.MsoNormal{font-family:Calibri}</style></head><body><!--StartFragment--><p class="MsoNormal" style="font-family:Calibri;font-size:14pt"><span style="font-size:14pt"><font face="Arial" color="red">Pasted <b>bold</b> <span style="font-weight:700">heavy</span> <i>it</i> <a href="https://example.com" class="x" style="color:blue">link</a></font></span></p><h1 style="color:red">Pasted Head</h1><ul><li><span style="font-family:Arial">one</span></li><li>two</li></ul><p class="MsoNormal"><span>Last line</span></p><!--EndFragment--></body></html>';
    await pasteInto(page, { html: word, text: "Pasted bold heavy it link" });
    const r = await page.evaluate(() => {
      const m = document.querySelector("main");
      const p = [...m.querySelectorAll("p")].find((x) => x.textContent.includes("Pasted bold"));
      window.__el = [...m.querySelectorAll("p.art-life")].find((x) => x.textContent.length > 3 && !x.textContent.includes("Pasted"));
      const last = [...m.querySelectorAll("p")].find((x) => x.textContent === "Last line");
      return { p: p && p.outerHTML, h: !![...m.querySelectorAll("h2")].find((x) => x.textContent === "Pasted Head" && !x.getAttribute("class")),
        li: [...m.querySelectorAll("ul > li")].map((x) => x.textContent).join(","), last: last && last.getAttribute("class"),
        junk: m.querySelectorAll("font, .MsoNormal, span:not([class]), :is(p,h2,h3,li,ul) [style], :is(p,h2,h3,li,ul)[style]").length };
    });
    check(`[${vpName}] rich paste: p.art-life / h2 / ul li / strong / em / a only; no fonts, styles, spans or foreign classes`, r.p && /^<p class="art-life">.*tripartite\.Pasted /.test(r.p) && /<strong>bold<\/strong> <strong>heavy<\/strong> <em>it<\/em> <a href="https:\/\/example.com">link<\/a>/.test(r.p) && r.h && r.li === "one,two" && r.last === "art-life" && r.junk === 0, JSON.stringify(r).slice(-420));
    await page.click("#ee-save"); await page.waitForTimeout(1500);
    const ps = String(mock.file("articles/aghor/index.html"));
    check(`[${vpName}] rich paste saves as clean source (h2, ul/li, strong/em/a; no fonts/styles/spans/Mso)`, ps.includes("\n<h2>Pasted Head</h2>") && ps.includes("<ul><li>one</li><li>two</li></ul>") && ps.includes('<p class="art-life">Last line</p>') && ps.includes("<strong>Docs</strong> plain") && !/MsoNormal|<font|<span>|style="font|docs-internal/.test(ps) && !ARTIFACTS.test(ps), (ps.match(/tripartite\.[\s\S]{0,200}/) || [""])[0]);
    await page.evaluate(() => window.EloraeEditor.tryEnterEdit()); await page.waitForSelector("#ee-save");
    await caretIn(page, LORE, 0.10, 0.40); await pick(page, "#ee-font", "serif");
    await caretIn(page, LORE, 0.25, 0.60); await pick(page, "#ee-font", "sans");
    const f = await page.evaluate(() => ({ nested: window.__el.querySelectorAll(".ee-serif .ee-sans, .ee-sans .ee-serif, .ee-serif .ee-serif, .ee-sans .ee-sans").length, serif: window.__el.querySelectorAll(".ee-serif").length, sans: window.__el.querySelectorAll(".ee-sans").length }));
    check(`[${vpName}] Font on an overlapping partial selection: split, never nested`, f.nested === 0 && f.serif >= 1 && f.sans === 1, JSON.stringify(f));
    check(`[${vpName}] paste/font: no page errors`, W.errs.length === 0, W.errs.join(" | "));
    await ctx.close();
  }
  // 10. Phone bars compact (one row of style controls); 9. Categories closed while editing on phone.
  if (vpName === "phone") {
    const mock = newMock(); const ctx = await ctxFor(browser, mock, vp); const page = await ctx.newPage(); watch(page);
    await openEdit(page, "articles/aghor/");
    await caretIn(page, LORE, 0.3); await page.waitForTimeout(200);
    const b = await page.evaluate(() => { const bar = document.getElementById("ee-bar").getBoundingClientRect(), sb = document.getElementById("ee-stylebar"); const tops = [...sb.children].map((c) => { const q = c.getBoundingClientRect(); return Math.round((q.top + q.bottom) / 20); }); return { bar: Math.round(bar.height), sb: Math.round(sb.getBoundingClientRect().height), rows: new Set(tops).size, overflow: sb.scrollWidth > sb.clientWidth + 1, rail: document.documentElement.classList.contains("cats-rail-phone-open") }; });
    check(`[phone] edit bar + style bar compact: style controls on one row`, b.bar <= 72 && b.sb <= 44 && b.rows === 1 && !b.overflow, JSON.stringify(b));
    check(`[phone] article editing: Categories panel closed (not over the text)`, !b.rail, JSON.stringify(b));
    await page.screenshot({ path: path.join(OUT, "phone-bars.png") });
    await ctx.close();
    const mock2 = newMock(); const ctx2 = await ctxFor(browser, mock2, vp); const pg = await ctx2.newPage(); const W2 = watch(pg);
    await pg.goto(BASE + "index/ancients/", { waitUntil: "load" });
    await pg.waitForFunction(() => window.EloraeEditor && window.EloraeEditor.state.profile, null, { timeout: 15000 });
    const before = await pg.evaluate(() => ({ open: document.querySelector("aside.index-toc").classList.contains("open"), ls: localStorage.getItem("elorae-cats-rail") }));
    await pg.evaluate(() => window.EloraeEditor.tryEnterEdit()); await pg.waitForSelector("#ee-idx-save"); await pg.waitForTimeout(300);
    const org = await pg.evaluate(() => { const c = document.querySelector("main a.index-card"); return { open: document.querySelector("aside.index-toc").classList.contains("open"), cardTop: Math.round(c.getBoundingClientRect().top) }; });
    await pg.click("#ee-idx-cancel").catch(async () => { await pg.evaluate(() => window.EloraeIndexOrg && window.EloraeIndexOrg.cancel && window.EloraeIndexOrg.cancel()); });
    await pg.waitForTimeout(300);
    const ls2 = await pg.evaluate(() => localStorage.getItem("elorae-cats-rail"));
    check(`[phone] index organizer: Categories closed by default, cards visible; the visitor's setting is kept`, before.open && !org.open && org.cardTop < 400 && ls2 === before.ls, JSON.stringify({ before, org, ls2 }));
    await pg.screenshot({ path: path.join(OUT, "phone-index-org.png") });
    check(`[phone] index organizer phone: no page errors`, W2.errs.length === 0, W2.errs.join(" | "));
    await ctx2.close();
  }
}

// Alignment: left / center / right on whole blocks (classes ee-al-*), never inline.
async function alignTests(browser, vpName) {
  const vp = VPS[vpName], LORE = "main.art-body p.art-life", phone = vpName === "phone";
  const blockAt = (page) => page.evaluate(() => { const n = getSelection().anchorNode; const b = (n.nodeType === 1 ? n : n.parentElement).closest("p,h2,h3,li"); return { tag: b.tagName, cls: b.getAttribute("class") || "", ta: getComputedStyle(b).textAlign, text: b.textContent, spans: b.querySelectorAll("[class*=ee-al-]").length }; });
  const pressed = (page) => page.evaluate(() => ({ l: document.getElementById("ee-al-left").getAttribute("aria-pressed"), c: document.getElementById("ee-al-center").getAttribute("aria-pressed"), r: document.getElementById("ee-al-right").getAttribute("aria-pressed"), cyc: document.getElementById("ee-al-cycle").getAttribute("aria-label") }));
  // Desktop: three buttons; phone: one cycling glyph (left → center → right → left).
  async function setAl(page, a) {
    if (!phone) { await page.click("#ee-al-" + a); await page.waitForTimeout(120); return; }
    for (let i = 0; i < 3; i++) {
      const cur = await page.evaluate(() => document.getElementById("ee-al-cycle").getAttribute("aria-label"));
      if (cur === "Alignment: " + a) return;
      await page.click("#ee-al-cycle"); await page.waitForTimeout(120);
    }
  }
  {
    const mock = newMock(); const ctx = await ctxFor(browser, mock, vp); const page = await ctx.newPage(); const W = watch(page);
    const file = "articles/aghor/index.html", orig = fs.readFileSync(path.join(ROOT, file), "utf8");
    await openEdit(page, "articles/aghor/");
    const vis = await page.evaluate(() => [...document.querySelectorAll("#ee-stylebar .ee-al-btn")].filter((b) => b.offsetWidth > 0).map((b) => b.id).join(","));
    check(`[${vpName}] alignment controls: ${phone ? "one cycling glyph" : "three glyph buttons"} with tooltips`, phone ? vis === "ee-al-cycle" : vis === "ee-al-left,ee-al-center,ee-al-right", vis);
    const t0 = await caretIn(page, LORE, 0.4); await page.waitForTimeout(150);
    const p0 = await pressed(page);
    await setAl(page, "center");
    const c = await blockAt(page), pc = await pressed(page);
    check(`[${vpName}] Center: class on the paragraph (no span), centred, active state shown`, /\bee-al-center\b/.test(c.cls) && /\bart-life\b/.test(c.cls) && c.ta === "center" && c.spans === 0 && c.text === t0 && p0.l === "true" && pc.c === "true" && pc.l === "false" && pc.cyc === "Alignment: center", JSON.stringify({ c, p0, pc }).slice(0, 200));
    await page.keyboard.press("Control+z"); await page.waitForTimeout(100);
    const u = await blockAt(page);
    await page.keyboard.press("Control+Shift+z"); await page.waitForTimeout(100);
    const rd = await blockAt(page);
    check(`[${vpName}] Ctrl+Z undoes an alignment change (Ctrl+Shift+Z redoes)`, !/ee-al-/.test(u.cls) && u.ta !== "center" && /ee-al-center/.test(rd.cls), `"${u.cls}" → "${rd.cls}"`);
    await page.click("#ee-cancel").catch(() => {}); page._answer = true; await page.waitForTimeout(100);
    await ctx.close();
  }
  // One change → one-line diff (class only), both copies identical.
  {
    const mock = newMock(); const ctx = await ctxFor(browser, mock, vp); const page = await ctx.newPage(); const W = watch(page);
    const file = "articles/aghor/index.html", orig = fs.readFileSync(path.join(ROOT, file), "utf8");
    await openEdit(page, "articles/aghor/");
    await caretIn(page, LORE, 0.4); await page.waitForTimeout(100);
    await setAl(page, "right");
    await page.click("#ee-save"); await page.waitForTimeout(1500);
    const saved = String(mock.file(file)), n = diffLines(orig, saved, vpName + "-align");
    const want = orig.replace('<p class="art-life">Rogue Ancient', '<p class="art-life ee-al-right">Rogue Ancient');
    check(`[${vpName}] one alignment change saves as a one-line, class-only diff (both copies)`, saved === want && n <= 2 && String(mock.file("articles/aghor.html")) === saved, `diff lines ${n}`);
    check(`[${vpName}] alignment save: no page errors`, W.errs.length === 0, W.errs.join(" | "));
    await ctx.close();
  }
  // Enter carries it; several paragraphs at once; partial selection = whole block; headings;
  // keyboard; Left = default; paste maps text-align.
  {
    const mock = newMock(); const ctx = await ctxFor(browser, mock, vp); const page = await ctx.newPage(); const W = watch(page);
    await openEdit(page, "articles/aghor/");
    await caretIn(page, LORE, 1.0); await page.waitForTimeout(100);
    await setAl(page, "center");
    await page.keyboard.press("Enter"); await page.keyboard.type("Second Za");
    const e = await blockAt(page);
    check(`[${vpName}] Enter on a centred paragraph: new p.art-life stays centred`, e.text === "Second Za" && /\bart-life\b/.test(e.cls) && /\bee-al-center\b/.test(e.cls) && e.ta === "center", JSON.stringify(e));
    await page.evaluate(() => { const ps = [...document.querySelectorAll("#lore p")]; const a = ps[0].firstChild, b = ps[1].firstChild; const r = document.createRange(); r.setStart(a, 5); r.setEnd(b, 3); ps[0].closest(".ee-editable").focus(); getSelection().removeAllRanges(); getSelection().addRange(r); });
    await page.waitForTimeout(100);
    await setAl(page, "right");
    const two = await page.evaluate(() => [...document.querySelectorAll("#lore p")].map((p) => p.getAttribute("class") + "/" + getComputedStyle(p).textAlign + "/" + p.querySelectorAll("[class*=ee-al-]").length));
    check(`[${vpName}] selection across two paragraphs: both aligned right, no spans`, two.length === 2 && two.every((x) => /ee-al-right\/right\/0$/.test(x) && !/ee-al-center/.test(x)), two.join(" | "));
    await caretIn(page, "#lore p", 0.2, 0.5); await page.waitForTimeout(100);
    await setAl(page, "center");
    const part = await blockAt(page);
    check(`[${vpName}] partial selection: alignment goes on the whole block, never an inline span`, /ee-al-center/.test(part.cls) && part.spans === 0, JSON.stringify(part).slice(0, 120));
    await pick(page, "#ee-block", "h2");
    const h = await blockAt(page);
    check(`[${vpName}] Block → Heading keeps the alignment (h2.ee-al-center)`, h.tag === "H2" && /ee-al-center/.test(h.cls) && h.ta === "center", JSON.stringify(h).slice(0, 120));
    await pick(page, "#ee-block", "p");
    await page.keyboard.press("Control+Shift+R"); await page.waitForTimeout(120);
    const kr = await blockAt(page);
    await page.keyboard.press("Control+Shift+L"); await page.waitForTimeout(120);
    const kl = await blockAt(page);
    await page.keyboard.press("Control+Shift+E"); await page.waitForTimeout(120);
    const ke = await blockAt(page);
    check(`[${vpName}] Ctrl+Shift+R / L / E: right, left (class removed = default), center`, /ee-al-right/.test(kr.cls) && kr.ta === "right" && !/ee-al-/.test(kl.cls) && kl.ta !== "center" && kl.ta !== "right" && /\bart-life\b/.test(kl.cls) && /ee-al-center/.test(ke.cls), `${kr.cls} | ${kl.cls} | ${ke.cls}`);
    await caretIn(page, "#lore p", 1.0);
    await pasteInto(page, { html: '<p>Lead Zl</p><p style="text-align:center;font-family:Arial">Pasted centre Zc</p><p align="right">Pasted right Zr</p><p>Pasted plain Zp</p>', text: "x" });
    const pa = await page.evaluate(() => ["Pasted centre Zc", "Pasted right Zr", "Pasted plain Zp"].map((t) => { const p = [...document.querySelectorAll("main p")].find((x) => x.textContent === t); return p ? (p.getAttribute("class") || "") + (p.hasAttribute("style") ? " STYLE" : "") : "missing"; }));
    check(`[${vpName}] paste: text-align / align= become ee-al-* classes (no inline styles)`, /ee-al-center/.test(pa[0]) && /ee-al-right/.test(pa[1]) && /art-life/.test(pa[2]) && !/ee-al-/.test(pa[2]) && pa.every((x) => !/STYLE|missing/.test(x)), pa.join(" | "));
    check(`[${vpName}] alignment: no page errors`, W.errs.length === 0, W.errs.join(" | "));
    if (vpName === "desktop") { await caretIn(page, "#lore p", 0.3); await page.waitForTimeout(150); }
    await page.screenshot({ path: path.join(OUT, `align-${vpName}.png`) });
    await ctx.close();
  }
  // Journal and lore pages: the classes win over the page's paragraph rules.
  for (const [url, sel] of [["journal/", "main.read > p"], ["codex/lore/", "main.read blockquote p, main.read p"]]) {
    const mock = newMock(); const ctx = await ctxFor(browser, mock, vp); const page = await ctx.newPage(); watch(page);
    await openEdit(page, url);
    await caretIn(page, sel, 0.3); await page.waitForTimeout(100);
    await setAl(page, "right"); const r1 = await blockAt(page);
    await setAl(page, "center"); const r2 = await blockAt(page);
    check(`[${vpName}] ${url}: right then center apply (classes beat the page's rules)`, r1.ta === "right" && r2.ta === "center" && /ee-al-center/.test(r2.cls) && !/ee-al-right/.test(r2.cls), `${r1.ta}/${r2.ta} "${r2.cls}"`);
    await ctx.close();
  }
}

// Instant reload after a save (edit/recent.js): the test server keeps serving the old files (like
// the ~30 s before Cloudflare finishes), so a reload must show the saved copy, editing again must
// build on it (never re-save the old text), and nobody else in this browser ever sees it.
async function recentTests(browser, vpName) {
  if (vpName !== "desktop") return;
  const vp = VPS[vpName];
  const status = (page) => page.evaluate(() => window.EloraeRecent && window.EloraeRecent.ready.then(() => JSON.stringify(window.EloraeRecent.status)));
  async function reloadReady(page) {
    await page.reload({ waitUntil: "load" });
    await page.waitForFunction(() => window.EloraeEditor && window.EloraeEditor.state.profile && window.EloraeRecent, null, { timeout: 15000 });
    return status(page);
  }
  const CASES = [
    ["articles/aghor/", "articles/aghor/index.html", "main.art-body p.art-life", "main.art-body"],
    ["journal/ghostly-wanderer/my-tale/", "journal/ghostly-wanderer/my-tale/index.html", "main.read > p", "main.read"],
    ["atlas/", "atlas/index.html", "main p", "main"]
  ];
  for (const [url, file, sel, mainSel] of CASES) {
    if (!fs.existsSync(path.join(ROOT, file))) continue;
    const mock = newMock(); const ctx = await ctxFor(browser, mock, vp); const page = await ctx.newPage(); const W = watch(page);
    const orig = fs.readFileSync(path.join(ROOT, file), "utf8");
    await openEdit(page, url); await page.waitForTimeout(400);
    await caretIn(page, sel, 1.0); await page.keyboard.type(" Zq");
    await page.click("#ee-save");
    await page.waitForFunction(() => /Saved at/.test((document.getElementById("ee-bar") || {}).textContent || ""), null, { timeout: 15000 }).catch(() => {});
    const st = await reloadReady(page);
    const shown = await page.evaluate((m) => (document.querySelector(m) || {}).textContent.includes(" Zq"), mainSel);
    const hidden = await page.evaluate(() => document.documentElement.classList.contains("ee-recent-wait"));
    check(`[${vpName}] ${url}: reload before the site rebuilds shows the saved edit`, shown && !hidden && /"shown"/.test(st), st);
    // Edit again on the reloaded page: the new save keeps the first edit (old text never re-saved).
    await page.evaluate(() => window.EloraeEditor.tryEnterEdit());
    await page.waitForSelector("#ee-save", { timeout: 15000 }); await page.waitForTimeout(250);
    await caretIn(page, sel, 1.0); await page.keyboard.type(" Wv");
    await page.click("#ee-save");
    await page.waitForFunction(() => /Saved at|refused|failed|changed this part/i.test((document.getElementById("ee-bar") || {}).textContent || ""), null, { timeout: 15000 }).catch(() => {});
    const saved = String(mock.file(file)), n = diffLines(orig, saved, vpName + "-recent-" + file.replace(/\W+/g, "_"));
    check(`[${vpName}] ${url}: editing after the reload builds on the saved copy (both edits, small diff)`, saved.includes(" Zq") && saved.includes(" Wv") && n <= 2 && saved.length - orig.length === 6, `diff lines ${n}, +${saved.length - orig.length} bytes`);
    const st2 = await reloadReady(page);
    const both = await page.evaluate((m) => { const t = document.querySelector(m).textContent; return t.includes(" Zq") && t.includes(" Wv"); }, mainSel);
    check(`[${vpName}] ${url}: second reload shows both saves`, both && /"shown"/.test(st2), st2);
    if (url === "articles/aghor/") {
      // The site catches up: the served page now matches → the kept copy is dropped.
      await ctx.route((u) => u.href === BASE + url, (r) => r.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: saved }));
      const st3 = await reloadReady(page);
      const kept = await page.evaluate(() => localStorage.getItem("elorae-edit-recent"));
      check(`[${vpName}] once the site serves the saved page, the kept copy is dropped`, /"live"/.test(st3) && !kept && await page.evaluate(() => document.querySelector("main.art-body").textContent.includes(" Wv")), st3);
      await ctx.unroute((u) => u.href === BASE + url);
    }
    if (url === "journal/ghostly-wanderer/my-tale/") {
      // Another player signs in on this browser: the private copy is never shown, and is cleared.
      await ctx.addInitScript(`try{localStorage.setItem("elorae-login","jason");document.cookie="elorae-login=jason;path=/";}catch(e){}`);
      await page.reload({ waitUntil: "load" }); await page.waitForTimeout(1200);
      const r = await page.evaluate(() => ({ zq: (document.querySelector("main.read") || document.body).textContent.includes(" Zq"), kept: localStorage.getItem("elorae-edit-recent") }));
      check(`[${vpName}] a different signed-in player never sees the saved copy (and it is cleared)`, !r.zq && !r.kept, JSON.stringify({ zq: r.zq, kept: !!r.kept }));
    }
    check(`[${vpName}] ${url}: recent: no page errors`, W.errs.length === 0, W.errs.join(" | "));
    await ctx.close();
  }
  // Hero name + epithet (outside main) and both copies.
  {
    const mock = newMock(); const ctx = await ctxFor(browser, mock, vp); const page = await ctx.newPage(); const W = watch(page);
    await openEdit(page, "articles/vaerek/");
    await caretIn(page, ".art-title h1", 1.0); await page.keyboard.type(" Zq");
    await caretIn(page, ".art-title .art-epithet", 1.0); await page.keyboard.type(" of Zq");
    await page.click("#ee-save"); await page.waitForTimeout(1500);
    const st = await reloadReady(page);
    const t = await page.evaluate(() => ({ h1: document.querySelector(".art-title h1").textContent, ep: document.querySelector(".art-title .art-epithet").textContent }));
    check(`[${vpName}] name/epithet: reload shows the saved name and epithet`, t.h1 === "Vaerek Rathkin Zq" && t.ep === "Wreathbound Ranger of Zq" && /"shown"/.test(st), JSON.stringify(t) + " " + st);
    await page.goto(BASE + "articles/vaerek.html", { waitUntil: "load" });
    await page.waitForFunction(() => window.EloraeRecent, null, { timeout: 15000 });
    const st2 = await status(page);
    const h1b = await page.evaluate(() => document.querySelector(".art-title h1").textContent);
    check(`[${vpName}] name/epithet: the .html copy shows it too`, h1b === "Vaerek Rathkin Zq", h1b + " " + st2);
    check(`[${vpName}] name/epithet recent: no page errors`, W.errs.length === 0, W.errs.join(" | "));
    await ctx.close();
  }
  // Index organizer: heading rename survives a reload.
  {
    const mock = newMock(); const ctx = await ctxFor(browser, mock, vp); const page = await ctx.newPage(); const W = watch(page);
    await page.goto(BASE + "index/ancients/", { waitUntil: "load" });
    await page.waitForFunction(() => window.EloraeEditor && window.EloraeEditor.state.profile, null, { timeout: 15000 });
    await page.evaluate(() => window.EloraeEditor.tryEnterEdit()); await page.waitForSelector("#ee-idx-save"); await page.waitForTimeout(400);
    await page.evaluate(() => { const h = document.querySelector("#divines > h2"); h.focus(); h.textContent = "Divines Zq"; h.blur(); });
    await page.waitForTimeout(200); await page.click("#ee-idx-save"); await page.waitForTimeout(1500);
    const st = await reloadReady(page);
    const h = await page.evaluate(() => document.querySelector("#divines > h2").textContent);
    check(`[${vpName}] index organizer: reload shows the saved heading`, h === "Divines Zq" && /"shown"/.test(st), h + " " + st);
    check(`[${vpName}] index recent: no page errors`, W.errs.length === 0, W.errs.join(" | "));
    await ctx.close();
  }
  // Signing out of edit mode forgets the kept copies.
  {
    const mock = newMock(); const ctx = await ctxFor(browser, mock, vp); const page = await ctx.newPage(); watch(page);
    await openEdit(page, "articles/aghor/");
    await caretIn(page, "main.art-body p.art-life", 1.0); await page.keyboard.type(" Zq");
    await page.click("#ee-save"); await page.waitForTimeout(1200);
    const before = await page.evaluate(() => !!localStorage.getItem("elorae-edit-recent"));
    await page.evaluate(() => window.EloraeEdit.session.clear());
    const after = await page.evaluate(() => localStorage.getItem("elorae-edit-recent"));
    check(`[${vpName}] signing out of edit mode clears the kept copies`, before && !after);
    await ctx.close();
  }
}

// Index: add a card, drag cards around many times (within and across sections), give cards art
// by uploading (big PNGs are resized), replace art, pick from the gallery, save, reload, edit
// again, and give an article hero art from the article. Both Index copies must stay identical.
const zlib = require("zlib");
function makePng(w, h, seed) {
  // Stored (uncompressed) RGB PNG with noise over a gradient: big on disk, like exported art.
  let x = seed >>> 0 || 1; const rnd = () => (x = (x * 1664525 + 1013904223) >>> 0) >>> 24;
  const row = 1 + w * 3, raw = Buffer.alloc(row * h);
  for (let y = 0; y < h; y++) { raw[y * row] = 0; for (let i = 0; i < w; i++) { const o = y * row + 1 + i * 3; raw[o] = (i * 255 / w + rnd() / 3) & 255; raw[o + 1] = (y * 255 / h + rnd() / 3) & 255; raw[o + 2] = rnd(); } }
  const crc = (b) => { let c, t = []; for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } c = 0xffffffff; for (const v of b) c = t[(c ^ v) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => { const l = Buffer.alloc(4); l.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw, { level: 0 })), chunk("IEND", Buffer.alloc(0))]);
}
function webpSize(buf) {
  const b = Buffer.from(buf);
  if (b.toString("ascii", 0, 4) !== "RIFF" || b.toString("ascii", 8, 12) !== "WEBP") return null;
  const t = b.toString("ascii", 12, 16);
  if (t === "VP8X") return { w: 1 + b.readUIntLE(24, 3), h: 1 + b.readUIntLE(27, 3) };
  if (t === "VP8 ") return { w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff };
  if (t === "VP8L") { const v = b.readUInt32LE(21); return { w: (v & 0x3fff) + 1, h: ((v >> 14) & 0x3fff) + 1 }; }
  return null;
}
async function indexArtTests(browser, vpName) {
  const vp = VPS[vpName];
  const DIR = path.join(OUT, "art"); fs.mkdirSync(DIR, { recursive: true });
  const BIG = path.join(DIR, "big-art.png"), BIG2 = path.join(DIR, "wide-art.png"), SMALL = path.join(DIR, "small-art.png");
  if (!fs.existsSync(BIG)) { fs.writeFileSync(BIG, makePng(1800, 1700, 7)); fs.writeFileSync(BIG2, makePng(3000, 1000, 9)); fs.writeFileSync(SMALL, makePng(600, 400, 3)); }
  const IDX = "index/ancients/index.html", IDX2 = "index/ancients.html";
  const mock = newMock(); const ctx = await ctxFor(browser, mock, vp); const page = await ctx.newPage(); const W = watch(page);
  const T = (p) => { const v = mock.file(p); return v == null ? null : String(v); };
  async function startOrg() {
    await page.waitForFunction(() => window.EloraeEditor && window.EloraeEditor.state.profile && window.EloraeIndexOrg, null, { timeout: 15000 });
    await page.evaluate(() => window.EloraeEditor.tryEnterEdit()); await page.waitForSelector("#ee-idx-save", { timeout: 15000 }); await page.waitForTimeout(300);
  }
  const domState = () => page.evaluate(() => {
    const secs = {};
    document.querySelectorAll("main.index-flow .index-cards").forEach((b, i) => {
      const sec = b.closest("section.index-cat"), sub = b.previousElementSibling && b.previousElementSibling.classList.contains("index-sub") ? b.previousElementSibling.id : "";
      secs[(sec && sec.id) + (sub ? "/" + sub : "") + "#" + i] = [...b.querySelectorAll(":scope > a.index-card")].map((a) => a.getAttribute("href"));
    });
    const all = [...document.querySelectorAll("main.index-flow a.index-card")].map((a) => a.getAttribute("href"));
    return { secs, all, stuck: document.querySelectorAll(".ee-index-dragging,.ee-index-dragover,.ee-index-before,.ee-index-after").length, url: location.href };
  });
  const savedState = (text) => page.evaluate((t) => {
    const d = new DOMParser().parseFromString(t, "text/html"), secs = {};
    d.querySelectorAll("main.index-flow .index-cards").forEach((b, i) => {
      const sec = b.closest("section.index-cat"), sub = b.previousElementSibling && b.previousElementSibling.classList.contains("index-sub") ? b.previousElementSibling.id : "";
      secs[(sec && sec.id) + (sub ? "/" + sub : "") + "#" + i] = [...b.querySelectorAll(":scope > a.index-card")].map((a) => a.getAttribute("href"));
    });
    return { secs, all: [...d.querySelectorAll("main.index-flow a.index-card")].map((a) => a.getAttribute("href")) };
  }, text);
  // Real mouse drag when both cards fit on screen; otherwise the same drag events dispatched
  // directly (a held drag scrolls the page near the edges; the test checks that separately).
  async function drag(srcHref, dstHref, side) {
    const far = await page.evaluate(([a, b]) => {
      const r1 = document.querySelector(`main.index-flow a.index-card[href="${a}"]`).getBoundingClientRect();
      const r2 = document.querySelector(`main.index-flow a.index-card[href="${b}"]`).getBoundingClientRect();
      if (Math.max(r1.bottom, r2.bottom) - Math.min(r1.top, r2.top) > innerHeight - 220) return true;
      // Both must fit on screen at once (Playwright would scroll between press and release).
      window.scrollBy(0, (Math.min(r1.top, r2.top) + Math.max(r1.bottom, r2.bottom)) / 2 - innerHeight / 2);
      const a1 = document.querySelector(`main.index-flow a.index-card[href="${a}"]`).getBoundingClientRect(), a2 = document.querySelector(`main.index-flow a.index-card[href="${b}"]`).getBoundingClientRect();
      return [a1, a2].some((r) => r.top < 120 || r.bottom > innerHeight - 110);
    }, [srcHref, dstHref]);
    if (far) {
      await page.evaluate(([a, b, side]) => {
        const src = document.querySelector(`main.index-flow a.index-card[href="${a}"]`), dst = document.querySelector(`main.index-flow a.index-card[href="${b}"]`);
        const dt = new DataTransfer();
        src.dispatchEvent(new DragEvent("dragstart", { bubbles: true, cancelable: true, dataTransfer: dt }));
        dst.scrollIntoView({ block: "center" });
        const r = dst.getBoundingClientRect(), x = side === "after" ? r.left + r.width * 0.85 : r.left + r.width * 0.15, y = r.top + r.height * (side === "after" ? 0.75 : 0.25);
        const t = document.elementFromPoint(x, y) || dst;
        t.dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer: dt, clientX: x, clientY: y }));
        t.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: dt, clientX: x, clientY: y }));
        src.dispatchEvent(new DragEvent("dragend", { bubbles: true, dataTransfer: dt }));
      }, [srcHref, dstHref, side]);
      await page.waitForTimeout(60);
      return;
    }
    const src = await page.$(`main.index-flow a.index-card[href="${srcHref}"]`);
    const dst = await page.$(`main.index-flow a.index-card[href="${dstHref}"]`);
    const bb = await dst.boundingBox();
    const tp = { x: side === "after" ? bb.width * 0.85 : bb.width * 0.15, y: bb.height * (side === "after" ? 0.75 : 0.25) };
    await page.dragAndDrop(`main.index-flow a.index-card[href="${srcHref}"]`, `main.index-flow a.index-card[href="${dstHref}"]`, { targetPosition: tp, force: true });
    await page.waitForTimeout(80);
  }
  // Some characters are listed in two sections on purpose, so "every card once" means: the same
  // cards as at the start (plus the new one), nothing lost, nothing doubled.
  let baseCards = null;
  const bag = (a) => JSON.stringify([...a].sort());
  const uniq = (a) => bag(a) === baseCards;
  const sameOrder = (a, b) => JSON.stringify(Object.values(a)) === JSON.stringify(Object.values(b));
  const ART = /draggable|contenteditable|ee-index|data-ee-|data-eimg|blob:|is-lore-flipped|aria-expanded="false" href/;

  await page.goto(BASE + "index/ancients/", { waitUntil: "load" });
  await startOrg();
  const s0 = await domState();
  baseCards = bag(s0.all.concat("/articles/zq-test-card/"));
  // 1. Add a card in Locations (select a Locations card first).
  await page.evaluate(() => document.querySelector("#locations a.index-card, #locations ~ .index-cards a.index-card").click());
  page._answer = "Zq Test Card";
  await page.click("#ee-idx-add");
  await page.waitForSelector("#ee-tpl-pick [data-tpl]", { timeout: 5000 });
  const pickItems = await page.evaluate(() => [...document.querySelectorAll("#ee-tpl-pick [data-tpl]")].map((b) => b.textContent).join("|"));
  await page.click('#ee-tpl-pick [data-tpl="people"]');
  await page.waitForFunction(() => /Added|failed|exists/i.test((document.getElementById("ee-bar") || {}).textContent || ""), null, { timeout: 20000 });
  const bar1 = (await page.textContent("#ee-bar")).trim();
  const A1 = T("articles/zq-test-card/index.html"), A2 = T("articles/zq-test-card.html");
  const i1 = T(IDX);
  check(`[${vpName}] index: Add card → card + both article copies in one commit, message "Added … Saved at"`, /Added “Zq Test Card”\. Saved at \d/.test(bar1) && A1 && A1 === A2 && i1 && i1 === T(IDX2) && (i1.match(/href="\/articles\/zq-test-card\/"/g) || []).length === 1, bar1.slice(0, 80));
  check(`[${vpName}] index: new article is a current article page (name, empty hero, Lore, current scripts)`, A1 && /<title>Zq Test Card - Elorae<\/title>/.test(A1) && /<section class="art-hero no-art"><div class="art-title"><h1>Zq Test Card<\/h1>/.test(A1) && /<p class="art-life"><\/p>/.test(A1) && !/Aghor, Ancient|og:image/.test(A1) && /edit\/edit\.js\?v=/.test(A1) && /art-back" href="\/index\/ancients\/#locations"/.test(A1) && !/\.\.\//.test(A1), A1 ? A1.length + " bytes" : "missing");
  check(`[${vpName}] index: Add card asks for a template; People gives the new article a Dossier with Name + the People fields, empty`, pickItems === "None|Faction|Location (City)|Location (Region)|People|Conflict|Item|Race" && A1 && A1.includes('<section class="art-sec" id="dossier"><h2>Dossier</h2><dl class="art-dossier tpl-people"><dt>Name</dt><dd>Zq Test Card</dd><dt>Homeland</dt><dd></dd><dt>Age</dt><dd></dd><dt>Race</dt><dd></dd><dt>Titles</dt><dd></dd><dt>Relatives</dt><dd></dd><dt>Affiliation</dt><dd></dd></dl></section>\n<section class="art-sec" id="lore">'), pickItems);
  const cardSec = await page.evaluate(() => { const a = document.querySelector('a.index-card[href="/articles/zq-test-card/"]'); return a && a.closest("section.index-cat").id; });
  check(`[${vpName}] index: the new card sits in the section that was selected`, cardSec === "locations", cardSec);
  // 2. Many drags: reorder, across sections, onto itself, back and forth.
  const NEW = "/articles/zq-test-card/";
  const firstIn = (sel) => page.evaluate((s) => { const a = document.querySelector(s); return a && a.getAttribute("href"); }, sel);
  const lastIn = (sel) => page.evaluate((s) => { const a = [...document.querySelectorAll(s)].pop(); return a && a.getAttribute("href"); }, sel);
  // ia1: order inside a section is automatic (A to Z, leading "The" ignored); drags only move between sections.
  const azIn = (sel) => page.evaluate((s) => { const k = (t) => t.replace(/\s+/g, " ").trim().replace(/^the\s+/i, ""); const n = [...document.querySelectorAll(s)].map((a) => k(a.querySelector("span").textContent)); return n.every((x, i) => !i || n[i - 1].localeCompare(x, "en", { sensitivity: "base", numeric: true }) <= 0); }, sel);
  const locOrder = await page.evaluate(() => [...document.querySelectorAll("#locations a.index-card")].map((a) => a.getAttribute("href")).join(","));
  const locFirst = await firstIn("#locations a.index-card");
  await drag(NEW, locFirst, "before");
  const d1 = await domState();
  const locOrder2 = await page.evaluate(() => [...document.querySelectorAll("#locations a.index-card")].map((a) => a.getAttribute("href")).join(","));
  check(`[${vpName}] drag: within a section does not reorder (A to Z kept) and says why`, locOrder2 === locOrder && await azIn("#locations a.index-card") && d1.stuck === 0 , d1.stuck + " marks " + (await page.textContent("#ee-bar")).slice(0, 80));
  const hint = await page.evaluate(() => getComputedStyle(document.getElementById("ee-bar"), "::before").content);
  check(`[${vpName}] organizer: no standing instruction note over the bar`, !/sort A.Z/.test(hint), hint);
  const divA = await firstIn("#demonic a.index-card");
  await drag(NEW, divA, "before");
  const afterDiv = await page.evaluate((n) => { const a = document.querySelector(`a.index-card[href="${n}"]`); return { sec: a.closest("section.index-cat").id, id: a.id, last: [...a.parentElement.querySelectorAll("a.index-card")].pop() === a }; }, NEW);
  check(`[${vpName}] drag: move to another section lands in its A to Z place (Zq… last), id follows the section`, afterDiv.sec === "demonic" && afterDiv.last && afterDiv.id === "demonic-zq-test-card" && await azIn("#demonic a.index-card"), JSON.stringify(afterDiv));
  const before = await domState();
  await drag(NEW, NEW, "after");
  const self = await domState();
  check(`[${vpName}] drag: dropping a card on itself changes nothing`, sameOrder(before.secs, self.secs));
  const AG = "/articles/aghor/";
  const locLast = await lastIn("#locations a.index-card");
  await drag(AG, locLast, "after");
  check(`[${vpName}] drag: Aghor into Locations goes to its A to Z place (first), not where it was dropped`, (await firstIn("#locations a.index-card")) === AG && await azIn("#locations a.index-card"));
  const ancLast = await lastIn("#ancients a.index-card");
  await drag(AG, ancLast, "after");
  check(`[${vpName}] drag: and back into Ancients, again A to Z (first)`, (await firstIn("#ancients a.index-card")) === AG && await azIn("#ancients a.index-card"));
  for (let k = 0; k < 6; k++) {
    const st = await domState();
    const hrefs = st.all.filter((h) => h !== NEW);
    const a = hrefs[(k * 7 + 3) % hrefs.length], b = hrefs[(k * 11 + 17) % hrefs.length];
    if (a !== b) await drag(a, b, k % 2 ? "after" : "before");
  }
  // Holding a dragged card near the bottom edge scrolls the page (to reach far sections).
  const scrolled = await page.evaluate(async () => {
    window.scrollTo(0, 0);
    const src = document.querySelector("main.index-flow a.index-card"), dt = new DataTransfer();
    src.dispatchEvent(new DragEvent("dragstart", { bubbles: true, cancelable: true, dataTransfer: dt }));
    const y0 = scrollY;
    for (let i = 0; i < 20; i++) { document.elementFromPoint(innerWidth / 2, innerHeight - 10).dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer: dt, clientX: innerWidth / 2, clientY: innerHeight - 10 })); await new Promise((r) => setTimeout(r, 25)); }
    const y1 = scrollY;
    src.dispatchEvent(new DragEvent("dragend", { bubbles: true, dataTransfer: dt }));
    await new Promise((r) => setTimeout(r, 60));
    const y2 = scrollY; await new Promise((r) => setTimeout(r, 100));
    return { y0, y1, stopped: scrollY === y2 };
  });
  check(`[${vpName}] drag: holding a card near the bottom edge scrolls the page, and stops on release`, scrolled.y1 > scrolled.y0 + 100 && scrolled.stopped, JSON.stringify(scrolled));
  const s2 = await domState();
  check(`[${vpName}] drag: after ${10} moves every card is still there exactly once, no stuck drag marks, no navigation`, s2.all.length === s0.all.length + 1 && uniq(s2.all) && s2.stuck === 0 && s2.url === s0.url, `${s0.all.length}→${s2.all.length} cards, ${s2.stuck} marks, uniq ${uniq(s2.all)} dups ${s2.all.filter((h, i) => s2.all.indexOf(h) !== i)}, url ${s2.url}`);
  // Hover reveal (epi1) is off in the organizer: hovering a card with an epithet leaves its title in place.
  const epCard = 'main.index-flow a.index-card[data-epithet]:not([data-epithet=""])';
  await page.hover(epCard); await page.waitForTimeout(400);
  const hover = await page.evaluate((sel) => { const sp = document.querySelector(sel + " > span"); const t = getComputedStyle(sp).transform; return !document.documentElement.classList.contains("ee-index-org") || (t !== "none" && !/^matrix\(1, 0, 0, 1, 0, 0\)$/.test(t)); }, epCard);
  await page.mouse.move(2, 2);
  await page.click(`main.index-flow a.index-card[href="${AG}"]`);
  await page.waitForTimeout(300);
  check(`[${vpName}] edit mode: no hover preview, clicking a card selects it (no navigation)`, !hover && page.url() === s0.url && await page.evaluate((h) => document.querySelector(`a.index-card[href="${h}"]`).classList.contains("ee-index-selected"), AG));
  await page.click("#ee-idx-save");
  await page.waitForFunction(() => /Saved at|failed/i.test((document.getElementById("ee-bar") || {}).textContent || ""), null, { timeout: 20000 });
  const i2 = T(IDX), sv = await savedState(i2);
  check(`[${vpName}] save after drags: order saved exactly as on screen, every card once, both copies identical, no runtime artifacts`, sameOrder(sv.secs, s2.secs) && uniq(sv.all) && i2 === T(IDX2) && !ART.test(i2.replace(/<script[\s\S]*?<\/script>/g, "")), (i2.match(ART) || [""])[0] + " same " + sameOrder(sv.secs, s2.secs) + " uniq " + uniq(sv.all) + " copies " + (i2 === T(IDX2)));
  // 3. Art: upload a big PNG on the new card, replace Aghor's art with a wide one, gallery pick for a third.
  async function artFile(href, file) {
    await page.click(`main.index-flow a.index-card[href="${href}"]`);
    await page.click("#ee-idx-art");
    await page.waitForSelector("#ee-pick-file", { timeout: 10000 });
    await page.setInputFiles("#ee-pick-file", file);
    await page.waitForFunction(() => /ready|could not|over 5 MB/i.test((document.getElementById("ee-bar") || {}).textContent || ""), null, { timeout: 30000 });
    return (await page.textContent("#ee-bar")).trim();
  }
  const b1 = await artFile(NEW, BIG);
  const b2 = await artFile(AG, BIG2);
  const third = await page.evaluate(() => [...document.querySelectorAll("main.index-flow a.index-card")].map((a) => a.getAttribute("href")).filter((h) => h !== "/articles/aghor/" && h !== "/articles/zq-test-card/")[2]);
  await page.click(`main.index-flow a.index-card[href="${third}"]`);
  await page.click("#ee-idx-art");
  await page.waitForSelector("#ee-pick-wrap .ee-gal-item", { timeout: 10000 });
  const pickPath = await page.evaluate(() => { const b = document.querySelector("#ee-pick-wrap .ee-gal-item"); const id = b.getAttribute("data-pick-id"); b.click(); return id; });
  await page.waitForTimeout(200);
  const prev = await page.evaluate((hs) => hs.map((h) => { const a = document.querySelector(`a.index-card[href="${h}"]`); const im = a.querySelector("img"); return { noArt: a.classList.contains("no-art"), src: im && im.getAttribute("src"), ok: im && im.complete && im.naturalWidth > 0 }; }), [NEW, AG, third]);
  check(`[${vpName}] art: uploads show on their cards at once (from memory), big files resized`, /resized to 2400×\d+|ready \(\d+ KB/.test(b1) && /resized to 2400×800/.test(b2) && prev[0].src.startsWith("blob:") && !prev[0].noArt && prev[0].ok && prev[1].src.startsWith("blob:") && prev[1].ok, b1 + " | " + b2);
  const cardEl = await page.$(`main.index-flow a.index-card[href="${NEW}"]`);
  await cardEl.scrollIntoViewIfNeeded(); await page.click(`main.index-flow a.index-card[href="${NEW}"]`); await page.waitForTimeout(200);
  if (vpName === "desktop") { fs.mkdirSync("/workspace/shots", { recursive: true }); await page.screenshot({ path: "/workspace/shots/index-card-art-test.png" }); }
  await page.click("#ee-idx-save");
  await page.waitForFunction(() => /Saved at|failed/i.test((document.getElementById("ee-bar") || {}).textContent || ""), null, { timeout: 30000 });
  const i3 = T(IDX), cat = JSON.parse(T("edit/media/catalog.json"));
  const entries = Object.values(cat.media).filter((m) => /zq-test-card|aghor\.webp/i.test(m.path));
  const newImg = entries.map((m) => m.path).find((p) => /zq-test-card/.test(p)), agImg = entries.map((m) => m.path).find((p) => /^assets\/aghor/.test(p));
  const nb = newImg && mock.file(newImg), ab = agImg && mock.file(agImg);
  const ns = nb && webpSize(nb), as = ab && webpSize(ab);
  check(`[${vpName}] art save: images committed resized as WebP (≤2400 px, well under 5 MB)`, ns && as && Math.max(ns.w, ns.h) <= 2400 && as.w === 2400 && as.h === 800 && nb.length < 5e6 && ab.length < 5e6, `${newImg} ${ns && ns.w + "x" + ns.h} ${nb && Math.round(nb.length / 1024)}KB; ${agImg} ${as && as.w + "x" + as.h} ${ab && Math.round(ab.length / 1024)}KB (picked 9 MB PNGs)`);
  const cardHtml = (t, h) => { const m = new RegExp('<a class="index-card[^"]*"[^>]*href="' + h.replace(/\//g, "\\/") + '"[^>]*>[\\s\\S]*?<\\/a>').exec(t); return m && m[0]; };
  const c1 = cardHtml(i3, NEW), c2 = cardHtml(i3, AG), c3 = cardHtml(i3, third);
  const pickEntry = cat.media[pickPath];
  check(`[${vpName}] art save: cards get site-style art markup (Cloudflare srcset), no-art dropped; replaced and gallery art too`, c1 && !/no-art/.test(c1) && c1.includes("/cdn-cgi/image/width=640,") && c1.includes(newImg) && c2 && c2.includes(agImg) && !c2.includes("Aghor.png") && c3 && pickEntry && c3.includes(encodeURI(pickEntry.path).replace(/%20/g, "%20")) || false, [c1, c2].map((x) => x && x.slice(0, 120)).join(" | "));
  check(`[${vpName}] art save: both Index copies identical, every card once, no blob:/runtime artifacts`, i3 === T(IDX2) && uniq((await savedState(i3)).all) && !ART.test(i3.replace(/<script[\s\S]*?<\/script>/g, "")), (i3.match(ART) || [""])[0]);
  const h1 = T("articles/zq-test-card/index.html"), h2 = T("articles/zq-test-card.html"), g1 = T("articles/aghor/index.html"), g2 = T("articles/aghor.html");
  check(`[${vpName}] art save: the articles' hero art follows (both copies)`, h1 === h2 && /<section class="art-hero"><img src="\/assets\/zq-test-card[^"]*" alt="Zq Test Card">/.test(h1) && g1 && g1.includes('<img src="/' + agImg + '" alt="Aghor"') && g1 === g2, (h1 || "").match(/<section class="art-hero[^>]*>.{0,80}/) + "");
  const after = await page.evaluate((h) => { const im = document.querySelector(`a.index-card[href="${h}"] img`); return { src: im.getAttribute("src"), orig: im.getAttribute("data-eimg-orig"), ok: im.naturalWidth > 0 }; }, NEW);
  check(`[${vpName}] after save the new art keeps showing (from memory until the site has it)`, after.src.startsWith("blob:") && after.orig === "/" + newImg && after.ok, JSON.stringify(after));
  // 4. Reload before the site rebuilds: order + art come from the kept copy (art from this browser).
  await page.reload({ waitUntil: "load" });
  await page.waitForFunction(() => window.EloraeRecent, null, { timeout: 15000 });
  const rst = await page.evaluate(() => window.EloraeRecent.ready.then(() => JSON.stringify(window.EloraeRecent.status)));
  await page.waitForTimeout(400);
  const r1 = await domState();
  const rimg = await page.evaluate((h) => { const im = document.querySelector(`a.index-card[href="${h}"] img`); return im && { src: im.getAttribute("src"), ok: im.complete && im.naturalWidth > 0 }; }, NEW);
  check(`[${vpName}] reload: saved order and new art show before the site rebuilds`, /"shown"/.test(rst) && sameOrder(r1.secs, (await savedState(i3)).secs) && rimg && rimg.src.startsWith("blob:") && rimg.ok, rst + " " + JSON.stringify(rimg));
  // 5. Organize again after the reload: one more move, save; art markup kept, nothing doubled.
  await startOrg();
  const st5 = await domState();
  await drag(NEW, st5.all.filter((h) => h !== NEW)[0], "before");
  await page.click("#ee-idx-save");
  await page.waitForFunction(() => /Saved at|failed/i.test((document.getElementById("ee-bar") || {}).textContent || ""), null, { timeout: 20000 });
  const i4 = T(IDX), sv4 = await savedState(i4), c4 = cardHtml(i4, NEW);
  check(`[${vpName}] organize again after reload: saved, art markup unchanged, every card once, copies identical`, i4 !== i3 && uniq(sv4.all) && sv4.all.length === s2.all.length && c4 && c4.includes(newImg) && !/blob:/.test(i4) && i4 === T(IDX2), (await page.textContent("#ee-bar")).trim().slice(0, 60));
  check(`[${vpName}] index art: no page errors`, W.errs.length === 0, W.errs.join(" | "));
  // 6. From the article: hero art on a "no-art" article → its Index card gets it too.
  const SH = "articles/shune-s-basin/";
  if (fs.existsSync(path.join(ROOT, SH, "index.html"))) {
    await openEdit(page, SH);
    await page.click("#ee-art"); await page.waitForSelector("#ee-art-file", { timeout: 10000 });
    const radio = await page.$('input[name="ee-gal-act"][value="hero"]');
    if (radio) await radio.check();
    await page.setInputFiles("#ee-art-file", SMALL);
    await page.fill("#ee-art-title", "Shune Test Art");
    await page.click("#ee-art-up"); await page.waitForTimeout(500);
    const shown = await page.evaluate(() => { const im = document.querySelector(".art-hero img"); return im && im.getAttribute("src").startsWith("blob:") && !document.querySelector(".art-hero").classList.contains("no-art"); });
    await page.click("#ee-save");
    await page.waitForFunction(() => /Saved at|failed|refused/i.test((document.getElementById("ee-bar") || {}).textContent || ""), null, { timeout: 30000 });
    const sa = T(SH + "index.html"), sb = T("articles/shune-s-basin.html"), si = T(IDX);
    const sc = cardHtml(si, "/articles/shune-s-basin/");
    check(`[${vpName}] article: hero art added to a no-art hero (preview, both copies saved)`, shown && sa === sb && /<section class="art-hero"><img src="\/assets\/shune-test-art[^"]*" alt="Shune Test Art">/.test(sa), (sa.match(/<section class="art-hero[^>]*>.{0,90}/) || [""])[0]);
    check(`[${vpName}] article: its Index card gets the same art (both Index copies)`, sc && !/no-art/.test(sc) && /shune-test-art/.test(sc) && si === T(IDX2), sc && sc.slice(0, 140));
    check(`[${vpName}] article hero art: no page errors`, W.errs.length === 0, W.errs.join(" | "));
  }
  await ctx.close();
}

/* Deleting: cards (one place / everywhere, keep or delete the article), subsections and sections
   (move or delete their cards), and an article from its own page; one commit each, no dangling links. */
async function deleteTests(browser, vpName) {
  const vp = VPS[vpName];
  const IDX = "index/ancients/index.html", IDX2 = "index/ancients.html";
  global.self = global; self.EloraeSrcMap = require(path.join(ROOT, "edit/srcmap.js"));
  const M = require(path.join(ROOT, "edit/media.js"));
  const mock = newMock(); const ctx = await ctxFor(browser, mock, vp); const page = await ctx.newPage(); const W = watch(page);
  const T = (p) => { const v = mock.file(p); return v == null ? null : String(v); };
  const bar = () => page.evaluate(() => ((document.getElementById("ee-bar") || {}).textContent || "").trim());
  const ART = /draggable|contenteditable|ee-index|data-ee-|data-eimg|blob:/;
  const htmlFiles = (() => { const out = []; (function walk(d, rel) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { if (/^(\.git|node_modules|edit|assets|tools|scripts|_verify|docs|saved|foundry-welcome)$/.test(e.name) && !rel) continue; const r = rel ? rel + "/" + e.name : e.name; if (e.isDirectory()) walk(path.join(d, e.name), r); else if (/\.html$/.test(e.name)) out.push(r); } })(ROOT, ""); return out; })();
  // Every page in the repo now (mock commits over disk) that still links to the article.
  const dangling = (slug) => htmlFiles.filter((p) => { const t = T(p); return t != null && M.linksTo(t, slug); });
  const lastCommit = (n0) => { const c = writes(mock, n0).filter((e) => e.committed); return { n: c.length, msg: c.length ? c[c.length - 1].committed.message : "" }; };
  async function openOrg() {
    await page.goto(BASE + "index/ancients/", { waitUntil: "load" });
    await page.waitForFunction(() => window.EloraeEditor && window.EloraeEditor.state.profile && window.EloraeIndexOrg, null, { timeout: 15000 });
    await page.evaluate(() => window.EloraeEditor.tryEnterEdit()); await page.waitForSelector("#ee-idx-save", { timeout: 15000 }); await page.waitForTimeout(300);
  }
  async function pickCard(sel) { await page.evaluate((s) => document.querySelector(s).scrollIntoView({ block: "center" }), sel); await page.click(sel); }
  async function dialog() { await page.waitForSelector("#ee-del-ok", { state: "visible", timeout: 10000 }); return page.evaluate(() => document.getElementById("ee-body").textContent); }
  async function ok() { await page.click("#ee-del-ok"); await page.waitForFunction(() => /Saved at|failed|could not/i.test((document.getElementById("ee-bar") || {}).textContent || ""), null, { timeout: 60000 }); return bar(); }
  const cardsOf = (t, slug) => (t.match(new RegExp('<a class="index-card[^"]*"[^>]*href="/articles/' + slug + '/"', "g")) || []).length;
  await openOrg();

  // 1. Single-place card, keep the article: card + panel entry go (both copies); the article stays.
  let n0 = mock.log.length;
  await pickCard('main.index-flow a.index-card[href="/articles/the-empire-of-raim/"]');
  await page.click("#ee-idx-del");
  let d = await dialog();
  await page.check('input[name="ee-del-article"][value="keep"]');
  let b = await ok(), i = T(IDX);
  check(`[${vpName}] delete card (keep article): confirm names it + says it can be restored; card and panel entry gone, both copies; article kept; one commit`, /Delete “The Empire of Raim”\?/.test(d) && /restored/.test(d) && /Removed “The Empire of Raim”/.test(b) && cardsOf(i, "the-empire-of-raim") === 0 && !i.includes('href="#locations-the-empire-of-raim"') && i === T(IDX2) && T("articles/the-empire-of-raim.html") && lastCommit(n0).n === 1 && !ART.test(i.replace(/<script[\s\S]*?<\/script>/g, "")), b.slice(0, 80) + JSON.stringify([/Delete “The Empire of Raim”\?/.test(d), /restored/.test(d), cardsOf(i, "the-empire-of-raim"), i.includes('href="#locations-the-empire-of-raim"'), i === T(IDX2), !!T("articles/the-empire-of-raim.html"), lastCommit(n0).n, (i.replace(/<script[\s\S]*?<\/script>/g, "").match(ART) || [""])[0]]));

  // 2. Multi-section card: "from this section only" removes just that copy.
  n0 = mock.log.length;
  await pickCard("#heroes-vaerek");
  await page.click("#ee-idx-del");
  d = await dialog();
  const opts2 = await page.evaluate(() => ({ where: [...document.querySelectorAll('input[name="ee-del-where"]')].map((x) => x.value), artHidden: document.querySelector('input[name="ee-del-article"]').closest("fieldset").hidden }));
  await page.check('input[name="ee-del-where"][value="here"]');
  b = await ok(); i = T(IDX);
  check(`[${vpName}] delete card in several sections: offers this-section vs everywhere (article choice only for everywhere); "here" removes only the Heroes copy`, /2 places/.test(d) && JSON.stringify(opts2.where) === '["here","all"]' && opts2.artHidden && !i.includes('id="heroes-vaerek"') && i.includes('id="kindred-vaerek"') && T("articles/vaerek.html") && i === T(IDX2), JSON.stringify(opts2) + " " + b.slice(0, 60));

  // 3. Multi-section card, everywhere + keep the article (Saoirse).
  const sa0 = cardsOf(T(IDX), "saoirse");
  await pickCard('main.index-flow a.index-card[href="/articles/saoirse/"]');
  await page.click("#ee-idx-del"); await dialog();
  await page.check('input[name="ee-del-where"][value="all"]'); await page.check('input[name="ee-del-article"][value="keep"]');
  b = await ok(); i = T(IDX);
  check(`[${vpName}] delete card everywhere, keep article: all ${sa0} Saoirse cards gone; her page stays`, sa0 > 1 && cardsOf(i, "saoirse") === 0 && T("articles/saoirse.html") && T("articles/saoirse/index.html") && i === T(IDX2), b.slice(0, 60));

  // 4. Card + its article (Vaerek, Sawyer's character): page gone (both copies) + every reference, in one commit.
  n0 = mock.log.length;
  await pickCard("#kindred-vaerek");
  await page.click("#ee-idx-del"); d = await dialog();
  await page.check('input[name="ee-del-article"][value="delete"]');
  b = await ok(); i = T(IDX);
  const plan4 = await page.evaluate(() => window.EloraeIndexOrg.lastPlan);
  const prof = JSON.parse(T("edit/profiles.json")), si = T("search-index.js"), sm = T("sitemap.xml");
  const saw = Object.values(prof.profiles).find((p) => p.person === "sawyer");
  check(`[${vpName}] delete card + article: owner named (Sawyer); both article copies deleted; no card; one commit`, /Sawyer/.test(d) && T("articles/vaerek.html") === null && T("articles/vaerek/index.html") === null && cardsOf(i, "vaerek") === 0 && i === T(IDX2) && lastCommit(n0).n === 1 && /Delete “Vaerek Rathkin”/.test(lastCommit(n0).msg), b.slice(0, 80) + " " + lastCommit(n0).msg);
  const dg = dangling("vaerek");
  check(`[${vpName}] delete article: no page links to it any more (rails, related lists, mast, prose → plain text), search index, sitemap, Sawyer's editable list + characters`, dg.length === 0 && !/"href":"articles\/vaerek\.html"/.test(si) && !/articles\/vaerek\.html</.test(sm) && saw.permissions.indexOf("articles/vaerek.html") < 0 && saw.characters.indexOf("Vaerek Rathkin") < 0 && T("journal.html").includes("<p>Vaerek climbed"), "dangling " + dg.slice(0, 5).join(", ") + " pages " + (plan4 && plan4.pages));
  check(`[${vpName}] delete article: art used elsewhere stays in the gallery (files always kept in assets/)`, plan4 && plan4.kept.length + plan4.dropped.length >= 1 && plan4.dropped.every((k) => !JSON.parse(T("edit/media/catalog.json")).media || !Object.values(JSON.parse(T("edit/media/catalog.json")).media).some((e) => e.path === k)) && plan4.kept.every((k) => Object.values(JSON.parse(T("edit/media/catalog.json")).media).some((e) => e.path === k)), JSON.stringify(plan4 && { kept: plan4.kept, dropped: plan4.dropped }));

  // 5. Non-empty subsection: move its cards (Draconic Kindred → Heroes); its articles link back to Heroes.
  const kin = await page.evaluate(() => [...document.querySelectorAll("#kindred + .index-cards a.index-card")].map((a) => a.getAttribute("href").split("/")[2]));
  await page.click("#ee-idx-subs-btn"); await page.selectOption("#ee-sub-parent", "factions");
  await page.click('#ee-sub-list li[data-sub="kindred"] [data-act="del"]');
  d = await dialog();
  await page.check('input[name="ee-del-cards"][value="move"]'); await page.selectOption("#ee-del-to", "heroes");
  b = await ok(); i = T(IDX);
  const heroes = (/<section class="index-cat" id="heroes">[\s\S]*?<\/section>/.exec(i) || [""])[0];
  const backs = kin.map((s) => M.artBackOf(T("articles/" + s + ".html") || "")).filter((x) => x && /#kindred/.test(x));
  check(`[${vpName}] delete subsection with cards → move: asks first; heading gone; its ${kin.length} cards now in Heroes (no duplicates); nothing links to #kindred; copies identical`, /has \d+ cards/.test(d) && !i.includes('id="kindred"') && !i.includes('href="#kindred"') && kin.every((s) => cardsOf(heroes, s) === 1) && backs.length === 0 && i === T(IDX2), b.slice(0, 80) + " " + backs.join(","));

  // 6. Subsection with a new card → delete the cards and their articles.
  await page.click("#ee-idx-subs-btn").catch(() => {}); if (!(await page.$("#ee-sub-parent"))) await page.click("#ee-idx-subs-btn");
  await page.selectOption("#ee-sub-parent", "factions"); await page.fill("#ee-sub-name", "Zq Temp"); await page.click("#ee-sub-add");
  page._answer = "Zq Gone"; await page.click("#ee-idx-add"); await page.click('#ee-tpl-pick [data-tpl=""]');
  await page.waitForFunction(() => /Added|failed/i.test((document.getElementById("ee-bar") || {}).textContent || ""), null, { timeout: 20000 });
  const made = !!T("articles/zq-gone/index.html");
  if (!(await page.$("#ee-sub-parent"))) await page.click("#ee-idx-subs-btn");
  await page.selectOption("#ee-sub-parent", "factions");
  await page.click('#ee-sub-list li[data-sub="zq-temp"] [data-act="del"]'); await dialog();
  await page.check('input[name="ee-del-cards"][value="delete"]'); await page.check("#ee-del-articles");
  b = await ok(); i = T(IDX);
  check(`[${vpName}] delete subsection → delete its cards + articles: card, heading and article (both copies) gone`, made && !i.includes("zq-temp") && cardsOf(i, "zq-gone") === 0 && T("articles/zq-gone.html") === null && T("articles/zq-gone/index.html") === null && dangling("zq-gone").length === 0 && i === T(IDX2), b.slice(0, 80));

  // 7. Top-level sections: an empty one (Armaments) after a confirm, then Vignettes → move its cards to Locations;
  //    each leaves the Index panel and every article's Categories rail.
  if (!(await page.$("#ee-sub-parent"))) await page.click("#ee-idx-subs-btn");
  await page.selectOption("#ee-sub-parent", "armaments"); await page.click("#ee-sec-del"); d = await dialog();
  b = await ok(); i = T(IDX);
  const railLeft = (id) => htmlFiles.filter((p) => /^articles\//.test(p)).filter((p) => { const t = T(p); return t && t.includes('href="/index/ancients/#' + id + '"'); });
  check(`[${vpName}] delete empty section: confirm ("no cards"); gone from the Index, its panel and every article rail`, /no cards/.test(d) && !i.includes('id="armaments"') && !i.includes('href="#armaments"') && railLeft("armaments").length === 0 && i === T(IDX2), b.slice(0, 80) + " rails left " + railLeft("armaments").length);
  const vig = await page.evaluate(() => [...document.querySelectorAll("#vignettes a.index-card")].map((a) => a.getAttribute("href").split("/")[2]));
  if (!(await page.$("#ee-sub-parent"))) await page.click("#ee-idx-subs-btn");
  await page.selectOption("#ee-sub-parent", "vignettes"); await page.click("#ee-sec-del"); d = await dialog();
  await page.check('input[name="ee-del-cards"][value="move"]'); await page.selectOption("#ee-del-to", "locations");
  b = await ok(); i = T(IDX);
  const loc = (/<section class="index-cat" id="locations">[\s\S]*?<\/section>/.exec(i) || [""])[0];
  const vback = vig.map((s) => M.artBackOf(T("articles/" + s + ".html") || ""));
  check(`[${vpName}] delete section with cards → move: section + Categories entries gone; cards in Locations; their articles link back to Locations`, !i.includes('id="vignettes"') && railLeft("vignettes").length === 0 && vig.length > 0 && vig.every((s) => cardsOf(loc, s) === 1) && vback.every((h) => h === "/index/ancients/#locations") && i === T(IDX2), b.slice(0, 80) + " " + JSON.stringify(vback));
  // Reload during the deploy: the kept copy shows the result.
  await page.evaluate(() => window.EloraeIndexOrg && window.EloraeIndexOrg.stop && window.EloraeIndexOrg.stop());
  await page.goto(BASE + "index/ancients/", { waitUntil: "load" });
  await page.waitForFunction(() => window.EloraeRecent, null, { timeout: 15000 });
  const rst = await page.evaluate(() => window.EloraeRecent.ready.then(() => JSON.stringify(window.EloraeRecent.status)));
  const r7 = await page.evaluate(() => ({ arm: !!document.getElementById("vignettes") || !!document.getElementById("armaments"), kin: !!document.getElementById("kindred"), v: !!document.querySelector('a.index-card[href="/articles/vaerek/"]') }));
  check(`[${vpName}] delete: reload before the rebuild shows the deletions (kept copy)`, /"shown"/.test(rst) && !r7.arm && !r7.kin && !r7.v, rst + " " + JSON.stringify(r7));
  check(`[${vpName}] delete (Index): no page errors`, W.errs.length === 0, W.errs.join(" | "));
  await ctx.close();

  // 8. Delete an article from its own page (Galand Helviath, Jack's character, in two sections).
  {
    const mock2 = newMock(); const ctx2 = await ctxFor(browser, mock2, vp); const pg = await ctx2.newPage(); const W2 = watch(pg);
    const T2 = (p) => { const v = mock2.file(p); return v == null ? null : String(v); };
    await openEdit(pg, "articles/galand-helviath/");
    await pg.click("#ee-delart");
    await pg.waitForSelector("#ee-del-ok", { state: "visible", timeout: 15000 });
    const dd = await pg.evaluate(() => document.getElementById("ee-body").textContent);
    const n1 = mock2.log.length;
    await pg.click("#ee-del-ok");
    await pg.waitForFunction(() => /Deleted|failed/i.test((document.getElementById("ee-bar") || {}).textContent || ""), null, { timeout: 60000 });
    const bb = await pg.evaluate(() => (document.getElementById("ee-bar") || {}).textContent || "");
    const c = writes(mock2, n1).filter((e) => e.committed);
    const i2 = T2(IDX), dg2 = htmlFiles.filter((p) => { const t = T2(p); return t != null && M.linksTo(t, "galand-helviath"); });
    const jack = Object.values(JSON.parse(T2("edit/profiles.json")).profiles).find((p) => p.person === "jack");
    check(`[${vpName}] article page Delete: confirm names the owner (Jack), cards + restore note; one commit deletes both copies + both Index cards; no dangling links; Jack's list pruned`, /Jack/.test(dd) && /2 Index cards/.test(dd) && /restored/.test(dd) && /Deleted “Galand Helviath”/.test(bb) && c.length === 1 && T2("articles/galand-helviath.html") === null && T2("articles/galand-helviath/index.html") === null && cardsOf(i2, "galand-helviath") === 0 && i2 === T2(IDX2) && dg2.length === 0 && jack.permissions.indexOf("articles/galand-helviath.html") < 0, bb.slice(0, 60) + " dangling " + dg2.slice(0, 4).join(","));
    await pg.waitForURL(/\/index\/ancients\//, { timeout: 10000 }).catch(() => {});
    check(`[${vpName}] article page Delete: goes to the Index, where the card is already gone`, /\/index\/ancients\//.test(pg.url()) && await pg.evaluate(() => window.EloraeRecent ? window.EloraeRecent.ready.then(() => !document.querySelector('a.index-card[href="/articles/galand-helviath/"]')) : false), pg.url());
    check(`[${vpName}] article page Delete: no page errors`, W2.errs.length === 0, W2.errs.join(" | "));
    await ctx2.close();
  }
  // 9. Players never get Delete (their own character page, or the Index).
  {
    const mock3 = newMock(); const ctx3 = await ctxFor(browser, mock3, vp, "sawyer"); const pg = await ctx3.newPage();
    await openEdit(pg, "articles/vaerek/");
    const has = await pg.evaluate(() => !!document.getElementById("ee-delart"));
    const blocked = await pg.evaluate(() => window.EloraeEditor.planDelete({ slugs: ["vaerek"] }).then(() => "ran", (e) => e.message));
    check(`[${vpName}] player (Sawyer) on his own character: no Delete button; delete refused`, !has && /Only Devin/.test(blocked), blocked);
    await ctx3.close();
  }
}

/* Index subsections: add, add a card in it, drag a card in, add another, reorder, rename, delete empty. */
async function subsecTests(browser, vpName) {
  const vp = VPS[vpName];
  const IDX = "index/ancients/index.html", IDX2 = "index/ancients.html";
  const mock = newMock(); const ctx = await ctxFor(browser, mock, vp); const page = await ctx.newPage(); const W = watch(page);
  const T = (p) => { const v = mock.file(p); return v == null ? null : String(v); };
  const bar = () => page.evaluate(() => ((document.getElementById("ee-bar") || {}).textContent || "").trim());
  const ART = /draggable|contenteditable|ee-index|data-ee-|data-eimg|blob:|is-lore-flipped/;
  await page.goto(BASE + "index/ancients/", { waitUntil: "load" });
  await page.waitForFunction(() => window.EloraeEditor && window.EloraeEditor.state.profile && window.EloraeIndexOrg, null, { timeout: 15000 });
  await page.evaluate(() => window.EloraeEditor.tryEnterEdit()); await page.waitForSelector("#ee-idx-save", { timeout: 15000 }); await page.waitForTimeout(300);
  const subIds = () => page.evaluate(() => [...document.querySelectorAll("#factions > h3.index-sub")].map((h) => h.id));
  async function addSub(parent, name) {
    if (!(await page.$("#ee-idx-subs"))) await page.click("#ee-idx-subs-btn");
    await page.waitForSelector("#ee-sub-parent");
    await page.selectOption("#ee-sub-parent", parent);
    await page.fill("#ee-sub-name", name);
    await page.click("#ee-sub-add");
    await page.waitForTimeout(100);
  }
  // 1. Add "Zq Order" to Factions.
  await addSub("factions", "Zq Order");
  const d1 = await page.evaluate(() => { const h = document.getElementById("zq-order"), b = h && h.nextElementSibling; return h && { last: h.parentElement.lastElementChild === b && h.parentElement.id, cls: h.className, box: b && b.className, empty: !!(b && b.querySelector("p.index-empty")), toc: !!document.querySelector('#index-toc-panel a.toc-sub[href="#zq-order"]'), list: [...document.querySelectorAll("#ee-sub-list li")].map((l) => l.getAttribute("data-sub")) }; });
  check(`[${vpName}] subsection: Add puts an empty subsection (heading + empty box) at the end of the chosen section, listed in Categories and the panel`, d1 && d1.last === "factions" && /index-sub/.test(d1.cls) && d1.empty && d1.toc && d1.list.includes("zq-order") && d1.list.includes("kindred"), JSON.stringify(d1));
  // 2. Add card in it (the new subsection is the Add-card target).
  page._answer = "Zq Member";
  await page.click("#ee-idx-add"); await page.click('#ee-tpl-pick [data-tpl=""]');
  await page.waitForFunction(() => /Added|failed|exists/i.test((document.getElementById("ee-bar") || {}).textContent || ""), null, { timeout: 20000 });
  const b2 = await bar(), i2 = T(IDX), a2 = T("articles/zq-member/index.html") || "";
  check(`[${vpName}] subsection: Add card goes into it; saved Index has the site's subsection markup; both copies identical`, /Added “Zq Member”/.test(b2) && i2 === T(IDX2) && i2.includes('<h3 class="index-sub" id="zq-order">Zq Order</h3><div class="index-cards"><a class="index-card no-art" id="zq-order-zq-member" href="/articles/zq-member/"><span>Zq Member</span></a></div></section>') && i2.includes('<a class="toc-sub" href="#zq-order">Zq Order</a><a class="toc-name" href="#zq-order-zq-member">Zq Member</a>') && !ART.test(i2.replace(/<script[\s\S]*?<\/script>/g, "")), b2.slice(0, 60));
  check(`[${vpName}] subsection: the new card's article links back to the subsection and highlights its section in the rail`, a2.includes('<a class="art-back" href="/index/ancients/#zq-order">') && a2.includes('<a class="on" href="/index/ancients/#factions"'), (a2.match(/art-back" href="[^"]*"/) || [""])[0]);
  // 3. Drag a card (Aghor) into the subsection.
  await page.evaluate(() => {
    const src = document.querySelector('main.index-flow a.index-card[href="/articles/aghor/"]'), dst = document.getElementById("zq-order-zq-member");
    const dt = new DataTransfer();
    src.dispatchEvent(new DragEvent("dragstart", { bubbles: true, cancelable: true, dataTransfer: dt }));
    dst.scrollIntoView({ block: "center" });
    const r = dst.getBoundingClientRect(), x = r.left + r.width * 0.85, y = r.top + r.height * 0.75;
    const t = document.elementFromPoint(x, y) || dst;
    t.dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer: dt, clientX: x, clientY: y }));
    t.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: dt, clientX: x, clientY: y }));
    src.dispatchEvent(new DragEvent("dragend", { bubbles: true, dataTransfer: dt }));
  });
  const d3 = await page.evaluate(() => [...document.querySelectorAll("#zq-order + .index-cards > a.index-card")].map((a) => a.id));
  check(`[${vpName}] subsection: drag a card into it (id follows the subsection)`, JSON.stringify(d3) === JSON.stringify(["zq-order-aghor", "zq-order-zq-member"]) /* ia1: A to Z */, JSON.stringify(d3));
  // 4. A second subsection, moved above the first with ↑; save → empty subsection markup.
  await addSub("factions", "Zq Guild");
  await page.click('#ee-sub-list li[data-sub="zq-guild"] [data-act="up"]');
  const o4 = await subIds();
  await page.click("#ee-idx-save");
  await page.waitForFunction(() => /Saved at|failed/i.test((document.getElementById("ee-bar") || {}).textContent || ""), null, { timeout: 20000 });
  const i4 = T(IDX);
  check(`[${vpName}] subsection: ↑ reorders; save writes the empty one as heading + "None filed here yet" box, order kept, copies identical`, JSON.stringify(o4.slice(-2)) === JSON.stringify(["zq-guild", "zq-order"]) && i4.includes('<h3 class="index-sub" id="zq-guild">Zq Guild</h3><div class="index-cards"><p class="index-empty">None filed here yet</p></div><h3 class="index-sub" id="zq-order">') && i4.includes('href="/articles/aghor/"') && i4 === T(IDX2) && !ART.test(i4.replace(/<script[\s\S]*?<\/script>/g, "")), JSON.stringify(o4));
  // 5. Rename (heading edit), 6. delete: blocked while it has cards; empty one deleted after confirm.
  await page.evaluate(() => { const h = document.getElementById("zq-guild"); h.scrollIntoView({ block: "center" }); h.focus(); const r = document.createRange(); r.selectNodeContents(h); const s = getSelection(); s.removeAllRanges(); s.addRange(r); });
  await page.keyboard.type("Zq Guild Two"); await page.keyboard.press("Enter"); await page.waitForTimeout(100);
  const ren = await page.evaluate(() => ({ h: document.getElementById("zq-guild").textContent, toc: (document.querySelector('#index-toc-panel a.toc-sub[href="#zq-guild"]') || {}).textContent }));
  if (!(await page.$("#ee-idx-subs"))) await page.click("#ee-idx-subs-btn");
  await page.selectOption("#ee-sub-parent", "factions");
  await page.click('#ee-sub-list li[data-sub="zq-order"] [data-act="del"]');
  await page.waitForSelector("#ee-del-cancel", { state: "visible", timeout: 10000 });
  const blocked = await page.evaluate(() => document.getElementById("ee-body").textContent);
  await page.click("#ee-del-cancel"); await page.waitForTimeout(100);
  const still = await page.evaluate(() => !!document.getElementById("zq-order") && document.querySelectorAll("#zq-order + .index-cards a.index-card").length === 2);
  if (!(await page.$("#ee-idx-subs"))) await page.click("#ee-idx-subs-btn");
  await page.selectOption("#ee-sub-parent", "factions");
  page._answer = true;
  await page.click('#ee-sub-list li[data-sub="zq-guild"] [data-act="del"]');
  const gone = await page.evaluate(() => !document.getElementById("zq-guild") && !document.querySelector('#index-toc-panel a[href="#zq-guild"]'));
  check(`[${vpName}] subsection: rename via its heading (Categories follows); delete of one with cards asks what to do with them (cancel keeps it); empty one deleted after confirm`, ren.h === "Zq Guild Two" && ren.toc === "Zq Guild Two" && /It has 2 cards/.test(blocked) && still && gone, JSON.stringify(ren) + " " + blocked.slice(0, 60));
  await page.click("#ee-idx-save");
  await page.waitForFunction(() => /Saved at|failed/i.test((document.getElementById("ee-bar") || {}).textContent || ""), null, { timeout: 20000 });
  const i6 = T(IDX);
  check(`[${vpName}] subsection: saved without the deleted one; others untouched; copies identical`, !i6.includes("zq-guild") && i6.includes('id="zq-order"') && i6.includes('<h3 class="index-sub" id="kindred">Draconic Kindred</h3>') && i6 === T(IDX2), "");
  // 7. Reload during deploy: the kept copy shows the subsection.
  await page.reload({ waitUntil: "load" });
  await page.waitForFunction(() => window.EloraeRecent, null, { timeout: 15000 });
  const rst = await page.evaluate(() => window.EloraeRecent.ready.then(() => JSON.stringify(window.EloraeRecent.status)));
  const r7 = await page.evaluate(() => ({ sub: !!document.getElementById("zq-order"), n: document.querySelectorAll("#zq-order + .index-cards > a.index-card").length, toc: !!document.querySelector('#index-toc-panel a.toc-sub[href="#zq-order"]'), guild: !!document.getElementById("zq-guild") }));
  check(`[${vpName}] subsection: reload before the rebuild shows it (kept copy), Categories too`, /"shown"/.test(rst) && r7.sub && r7.n === 2 && r7.toc && !r7.guild, rst + " " + JSON.stringify(r7));
  check(`[${vpName}] subsection: no page errors`, W.errs.length === 0, W.errs.join(" | "));
  await ctx.close();
}

/* Hero art sets (the article's art switcher) + hero rename/art sync to the Index and other pages. */
async function artSetTests(browser, vpName) {
  const vp = VPS[vpName];
  const DIR = path.join(OUT, "art"); fs.mkdirSync(DIR, { recursive: true });
  const UP = path.join(DIR, "Aghor Dawn.png");
  if (!fs.existsSync(UP)) fs.writeFileSync(UP, makePng(900, 500, 5));
  const IDX = "index/ancients/index.html", IDX2 = "index/ancients.html";
  const heroOf = (t) => { const i = t.indexOf('<section class="art-hero'); return i < 0 ? "" : t.slice(i, t.indexOf("</section>", i) + 10); };
  const btns = (t) => [...heroOf(t).matchAll(/<button type="button" class="(on)?" aria-pressed="(true|false)" aria-label="([^"]*)" data-src="([^"]*)" data-alt="([^"]*)"/g)].map((m) => ({ on: !!m[1], label: m[3], src: m[4], alt: m[5] }));
  const heroImgSrc = (t) => (heroOf(t).match(/^<section class="art-hero[^"]*"><img src="([^"]*)"/) || [])[1];
  const cardsArt = (t, slug) => [...t.matchAll(new RegExp('<a class="index-card[^"]*"[^>]*href="/articles/' + slug + '/"[^>]*>[\\s\\S]*?</a>', "g"))].map((m) => ((m[0].match(/<img src="([^"]*)"/) || [])[1] || "").replace(/^\/cdn-cgi\/image\/[^/]+/, ""));
  const strip = (page) => page.evaluate(() => [...document.querySelectorAll("#ee-arts .ee-art-item")].map((it) => ({ cap: it.querySelector(".ee-art-cap").value, main: it.classList.contains("is-main") })));
  const bar = (page) => page.evaluate(() => ((document.getElementById("ee-bar") || {}).textContent || "").trim());
  async function saveAndWait(page) {
    await page.click("#ee-save");
    await page.waitForFunction(() => /Saved at|Proposed|failed|No changes|refused|Nothing was saved/i.test((document.getElementById("ee-bar") || {}).textContent || ""), null, { timeout: 30000 });
    return bar(page);
  }
  const item = (i, act) => `#ee-arts .ee-art-item[data-i="${i}"] [data-act="${act}"]`;
  const dragArt = async (page, from, to, after) => { const t = await page.$(`#ee-arts .ee-art-item[data-i="${to}"]`); const bb = await t.boundingBox(); await page.dragAndDrop(`#ee-arts .ee-art-item[data-i="${from}"]`, `#ee-arts .ee-art-item[data-i="${to}"]`, { targetPosition: { x: after ? bb.width - 6 : 6, y: 20 }, force: true }); await page.waitForTimeout(120); };
  // 1. Devin, single-hero page (Aghor): add a 2nd (upload) and a 3rd (gallery), reorder, caption, set main, save.
  {
    const mock = newMock(); const ctx = await ctxFor(browser, mock, vp); const page = await ctx.newPage(); const W = watch(page);
    const A1 = "articles/aghor/index.html", A2 = "articles/aghor.html", orig = fs.readFileSync(path.join(ROOT, A1), "utf8"), idx0 = fs.readFileSync(path.join(ROOT, IDX), "utf8");
    await openEdit(page, "articles/aghor/");
    await page.click("#ee-arts-btn"); await page.waitForSelector("#ee-arts .ee-art-item");
    const s0 = await strip(page);
    await page.click("#ee-arts-add"); await page.waitForSelector("#ee-pick-file", { timeout: 10000 });
    await page.setInputFiles("#ee-pick-file", UP);
    await page.waitForFunction(() => document.querySelectorAll("#ee-arts .ee-art-item").length === 2, null, { timeout: 20000 });
    const s1 = await strip(page);
    const heroNow = await page.evaluate(() => document.querySelector(".art-hero > img").getAttribute("src"));
    check(`[${vpName}] arts: Arts strip lists the page's art; upload adds a 2nd (caption = file name), previewed in the hero`, s0.length === 1 && s0[0].main && s1.length === 2 && s1[1].cap === "Aghor Dawn" && /^blob:/.test(heroNow), JSON.stringify(s1));
    await page.click("#ee-arts-add"); await page.waitForSelector("#ee-pick-wrap .ee-gal-item", { timeout: 15000 });
    const pickId = await page.evaluate(() => { const b = [...document.querySelectorAll("#ee-pick-wrap .ee-gal-item")].find((x) => !/aghor/i.test(x.getAttribute("data-pick-id"))); b.click(); return b.getAttribute("data-pick-id"); });
    await page.waitForFunction(() => document.querySelectorAll("#ee-arts .ee-art-item").length === 3, null, { timeout: 10000 });
    // Reorder (drag only, no arrows): 3rd one step earlier, then the first to the end.
    await dragArt(page, 2, 1, false);
    const s2 = await strip(page);
    await dragArt(page, 0, 2, true);
    await page.waitForTimeout(150);
    const s3 = await strip(page);
    check(`[${vpName}] arts: gallery pick adds a 3rd; drag moves one earlier; drag moves the first to the end`, s2.length === 3 && s2[2].cap === "Aghor Dawn" && s3.length === 3 && s3[2].cap === "Aghor" && s3[2].main && s3[1].cap === "Aghor Dawn", JSON.stringify(s3));
    const dawn = s3.findIndex((x) => x.cap === "Aghor Dawn");
    await page.fill(`#ee-arts .ee-art-item[data-i="${dawn}"] .ee-art-cap`, "Aghor at Dawn");
    await page.click(item(dawn, "main"));
    const s4 = await strip(page);
    if (vpName === "desktop") { fs.mkdirSync("/workspace/shots", { recursive: true }); await page.evaluate(() => document.querySelector(".art-hero").scrollIntoView()); await page.waitForTimeout(200); await page.screenshot({ path: "/workspace/shots/art-switcher-edit.png" }); }
    const n0 = mock.log.length;
    const b1 = await saveAndWait(page);
    const t1 = String(mock.file(A1)), bs = btns(t1), commits = writes(mock, n0).filter((e) => e.committed);
    const cat = JSON.parse(String(mock.file("edit/media/catalog.json")));
    const upPath = Object.values(cat.media).map((m) => m.path).find((p) => /aghor-dawn|aghor dawn/i.test(p));
    check(`[${vpName}] arts save: one commit, both copies identical, site switcher markup (3 thumbs, main first-shown, script once)`, /Saved at/.test(b1) && commits.length === 1 && t1 === String(mock.file(A2)) && /<section class="art-hero has-swap">/.test(t1) && bs.length === 3 && bs.filter((b) => b.on).length === 1 && bs[s4.findIndex((x) => x.main)].on && (t1.match(/art-swap\.js\?v=/g) || []).length === 1 && /<div class="art-swap-nav">/.test(t1), b1.slice(0, 60) + " commits " + commits.length + " " + JSON.stringify(bs.map((b) => [b.alt, b.on])));
    check(`[${vpName}] arts save: upload resized + committed with the gallery catalog; caption used for data-alt/aria-label; hero = main`, upPath && mock.file(upPath) && bs.some((b) => b.src === "/" + upPath && b.alt === "Aghor at Dawn" && b.label === "Aghor at Dawn" && b.on) && heroImgSrc(t1) === "/" + upPath && commits[0].committed.paths.includes(upPath) && commits[0].committed.paths.includes("edit/media/catalog.json"), upPath + " hero " + heroImgSrc(t1));
    const i1 = String(mock.file(IDX));
    check(`[${vpName}] arts save: "Set as main" moves the Index card art (both Index copies) and og:image, same commit`, cardsArt(i1, "aghor").every((u) => u === "/" + upPath.replace(/ /g, "%20")) && i1 === String(mock.file(IDX2)) && commits[0].committed.paths.includes(IDX) && /og:image" content="https:\/\/elorae\.world\/assets\/aghor-dawn/i.test(t1), JSON.stringify(cardsArt(i1, "aghor")));
    // Page after save: the visitor switcher works with 3 arts (next arrow cycles).
    const live = await page.evaluate(async () => {
      const n = document.querySelectorAll(".art-swap-thumbs button").length, h = () => document.querySelector(".art-hero > img").getAttribute("src");
      const a = h(); document.querySelector(".art-swap .art-next").click(); const b = h(); document.querySelector(".art-swap .art-next").click(); const c = h(); document.querySelector(".art-swap .art-next").click(); const d = h();
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true })); const e = h();
      return { n, distinct: new Set([a, b, c]).size, wrap: d === a, key: e === c };
    });
    check(`[${vpName}] after save: the page's switcher shows the 3 arts; arrows and ←/→ cycle and wrap`, live.n === 3 && live.distinct === 3 && live.wrap && live.key, JSON.stringify(live));
    // Reload before the site rebuilds: the saved set shows (new picture from this browser).
    await page.reload({ waitUntil: "load" });
    await page.waitForFunction(() => window.EloraeRecent, null, { timeout: 15000 });
    const rst = await page.evaluate(() => window.EloraeRecent.ready.then(() => JSON.stringify(window.EloraeRecent.status)));
    await page.waitForTimeout(500);
    const rl = await page.evaluate(() => { const bs = [...document.querySelectorAll(".art-swap-thumbs button")]; const h = document.querySelector(".art-hero > img"); return { n: bs.length, heroBlob: /^blob:/.test(h.getAttribute("src")), ok: h.complete && h.naturalWidth > 0, swap: !!window.EloraeArtSwap && window.EloraeArtSwap.count() }; });
    check(`[${vpName}] reload during deploy: saved switcher + new main art show (kept copy, image from memory)`, /"shown"/.test(rst) && rl.n === 3 && rl.heroBlob && rl.ok && rl.swap === 3, rst + " " + JSON.stringify(rl));
    // Edit again: remove down to one (the original) → plain hero again, page back to its original bytes.
    await page.evaluate(() => window.EloraeEditor.tryEnterEdit()); await page.waitForSelector("#ee-save", { timeout: 15000 }); await page.waitForTimeout(250);
    await page.click("#ee-arts-btn"); await page.waitForSelector("#ee-arts .ee-art-item");
    const s5 = await strip(page);
    for (let k = 0; k < 2; k++) {
      const st = await strip(page); const j = st.findIndex((x) => x.cap !== "Aghor");
      page._answer = true; await page.click(item(j, "del")); await page.waitForTimeout(100);
    }
    const s6 = await strip(page);
    const b2 = await saveAndWait(page);
    const t2 = String(mock.file(A1)), i2 = String(mock.file(IDX));
    check(`[${vpName}] arts: edit again loads the saved set; remove down to 1 (confirm) → plain hero, no switcher/script; page identical to the original`, s5.length === 3 && s6.length === 1 && /Saved at/.test(b2) && t2 === orig && t2 === String(mock.file(A2)), b2.slice(0, 60) + " " + JSON.stringify(s6));
    check(`[${vpName}] arts: card art follows the main art back (both Index copies identical to the original)`, i2 === idx0 && String(mock.file(IDX2)) === fs.readFileSync(path.join(ROOT, IDX2), "utf8"), JSON.stringify(cardsArt(i2, "aghor")));
    const gone = await page.evaluate(() => ({ swap: document.querySelectorAll(".art-swap").length, cls: document.querySelector(".art-hero").className }));
    check(`[${vpName}] arts: page shows a plain hero after the collapse save`, gone.swap === 0 && !/has-swap/.test(gone.cls), JSON.stringify(gone));
    check(`[${vpName}] arts (Aghor): no page errors`, W.errs.length === 0, W.errs.join(" | "));
    await ctx.close();
  }
  // 2. Vaerek (existing 2-art set): loads; reorder and back / main and back = no change, nothing
  //    written; Set as main on the 2nd → every Vaerek card (2 sections, both Index copies) follows.
  {
    const mock = newMock(); const ctx = await ctxFor(browser, mock, vp); const page = await ctx.newPage(); const W = watch(page);
    const V1 = "articles/vaerek/index.html", V2 = "articles/vaerek.html", orig = fs.readFileSync(path.join(ROOT, V1), "utf8");
    await openEdit(page, "articles/vaerek/");
    await page.click("#ee-arts-btn"); await page.waitForSelector("#ee-arts .ee-art-item");
    const s0 = await strip(page);
    await dragArt(page, 0, 1, true); await dragArt(page, 0, 1, true);
    const st = await page.evaluate(() => [...document.querySelectorAll("#ee-arts .ee-art-item")].map((it) => { const b = it.querySelector(".ee-art-star"); return b && b.textContent + b.getAttribute("aria-pressed"); }).join(","));
    check(`[${vpName}] arts: star row (★ main, ☆ others), no arrows/badge/chip`, /^\u2605true,\u2606false$/.test(st) && !(await page.$("#ee-arts .ee-art-left, #ee-arts .ee-art-right, #ee-arts .ee-art-badge, #ee-arts .ee-art-setmain")), st);
    await page.click(item(1, "main")); await page.click(item(0, "main"));
    const n0 = mock.log.length;
    const b0 = await saveAndWait(page);
    check(`[${vpName}] arts (Vaerek): existing set loads (2, main first); moved/main and back → "No changes", nothing written`, s0.length === 2 && s0[0].main && s0[0].cap === "Vaerek Rathkin" && s0[1].cap === "Vaerek, Vessel of Heldranc" && /No changes/.test(b0) && writes(mock, n0).length === 0, b0.slice(0, 50) + " " + JSON.stringify(s0));
    await page.click(item(1, "main"));
    const b1 = await saveAndWait(page);
    const t1 = String(mock.file(V1)), i1 = String(mock.file(IDX)), bs = btns(t1);
    const ca = cardsArt(i1, "vaerek");
    const diff = t1.split("\n").filter((l, i) => l !== orig.split("\n")[i]).length;
    check(`[${vpName}] arts (Vaerek): Set as main → hero + "on" thumb move, thumbnails byte-kept, both copies`, /Saved at/.test(b1) && t1 === String(mock.file(V2)) && bs.length === 2 && bs[1].on && !bs[0].on && heroImgSrc(t1) === "/assets/Vaerek, Vessel of Heldranc.png" && t1.replace(/ class="on" aria-pressed="true"| class="" aria-pressed="false"/g, "") .length > 0 && diff <= 3, `diff lines ${diff}`);
    check(`[${vpName}] arts (Vaerek): every Vaerek card (Heroes + Kindred, both Index copies) gets the new main art`, ca.length === 2 && ca.every((u) => /Vessel%20of%20Heldranc/.test(u)) && i1 === String(mock.file(IDX2)), JSON.stringify(ca));
    check(`[${vpName}] arts (Vaerek): no page errors`, W.errs.length === 0, W.errs.join(" | "));
    await ctx.close();
  }
  // 3. Ownership: Sawyer (owns Vaerek) may change his own set from the gallery (no upload), as a
  //    pull request with only his page; never someone else's page.
  {
    const mock = newMock(); const ctx = await ctxFor(browser, mock, vp, "sawyer"); const page = await ctx.newPage(); const W = watch(page);
    await openEdit(page, "articles/vaerek/");
    const hasBtn = !!(await page.$("#ee-arts-btn"));
    await page.click("#ee-arts-btn"); await page.waitForSelector("#ee-arts .ee-art-item");
    await page.click("#ee-arts-add"); await page.waitForSelector("#ee-pick-wrap .ee-gal-item", { timeout: 15000 });
    const noUpload = !(await page.$("#ee-pick-file"));
    await page.evaluate(() => document.querySelector("#ee-pick-wrap .ee-gal-item").click());
    await page.waitForFunction(() => document.querySelectorAll("#ee-arts .ee-art-item").length === 3, null, { timeout: 10000 });
    await page.click(item(2, "main"));
    const b1 = await saveAndWait(page);
    const pr = mock.pulls[0], br = pr && pr.head;
    const changed = br ? writes(mock).filter((e) => e.committed).flatMap((e) => e.committed.paths) : [];
    const pv = br ? String(mock.file("articles/vaerek.html", br)) : "";
    check(`[${vpName}] ownership: player adds gallery art to his own page (no upload offered); PR has only his page's two copies; note says the card waits for Devin`, hasBtn && noUpload && /Proposed/.test(b1) && btns(pv).length === 3 && String(mock.file("articles/vaerek/index.html", br)) === pv && changed.every((p) => /^articles\/vaerek(\.html|\/index\.html)$/.test(p)) && /until Devin/.test(b1), b1.slice(0, 120) + " " + JSON.stringify(changed));
    const page2 = await ctx.newPage(); watch(page2);
    await page2.goto(BASE + "articles/aghor/", { waitUntil: "load" });
    await page2.waitForFunction(() => window.EloraeEditor && window.EloraeEditor.state.profile, null, { timeout: 15000 }).catch(() => {});
    await page2.evaluate(() => window.EloraeEditor.tryEnterEdit()); await page2.waitForTimeout(500);
    check(`[${vpName}] ownership: no Arts editing on someone else's page`, !(await page2.$("#ee-arts-btn")) && !(await page2.$("#ee-save")));
    check(`[${vpName}] ownership: no page errors`, W.errs.length === 0, W.errs.join(" | "));
    await ctx.close();
  }
  // 4. Rename + epithet in the hero → cards (all copies), Index panel, rails, related lists, search, head.
  if (vpName !== "phone") {
    const mock = newMock(); const ctx = await ctxFor(browser, mock, vp); const page = await ctx.newPage(); const W = watch(page);
    const SA = fs.readFileSync(path.join(ROOT, "articles/saoirse.html"), "utf8");
    await openEdit(page, "articles/vaerek/");
    await caretIn(page, ".art-title h1", 1.0); await page.keyboard.type(" Zq");
    await caretIn(page, ".art-title .art-epithet", 1.0); await page.keyboard.type(" Zw");
    const n0 = mock.log.length;
    const b1 = await saveAndWait(page);
    const v = String(mock.file("articles/vaerek.html")), i1 = String(mock.file(IDX)), sa = String(mock.file("articles/saoirse.html")), si = String(mock.file("search-index.js"));
    const commits = writes(mock, n0).filter((e) => e.committed), paths = commits[0] ? commits[0].committed.paths : [];
    const cardNames = [...i1.matchAll(/<a class="index-card[^"]*"[^>]*href="\/articles\/vaerek\/"[^>]*><span>([^<]*)<\/span>/g)].map((m) => m[1]);
    const tocNames = [...i1.matchAll(/<a class="toc-name[^"]*" href="#(?:heroes|kindred)-vaerek">([^<]*)<\/a>/g)].map((m) => m[1]);
    check(`[${vpName}] rename: one commit; both copies of the page get the new name in <title>/og:title and "Name, Epithet" descriptions`, /Saved at/.test(b1) && commits.length === 1 && v === String(mock.file("articles/vaerek/index.html")) && v.includes("<title>Vaerek Rathkin Zq - Elorae</title>") && v.includes('og:title" content="Vaerek Rathkin Zq"') && v.includes('name="description" content="Vaerek Rathkin Zq, Wreathbound Ranger Zw. Bastard'), b1.slice(0, 60) + " " + commits.length);
    const cardEps = [...i1.matchAll(/<a class="index-card[^"]*"[^>]*href="\/articles\/vaerek\/"([^>]*)>/g)].map((m) => (/data-epithet="([^"]*)"/.exec(m[1]) || [])[1]);
    check(`[${vpName}] rename: every Vaerek card (Heroes + Kindred) and its Index panel entry renamed, card epithet (data-epithet) follows, both Index copies`, cardNames.length === 2 && cardNames.every((n) => n === "Vaerek Rathkin Zq") && cardEps.length === 2 && cardEps.every((e) => e === "Wreathbound Ranger Zw") && tocNames.length === 2 && tocNames.every((n) => n === "Vaerek Rathkin Zq") && i1 === String(mock.file(IDX2)), JSON.stringify({ cardNames, tocNames }));
    const linkOld = (t) => (t.match(/<a class="toc-name[^"]*" href="\/articles\/vaerek\/">Vaerek Rathkin<\/a>|<li><a href="\/articles\/vaerek\/">Vaerek Rathkin<\/a>/g) || []).length;
    const prose = (t) => (t.match(/Vaerek Rathkin(?! Zq)/g) || []).length;
    check(`[${vpName}] rename: other articles' category rail + related lists follow (both copies); lore text untouched; search entry renamed`, linkOld(SA) > 0 && linkOld(sa) === 0 && prose(sa) === prose(SA) - linkOld(SA) && sa === String(mock.file("articles/saoirse/index.html")) && /\{"title":"Vaerek Rathkin Zq","href":"articles\/vaerek\.html"/.test(si) && paths.includes("search-index.js") && paths.includes("articles/saoirse.html"), `files ${paths.length}`);
    // Epithet only: the page's descriptions + every card's data-epithet (both Index copies); nothing else.
    const n1 = mock.log.length, keep = ["search-index.js", "articles/saoirse.html"].map((p) => String(mock.file(p))), i1b = String(mock.file(IDX));
    await page.evaluate(() => window.EloraeEditor.tryEnterEdit()); await page.waitForSelector("#ee-save", { timeout: 15000 }); await page.waitForTimeout(250);
    await caretIn(page, ".art-title .art-epithet", 1.0); await page.keyboard.type(" Zx & \"Q\"");
    const b2 = await saveAndWait(page);
    const c2 = writes(mock, n1).filter((e) => e.committed), p2 = c2[0] ? c2[0].committed.paths : [];
    const v2 = String(mock.file("articles/vaerek.html")), i2 = String(mock.file(IDX));
    const onlyEp = i2.replace(/ data-epithet="Wreathbound Ranger Zw Zx &amp; &quot;Q&quot;"/g, ' data-epithet="Wreathbound Ranger Zw"') === i1b && (i2.match(/data-epithet="Wreathbound Ranger Zw Zx &amp; &quot;Q&quot;"/g) || []).length === 2;
    check(`[${vpName}] epithet change: page + descriptions + both Vaerek cards' data-epithet (escaped), both Index copies, one commit; search/other pages untouched`, /Saved at/.test(b2) && v2.includes('Wreathbound Ranger Zw Zx') && c2.length === 1 && onlyEp && i2 === String(mock.file(IDX2)) && ["search-index.js", "articles/saoirse.html"].every((p, k) => String(mock.file(p)) === keep[k]), b2.slice(0, 50) + " " + JSON.stringify(p2));
    // Clearing the epithet drops the attribute from the cards.
    const n2 = mock.log.length;
    await page.evaluate(() => window.EloraeEditor.tryEnterEdit()); await page.waitForSelector("#ee-save", { timeout: 15000 }); await page.waitForTimeout(250);
    await page.evaluate(() => { const e = document.querySelector(".art-title .art-epithet"); e.focus(); const r = document.createRange(); r.selectNodeContents(e); const s = getSelection(); s.removeAllRanges(); s.addRange(r); });
    await page.keyboard.press("Backspace");
    const b3 = await saveAndWait(page);
    const i3 = String(mock.file(IDX));
    const eps3 = [...i3.matchAll(/<a class="index-card[^"]*"[^>]*href="\/articles\/vaerek\/"[^>]*>/g)].map((m) => m[0]);
    check(`[${vpName}] epithet cleared: the cards lose data-epithet (no hover reveal), both Index copies`, /Saved at/.test(b3) && eps3.length === 2 && eps3.every((t) => !/data-epithet/.test(t)) && i3 === String(mock.file(IDX2)), b3.slice(0, 50) + " " + eps3.join(" "));
    check(`[${vpName}] rename: no page errors`, W.errs.length === 0, W.errs.join(" | "));
    await ctx.close();
  }
}

(async () => {
  const srv = await serverForTests();
  BASE = srv.base;
  console.log("Serving " + ROOT + " at " + BASE);
  const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ["--no-sandbox"] });
  const counts = {};
  const only = process.env.ONLY || "";
  try {
    for (const vpName of ["desktop", "phone", "tablet"]) {
      for (const [name, fn] of [["size", sizeTests], ["diff", (b, v) => diffTests(b, v, counts[v] = {})], ["flow", flowTests], ["batch2", batch2Tests], ["align", alignTests], ["recent", recentTests], ["indexart", indexArtTests], ["artset", artSetTests], ["subsec", subsecTests], ["delete", deleteTests]]) {
        if (only && only.split(",").indexOf(name) < 0) continue;
        if (vpName === "tablet" && name !== "indexart" && name !== "artset" && name !== "subsec") continue; // tablet: Index cards + art flows only
        try { await fn(browser, vpName); } catch (e) { check(`[${vpName}] ${name} stage ran without exceptions`, false, e.stack.split("\n").slice(0, process.env.LONGERR ? 14 : 3).join(" ")); }
      }
    }
  } finally {
    await browser.close(); srv.close();
  }
  if (Object.keys(counts).length) console.log("One-word-edit diff lines: " + JSON.stringify(counts));
  const fail = results.filter((r) => !r.ok);
  console.log(`\n${results.length - fail.length}/${results.length} passed`);
  fs.writeFileSync(path.join(OUT, "results.json"), JSON.stringify({ results, counts }, null, 2));
  process.exit(fail.length ? 1 : 0);
})();
