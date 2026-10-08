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
  "sawyer-gh": { name: "Sawyer", person: "sawyer", role: "editor", permissions: ["articles/vaerek.html"], save: "pr" } } };
const results = [];
function check(name, ok, detail) { results.push({ name, ok: !!ok, detail }); console.log((ok ? "PASS " : "FAIL ") + name + (detail ? "  — " + detail : "")); }
function newMock() { return new MockGitHub({ repo: REPO, root: ROOT, tokens: { "ghp_test_devin": "devin-gh", "ghp_test_sawyer": "sawyer-gh" }, overrides: { "edit/profiles.json": JSON.stringify(PROFILES, null, 2) } }); }
const VPS = { desktop: { width: 1366, height: 860 }, phone: { width: 390, height: 844 } };
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
  // Body text is 14pt on desktop and 12pt (16px) on phones.
  check(`[${vpName}] caret Size 12: class on the paragraph, 16px font, line box follows`, /\bee-pt-12\b/.test(i12.cls) && Math.abs(i12.fs - 16) < 0.1 && (i0.fs > 16.5 ? i12.h < i0.h : i12.h <= i0.h), `fs ${i0.fs}→${i12.fs} h ${i0.h}→${i12.h}`);
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
    check(`[${vpName}] hero Save: one commit writes the new hero src (both copies), nothing else`, heroSrc && heroSrc !== src0 && heroSrc.indexOf("/assets/") === 0 && n <= 2 && String(mock.file("articles/aghor.html")) === saved, `hero ${heroSrc}, diff lines ${n}`);
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
    check(`[${vpName}] admin: hero name + epithet editable, saved in place (no ending period, single line)`, ed.h1 && ed.ep && saved.includes("<h1>Vaerek Rathkin Zq</h1>") && saved.includes('<p class="art-epithet">Wreathbound Ranger of Zq</p>') && n <= 2 && String(mock.file("articles/vaerek.html")) === saved, `diff lines ${n}`);
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
    check(`[${vpName}] player: no Edit on someone else's article`, !(await page2.$("#ee-glyph")) && !(await page2.evaluate(() => window.EloraeEditor.tryEnterEdit())));
    check(`[${vpName}] player tests: no page errors`, W.errs.length === 0, W.errs.join(" | "));
    await ctx.close();
  }
  // 4/5. Gallery Insert goes at the caret; pasted pictures wait for Save and go in one commit.
  {
    const mock = newMock(); const ctx = await ctxFor(browser, mock, vp); const page = await ctx.newPage(); const W = watch(page);
    const file = "articles/aghor/index.html";
    await openEdit(page, "articles/aghor/");
    const t0 = await caretIn(page, LORE, 0.5);
    await page.click("#ee-art"); await page.waitForSelector(".ee-gal-item", { timeout: 10000 }).catch(() => {});
    await page.check('input[name="ee-gal-act"][value="insert"]');
    await page.click(".ee-gal-item"); await page.waitForTimeout(400);
    const g = await page.evaluate(() => { const im = window.__el.querySelector("img"); if (!im) return null; const r = document.createRange(); r.setStart(window.__el, 0); r.setEndBefore(im); return { before: r.toString().length, total: window.__el.textContent.length, src: im.getAttribute("src") }; });
    check(`[${vpName}] gallery Insert: picture goes at the caret (mid-paragraph), not the page end`, g && Math.abs(g.before - Math.round(t0.length * 0.5)) <= 1 && /^\/assets\//.test(g.src), JSON.stringify(g));
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

(async () => {
  const srv = await serverForTests();
  BASE = srv.base;
  console.log("Serving " + ROOT + " at " + BASE);
  const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ["--no-sandbox"] });
  const counts = {};
  const only = process.env.ONLY || "";
  try {
    for (const vpName of ["desktop", "phone"]) {
      for (const [name, fn] of [["size", sizeTests], ["diff", (b, v) => diffTests(b, v, counts[v] = {})], ["flow", flowTests], ["batch2", batch2Tests]]) {
        if (only && only.split(",").indexOf(name) < 0) continue;
        try { await fn(browser, vpName); } catch (e) { check(`[${vpName}] ${name} stage ran without exceptions`, false, e.stack.split("\n").slice(0, 3).join(" ")); }
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
