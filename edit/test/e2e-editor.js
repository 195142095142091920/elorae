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
  "devin-gh": { name: "Devin", person: "devin", role: "admin", title: "GM", permissions: ["**"], save: "direct" } } };
const results = [];
function check(name, ok, detail) { results.push({ name, ok: !!ok, detail }); console.log((ok ? "PASS " : "FAIL ") + name + (detail ? "  — " + detail : "")); }
function newMock() { return new MockGitHub({ repo: REPO, root: ROOT, tokens: { "ghp_test_devin": "devin-gh" }, overrides: { "edit/profiles.json": JSON.stringify(PROFILES, null, 2) } }); }
const VPS = { desktop: { width: 1366, height: 860 }, phone: { width: 390, height: 844 } };
let BASE;

async function ctxFor(browser, mock, vp) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1, reducedMotion: "reduce" });
  await ctx.route("https://api.github.com/**", (r) => mock.handle(r));
  await ctx.route((u) => u.href.startsWith(BASE) && /\/edit\/(visibility\.json|secrets\/[^/?]+\.json)$/.test(u.pathname), (r) => {
    const t = mock.file(new URL(r.request().url()).pathname.replace(/^\//, ""));
    return t == null ? r.fulfill({ status: 404, body: "" }) : r.fulfill({ status: 200, contentType: "application/json", body: t });
  });
  await ctx.route((u) => !u.href.startsWith(BASE) && !u.href.startsWith("data:") && !u.href.startsWith("https://api.github.com"), (r) => r.abort());
  // Signed-in site owner (passes the login gate) with a remembered edit session.
  const sess = JSON.stringify({ token: "ghp_test_devin", login: "devin-gh", person: "devin", role: "admin", remember: true });
  await ctx.addInitScript(`try{localStorage.setItem("elorae-edit-session",${JSON.stringify(sess)});localStorage.setItem("elorae-login","devin");document.cookie="elorae-login=devin;path=/";}catch(e){}`);
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
    const saved = mock.file(file);
    const n = saved === orig ? 0 : diffLines(orig, saved, vpName + "-" + file.replace(/\W+/g, "_"));
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
  // Hero set from gallery: back to the normal edit bar; lost bar recovers via Edit.
  {
    const mock = newMock(); const ctx = await ctxFor(browser, mock, VPS[vpName]); const page = await ctx.newPage(); watch(page);
    await openEdit(page, "articles/aghor/");
    await page.click("#ee-art"); await page.waitForSelector(".ee-gal-item", { timeout: 10000 }).catch(() => {});
    const n0 = mock.log.length;
    const item = await page.$(".ee-gal-item");
    if (item) { await item.click(); await page.waitForTimeout(1500); }
    const after = await page.evaluate(() => ({ save: !!document.getElementById("ee-save"), cancel: !!document.getElementById("ee-cancel"), x: !!document.getElementById("ee-x"), editing: window.EloraeEditor.state.editing, bar: (document.getElementById("ee-bar") || {}).textContent }));
    const committed = mock.log.slice(n0).some((e) => e.method !== "GET");
    check(`[${vpName}] hero set: normal edit bar (Save/Cancel), no stranding Close`, item && committed && after.save && after.cancel && !after.x && after.editing, JSON.stringify(after).slice(0, 160));
    await page.evaluate(() => document.getElementById("ee-bar").remove());
    await page.evaluate(() => window.EloraeEditor.tryEnterEdit());
    await page.waitForTimeout(200);
    check(`[${vpName}] edit mode without a bar recovers via Edit`, !!(await page.$("#ee-save")) && !!(await page.$("#ee-cancel")));
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

(async () => {
  const srv = await serverForTests();
  BASE = srv.base;
  console.log("Serving " + ROOT + " at " + BASE);
  const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ["--no-sandbox"] });
  const counts = {};
  const only = process.env.ONLY || "";
  try {
    for (const vpName of ["desktop", "phone"]) {
      for (const [name, fn] of [["size", sizeTests], ["diff", (b, v) => diffTests(b, v, counts[v] = {})], ["flow", flowTests]]) {
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
