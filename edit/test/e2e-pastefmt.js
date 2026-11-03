/* E2E: copy / paste inside the editor keeps formatting (editor.js pf1).
   Copy a mixed selection (heading, bold/italic/underline, a sized span, a link, a line break,
   a captioned picture, a Caption-style line, a small line) and paste it elsewhere and on
   another article: every look survives. Pasted text keeps ITS OWN look: a small line pasted
   on a new line under a big line or a heading stays small; pasted mid-line it keeps its size
   (span or split) and the rest of the line keeps its own. Undo, save, foreign paste unchanged.
   Desktop 1440 and phone 390. Run: PLAYWRIGHT=<path> CHROME=/usr/bin/google-chrome node edit/test/e2e-pastefmt.js */
"use strict";
const { chromium } = require(process.env.PLAYWRIGHT || "playwright-core");
const { MockGitHub } = require("./mock-github.js");
const { serverForTests, ROOT } = require("./server.js");
const REPO = "195142095142091920/elorae";
const PROFILES = { repo: REPO, profiles: { "devin-gh": { name: "Devin", person: "devin", role: "admin", title: "GM", permissions: ["**"], save: "direct" } } };
const results = [];
function check(name, ok, detail) { results.push({ name, ok: !!ok, detail }); console.log((ok ? "PASS " : "FAIL ") + name + (detail ? "  — " + detail : "")); }
let BASE, mock;
const VPS = [
  { name: "desktop", opts: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 } },
  { name: "phone", opts: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } }
];
async function ctxFor(browser, vp) {
  const ctx = await browser.newContext(Object.assign({ reducedMotion: "reduce" }, vp.opts));
  await ctx.route("https://api.github.com/**", (r) => mock.handle(r));
  await ctx.route((u) => !u.href.startsWith(BASE) && !u.href.startsWith("data:") && !u.href.startsWith("blob:") && !u.href.startsWith("https://api.github.com"), (r) => r.abort());
  const sess = JSON.stringify({ token: "ghp_test_devin", login: "devin-gh", person: "devin", role: "admin", remember: true });
  await ctx.addInitScript(`try{localStorage.setItem("elorae-edit-session",${JSON.stringify(sess)});localStorage.setItem("elorae-login","devin");document.cookie="elorae-login=devin;path=/";}catch(e){}`);
  return ctx;
}
function watch(page) { const errs = []; page.on("pageerror", (e) => errs.push(e.message)); page.on("dialog", (d) => d.accept().catch(() => {})); return errs; }
async function openEdit(page, url) {
  await page.goto(BASE + url, { waitUntil: "load" });
  await page.waitForFunction(() => window.EloraeEditor && window.EloraeEditor.state && window.EloraeEditor.state.profile, null, { timeout: 15000 });
  await page.evaluate(() => window.EloraeEditor.tryEnterEdit());
  await page.waitForSelector("#ee-save", { timeout: 15000 }); await page.waitForTimeout(300);
}
async function saveNow(page) {
  await page.click("#ee-save");
  await page.waitForFunction(() => /Saved at|failed|refused|pull request|No changes/i.test((document.getElementById("ee-bar") || {}).textContent || ""), null, { timeout: 30000 });
  await page.waitForTimeout(300);
}
// Page helpers (installed in the page).
const HELPERS = () => {
  window.__pf = {
    find(text) {
      const w = document.createTreeWalker(document.querySelector("main"), NodeFilter.SHOW_TEXT); let t;
      while ((t = w.nextNode())) { const i = t.nodeValue.indexOf(text); if (i >= 0) return { node: t, off: i }; }
      throw new Error("not found: " + text);
    },
    select(a, b) { // from the start of text a to the end of text b
      const s = this.find(a), e = this.find(b), r = document.createRange();
      r.setStart(s.node, s.off); r.setEnd(e.node, e.off + b.length);
      document.querySelector("main").focus({ preventScroll: true });
      getSelection().removeAllRanges(); getSelection().addRange(r);
    },
    caret(text, atEnd) { const s = this.find(text), r = document.createRange(); r.setStart(s.node, s.off + (atEnd ? text.length : 0)); r.collapse(true); document.querySelector("main").focus({ preventScroll: true }); getSelection().removeAllRanges(); getSelection().addRange(r); },
    copy(type) {
      const dt = new DataTransfer(), n = getSelection().anchorNode, el = n.nodeType === 1 ? n : n.parentElement;
      const ev = new ClipboardEvent(type || "copy", { clipboardData: dt, bubbles: true, cancelable: true });
      el.dispatchEvent(ev);
      return { html: dt.getData("text/html"), text: dt.getData("text/plain"), handled: ev.defaultPrevented };
    },
    paste(clip) {
      const dt = new DataTransfer(); dt.setData("text/html", clip.html); dt.setData("text/plain", clip.text);
      const n = getSelection().anchorNode, el = n.nodeType === 1 ? n : n.parentElement;
      el.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }));
    },
    size(text) { const s = this.find(text); return parseFloat(getComputedStyle(s.node.parentElement).fontSize); },
    blockOf(text) { const s = this.find(text); return s.node.parentElement.closest("p,h1,h2,h3,h4,li,figcaption"); }
  };
};
// Test content added to the Lore section (Devin builds it like the style bar would).
const FIXTURE = `<h2 id="pf-h">Head Zh</h2>
<p class="art-life ee-pt-24">Big line Zb words here</p>
<p class="art-life">Lead <strong>bold Zbo</strong> and <em>ital Zi</em> and <u>under Zu</u> with <span class="ee-pt-18 ee-serif">eighteen Z18</span><br>second line <a href="/codex/lore/">link Zl</a></p>
<figure><img src="/favicon.svg" alt="Pic"><figcaption>Cap Zc</figcaption></figure>
<p class="art-life ee-caption">Caption style Zq</p>
<p class="art-life ee-pt-12 ee-sans">Small line Zs</p>
<p class="art-life ee-al-center">Plain centred Zp</p>`;

async function run(browser, vp) {
  const V = "[" + vp.name + "] ";
  const ctx = await ctxFor(browser, vp), page = await ctx.newPage(), errs = watch(page);
  const A = "articles/aghor/", AP = "articles/aghor/index.html";
  await openEdit(page, A);
  await page.evaluate(HELPERS);
  await page.evaluate((fx) => { const p = document.querySelector("main.art-body #lore p:last-of-type") || document.querySelector("main.art-body p"); p.insertAdjacentHTML("afterend", fx); }, FIXTURE);
  const body0 = await page.evaluate(() => { const p = document.querySelector("main.art-body #lore p.art-life:not([class*=ee-])") || document.querySelector("main.art-body p"); return parseFloat(getComputedStyle(p).fontSize); });

  // 1) Copy a mixed selection: heading .. small line.
  await page.evaluate(() => __pf.select("Head Zh", "Small line Zs"));
  const clip = await page.evaluate(() => __pf.copy("copy"));
  check(V + "copy writes the site's HTML with the pf1 marker (and plain text)", clip.handled && /data-ee-clip="pf1"/.test(clip.html) && /ee-pt-24/.test(clip.html) && /ee-pt-18/.test(clip.html) && /<h2>/.test(clip.html) && /Small line Zs/.test(clip.text), clip.html.slice(0, 160));
  check(V + "copy carries no runtime junk (ids, styles, edit marks)", !/\sid=|style=|contenteditable|data-ee-(?!clip)|ee-editable/.test(clip.html), clip.html.slice(0, 200));

  // 2) Paste it on a new empty line under the big line (another spot on the page).
  await page.evaluate(() => __pf.caret("Plain centred Zp", true));
  await page.keyboard.press("Enter");
  await page.evaluate((c) => __pf.paste(c), clip);
  await page.waitForTimeout(200);
  const r1 = await page.evaluate(() => {
    const all = (t) => { const out = []; const w = document.createTreeWalker(document.querySelector("main"), NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) if (n.nodeValue.indexOf(t) >= 0) out.push(n.parentElement); return out; };
    const last = (t) => { const a = all(t); return a[a.length - 1]; };
    const fs = (el) => parseFloat(getComputedStyle(el).fontSize);
    const h = last("Head Zh"), big = last("Big line Zb"), bo = last("bold Zbo"), it = last("ital Zi"), u = last("under Zu"), e18 = last("eighteen Z18"), l = last("link Zl"), cap = last("Cap Zc"), q = last("Caption style Zq"), s = last("Small line Zs");
    const firstFs = (t) => fs(all(t)[0]);
    return {
      n: all("Head Zh").length, h: h.tagName, big: big.className, bigSame: fs(big) === firstFs("Big line Zb"),
      bo: bo.tagName, it: it.tagName, u: u.tagName, e18: e18.className, e18Same: fs(e18) === firstFs("eighteen Z18") && getComputedStyle(e18).fontFamily === getComputedStyle(all("eighteen Z18")[0]).fontFamily,
      br: !!l.closest("p").querySelector("br"), href: l.getAttribute("href"),
      fig: !!(cap.closest("figure") && cap.closest("figure").querySelector("img")) && cap.tagName === "FIGCAPTION",
      q: q.className, qSame: fs(q) === firstFs("Caption style Zq"), s: s.className, sSame: fs(s) === firstFs("Small line Zs")
    };
  });
  check(V + "paste: heading stays a heading", r1.n === 2 && r1.h === "H2", JSON.stringify(r1));
  check(V + "paste: big (24pt) line keeps its size", /ee-pt-24/.test(r1.big) && r1.bigSame, r1.big);
  check(V + "paste: bold / italic / underline survive", r1.bo === "STRONG" && r1.it === "EM" && r1.u === "U");
  check(V + "paste: sized + font span survives (18pt serif)", /ee-pt-18/.test(r1.e18) && /ee-serif/.test(r1.e18) && r1.e18Same, r1.e18);
  check(V + "paste: line break and link survive", r1.br && r1.href === "/codex/lore/");
  check(V + "paste: captioned picture survives as figure/img/figcaption", r1.fig);
  check(V + "paste: Caption-style line and small sans line keep their looks", /ee-caption/.test(r1.q) && r1.qSame && /ee-pt-12/.test(r1.s) && /ee-sans/.test(r1.s) && r1.sSame, r1.q + " | " + r1.s);

  // 3) The user's case: a small line pasted on a new line under a BIG line stays small.
  await page.evaluate(() => __pf.select("Small line Zs", "Small line Zs"));
  const small = await page.evaluate(() => __pf.copy("copy"));
  await page.evaluate(() => __pf.caret("Big line Zb words here", true));
  await page.keyboard.press("Enter");
  const newCls = await page.evaluate(() => { const n = getSelection().anchorNode; return (n.nodeType === 1 ? n : n.parentElement).closest("p").className; });
  await page.evaluate((c) => __pf.paste(c), small);
  await page.waitForTimeout(150);
  const r2 = await page.evaluate(() => { const b = __pf.find("Big line Zb words here").node.parentElement.closest("p"); const nx = b.nextElementSibling; return { cls: nx.className, txt: nx.textContent, fs: parseFloat(getComputedStyle(nx).fontSize), small: __pf.size("Small line Zs"), big: parseFloat(getComputedStyle(b).fontSize) }; });
  check(V + "under a big line: the new line was big before the paste (Enter copies the size)", /ee-pt-24/.test(newCls), newCls);
  check(V + "under a big line: pasted small line stays small (own size, not the line above)", r2.txt === "Small line Zs" && /ee-pt-12/.test(r2.cls) && !/ee-pt-24/.test(r2.cls) && r2.fs === r2.small && r2.fs < r2.big, JSON.stringify(r2));

  // 3b) Under a heading: a body line pasted on the new line stays a paragraph.
  await page.evaluate(() => __pf.select("Plain centred Zp", "Plain centred Zp"));
  const plainC = await page.evaluate(() => __pf.copy("copy"));
  await page.evaluate(() => __pf.caret("Head Zh", true));
  await page.keyboard.press("Enter");
  await page.evaluate((c) => __pf.paste(c), plainC);
  await page.waitForTimeout(150);
  const r3 = await page.evaluate(() => { const h = __pf.find("Head Zh").node.parentElement.closest("h2"); const nx = h.nextElementSibling; return { tag: nx.tagName, cls: nx.className, txt: nx.textContent, fs: parseFloat(getComputedStyle(nx).fontSize), hfs: parseFloat(getComputedStyle(h).fontSize) }; });
  check(V + "under a heading: pasted body line is a paragraph at body size (centred kept)", r3.tag === "P" && r3.txt === "Plain centred Zp" && /art-life/.test(r3.cls) && /ee-al-center/.test(r3.cls) && r3.fs === body0, JSON.stringify(r3) + " body " + body0);

  // 4) Mid-line in the big line: the small paste keeps its size; the big line keeps its own.
  await page.evaluate(() => __pf.caret("words here", false));
  await page.evaluate((c) => __pf.paste(c), small);
  await page.waitForTimeout(150);
  const r4 = await page.evaluate(() => { const s = __pf.find("Small line Zs"); const b = s.node.parentElement.closest("p"); return { inBig: /ee-pt-24/.test(b.className), txt: b.textContent, sfs: parseFloat(getComputedStyle(s.node.parentElement).fontSize), bfs: parseFloat(getComputedStyle(b).fontSize), span: s.node.parentElement.className }; });
  check(V + "mid-line in a big line: pasted small text keeps 12pt sans (span), rest stays 24pt", r4.inBig && r4.txt === "Big line Zb Small line Zswords here" && /ee-pt-12/.test(r4.span) && /ee-sans/.test(r4.span) && r4.sfs === r2.small && r4.bfs === r2.big, JSON.stringify(r4));
  // Default-size text mid-line in the big line: the line is split so it keeps body size.
  await page.evaluate(() => __pf.caret("Big line ", true));
  await page.evaluate((c) => __pf.paste(c), plainC);
  await page.waitForTimeout(150);
  const r5 = await page.evaluate(() => { const ps = Array.from(document.querySelectorAll("main p")); const i = ps.findIndex((p) => /^Big line $/.test(p.textContent)); const mid = ps[i + 1], tail = ps[i + 2]; return { i, head: ps[i] && ps[i].className, mid: mid && mid.textContent, midCls: mid && mid.className, midFs: mid && parseFloat(getComputedStyle(mid).fontSize), tail: tail && tail.textContent, tailCls: tail && tail.className }; });
  check(V + "mid-line, default-size text in a big line: block split, pasted line at body size, both halves stay 24pt", r5.i >= 0 && /ee-pt-24/.test(r5.head) && r5.mid === "Plain centred Zp" && !/ee-pt-24/.test(r5.midCls) && r5.midFs === body0 && /^Zb Small line Zswords here$/.test(r5.tail) && /ee-pt-24/.test(r5.tailCls), JSON.stringify(r5));
  // Undo the split paste (Ctrl+Z), then redo.
  await page.keyboard.press("Control+z");
  const u1 = await page.evaluate(() => Array.from(document.querySelectorAll("main p")).some((p) => p.textContent === "Big line Zb Small line Zswords here" && /ee-pt-24/.test(p.className)));
  await page.keyboard.press("Control+Shift+z");
  const u2 = await page.evaluate(() => Array.from(document.querySelectorAll("main p")).some((p) => p.textContent === "Plain centred Zp" && p.previousElementSibling && p.previousElementSibling.textContent === "Big line "));
  check(V + "Ctrl+Z undoes a formatted paste, Ctrl+Shift+Z redoes it", u1 && u2, JSON.stringify({ u1, u2 }));
  // Bold caret: pasted plain text does not inherit the bold it lands in.
  await page.evaluate(() => __pf.caret("Zbo", false));
  await page.evaluate((c) => __pf.paste(c), { html: '<div data-ee-clip="pf1"><p class="art-life">plainword</p></div>', text: "plainword" });
  check(V + "pasted text never inherits the bold it lands in", await page.evaluate(() => !__pf.find("plainword").node.parentElement.closest("strong")));

  // 4b) Real keyboard copy / paste (the browser's own clipboard): Ctrl+C a small line, Ctrl+V on a new line under the big one.
  if (vp.name === "desktop") {
    await page.evaluate(() => __pf.select("Small line Zs", "Small line Zs"));
    await page.keyboard.press("Control+c");
    await page.evaluate(() => __pf.caret("words here", true));
    await page.keyboard.press("Enter");
    await page.evaluate(() => { window.__pfSeen = null; document.addEventListener("paste", (e) => { window.__pfSeen = { html: e.clipboardData.getData("text/html"), text: e.clipboardData.getData("text/plain") }; }, { capture: true, once: true }); });
    await page.keyboard.press("Control+v");
    await page.waitForTimeout(300);
    const rk = await page.evaluate(() => { const ps = Array.from(document.querySelectorAll("main p")); const i = ps.findIndex((p) => /Zswords here$/.test(p.textContent)); const nx = ps[i + 1]; return { txt: nx && nx.textContent, cls: nx && nx.className }; });
    check(V + "real Ctrl+C / Ctrl+V: small line pasted under a big line stays 12pt sans", rk.txt === "Small line Zs" && /ee-pt-12/.test(rk.cls) && /ee-sans/.test(rk.cls) && !/ee-pt-24/.test(rk.cls), JSON.stringify(rk) + " " + JSON.stringify(await page.evaluate(() => window.__pfSeen)).slice(0, 300));
  }

  // 5) Cut keeps formatting too.
  await page.evaluate(() => __pf.select("eighteen Z18", "eighteen Z18"));
  const cut = await page.evaluate(() => __pf.copy("cut"));
  const cutGone = await page.evaluate(() => { try { const all = []; const w = document.createTreeWalker(document.querySelector("main"), NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) if (n.nodeValue.indexOf("eighteen Z18") >= 0) all.push(n); return all.length; } catch (e) { return -1; } });
  check(V + "cut: copies the 18pt serif span and removes it", /ee-pt-18 ee-serif|ee-serif ee-pt-18/.test(cut.html) && cutGone === 1, cutGone + " " + cut.html.slice(0, 120));

  // 6) Foreign paste unchanged: fonts / styles stripped.
  await page.evaluate(() => __pf.caret("Plain centred Zp", true));
  await page.evaluate(() => __pf.paste({ html: '<p><span style="font-size:30pt;font-family:Comic Sans MS" class="MsoNormal">Foreign Zf</span> <b>fb</b></p>', text: "Foreign Zf fb" }));
  await page.waitForTimeout(200);
  const fz = await page.evaluate(() => __pf.find("Foreign Zf").node.parentElement.closest("p").outerHTML);
  check(V + "foreign paste still cleaned (no fonts, sizes or foreign classes; bold kept)", await page.evaluate(() => { const e = __pf.find("Foreign Zf").node.parentElement; const p = e.closest("p"); return !p.hasAttribute("style") && !p.querySelector("[style],.MsoNormal,span,font") && !!Array.from(document.querySelectorAll("main strong")).find((s) => s.textContent === "fb"); }), fz);

  // 7) Save: the source keeps the classes, and nothing from edit mode.
  await saveNow(page);
  const src = String(mock.file(AP));
  check(V + "saved source keeps the pasted looks", /<p class="art-life ee-pt-12 ee-sans">Small line Zs<\/p>/.test(src) && /<span class="ee-pt-12 ee-sans">Small line Zs<\/span>/.test(src) && /<u>under Zu<\/u>/.test(src) && /<figure><img src="\/favicon.svg" alt="Pic"><figcaption>Cap Zc<\/figcaption><\/figure>/.test(src) && /class="art-life ee-caption"/.test(src), (src.match(/Small line Zs[\s\S]{0,60}/) || [""])[0]);
  check(V + "saved source has no edit-mode marks", !/data-ee-|ee-editable|contenteditable/.test(src));
  check(V + "no page errors", !errs.length, errs.join(" | "));
  await ctx.close();

  // 8) Paste into ANOTHER article (journal-style page) keeps the looks too.
  const ctx2 = await ctxFor(browser, vp), p2 = await ctx2.newPage(), errs2 = watch(p2);
  await openEdit(p2, "articles/vaerek/");
  await p2.evaluate(HELPERS);
  await p2.evaluate(() => { const p = document.querySelector("main.art-body #lore p, main.art-body p"); const r = document.createRange(); r.selectNodeContents(p); r.collapse(false); document.querySelector("main").focus({ preventScroll: true }); getSelection().removeAllRanges(); getSelection().addRange(r); });
  await p2.keyboard.press("Enter");
  await p2.evaluate((c) => __pf.paste(c), clip);
  await p2.waitForTimeout(200);
  const r8 = await p2.evaluate(() => ({ h: __pf.blockOf("Head Zh").tagName, big: __pf.blockOf("Big line Zb").className, e18: __pf.find("eighteen Z18").node.parentElement.className, cap: __pf.blockOf("Cap Zc").tagName, s: __pf.blockOf("Small line Zs").className, bodyCls: __pf.blockOf("Lead").className }));
  check(V + "another article: heading, 24pt, 18pt serif span, figure caption, small line all survive (body class of the new page)", r8.h === "H2" && /ee-pt-24/.test(r8.big) && /ee-pt-18/.test(r8.e18) && r8.cap === "FIGCAPTION" && /ee-pt-12/.test(r8.s) && /art-li(fe|ne)/.test(r8.bodyCls) && r8.s.split(" ")[0] === r8.bodyCls, JSON.stringify(r8));
  check(V + "another article: no page errors", !errs2.length, errs2.join(" | "));
  await ctx2.close();
}

(async () => {
  const srv = await serverForTests(); BASE = srv.base;
  mock = new MockGitHub({ repo: REPO, root: ROOT, tokens: { "ghp_test_devin": "devin-gh" }, overrides: { "edit/profiles.json": JSON.stringify(PROFILES, null, 2) } });
  const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ["--no-sandbox"] });
  try {
    for (const vp of VPS) await run(browser, vp);
  } finally { await browser.close(); srv.close(); }
  const ok = results.filter((r) => r.ok).length;
  console.log(`\n${ok}/${results.length} passed`);
  process.exit(ok === results.length ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(2); });
