/* E2E: pictures with captions in the editor (editor.js ic1).
   Image on the edit bar -> gallery (insert-only) -> <figure><img><figcaption> at the caret, caption
   placeholder, empty captions never saved, Add / Remove caption on existing pictures (Journal),
   upload (2400px WebP shrink) as a captioned figure, players only on their own pages without
   upload, rich paste still works. Run: PLAYWRIGHT=<path> CHROME=/usr/bin/google-chrome node edit/test/e2e-caption.js
   SHOTS=<dir> also writes img-caption-edit-1440.png. */
"use strict";
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const { chromium } = require(process.env.PLAYWRIGHT || "playwright-core");
const { MockGitHub } = require("./mock-github.js");
const { serverForTests, ROOT } = require("./server.js");
const REPO = "195142095142091920/elorae";
const OUT = process.env.SHOTS || "/tmp/ee-caption";
fs.mkdirSync(OUT, { recursive: true });
const PROFILES = { repo: REPO, profiles: {
  "devin-gh": { name: "Devin", person: "devin", role: "admin", title: "GM", permissions: ["**"], save: "direct" },
  "sawyer-gh": { name: "Sawyer", person: "sawyer", role: "editor", permissions: ["articles/vaerek.html"], save: "pr" } } };
const results = [];
function check(name, ok, detail) { results.push({ name, ok: !!ok, detail }); console.log((ok ? "PASS " : "FAIL ") + name + (detail ? "  — " + detail : "")); }
let BASE, mock;
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
async function ctxFor(browser, who) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, reducedMotion: "reduce" });
  await ctx.route("https://api.github.com/**", (r) => mock.handle(r));
  await ctx.route((u) => !u.href.startsWith(BASE) && !u.href.startsWith("data:") && !u.href.startsWith("blob:") && !u.href.startsWith("https://api.github.com"), (r) => r.abort());
  const sess = JSON.stringify({ token: "ghp_test_" + who, login: who + "-gh", person: who, role: who === "devin" ? "admin" : "editor", remember: true });
  await ctx.addInitScript(`try{localStorage.setItem("elorae-edit-session",${JSON.stringify(sess)});localStorage.setItem("elorae-login",${JSON.stringify(who)});document.cookie="elorae-login=${who};path=/";}catch(e){}`);
  return ctx;
}
function watch(page) { const errs = []; page.on("pageerror", (e) => errs.push(e.message)); page.on("dialog", (d) => d.accept().catch(() => {})); return errs; }
async function openEdit(page, url) {
  await page.goto(BASE + url, { waitUntil: "load" });
  await page.waitForFunction(() => window.EloraeEditor && window.EloraeEditor.state && window.EloraeEditor.state.profile, null, { timeout: 15000 });
  await page.evaluate(() => window.EloraeEditor.tryEnterEdit());
  await page.waitForSelector("#ee-save", { timeout: 15000 }); await page.waitForTimeout(300);
}
async function caretEnd(page, sel) {
  await page.evaluate((s) => { const el = document.querySelector(s); el.scrollIntoView({ block: "center" }); const r = document.createRange(); r.selectNodeContents(el); r.collapse(false); el.closest(".ee-editable").focus(); getSelection().removeAllRanges(); getSelection().addRange(r); }, sel);
}
async function saveNow(page) {
  await page.click("#ee-save");
  await page.waitForFunction(() => /Saved at|failed|refused|pull request|No changes/i.test((document.getElementById("ee-bar") || {}).textContent || ""), null, { timeout: 30000 });
  await page.waitForTimeout(300);
}
const T = (p) => { const v = mock.file(p); return v == null ? null : String(v); };
const figs = (t) => (t.match(/<figure>[\s\S]*?<\/figure>/g) || []);

(async () => {
  const srv = await serverForTests(); BASE = srv.base;
  mock = new MockGitHub({ repo: REPO, root: ROOT, tokens: { "ghp_test_devin": "devin-gh", "ghp_test_sawyer": "sawyer-gh" }, overrides: { "edit/profiles.json": JSON.stringify(PROFILES, null, 2) } });
  const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ["--no-sandbox"] });
  try {
    // ---- 1) Article: gallery picture -> captioned figure after the caret's paragraph ----
    let ctx = await ctxFor(browser, "devin"), page = await ctx.newPage(), errs = watch(page);
    const A = "articles/aghor/", AP = "articles/aghor/index.html", AP2 = "articles/aghor.html";
    const f0 = figs(T(AP)).length;
    await openEdit(page, A);
    check("article: Image button on the edit bar", !!(await page.$("#ee-img")));
    await caretEnd(page, "main.art-body #lore p");
    await page.click("#ee-img");
    await page.waitForSelector("#ee-gal-grid [data-gal-id]", { timeout: 15000 });
    check("article: opens the gallery in insert-only mode (no Hero choice)", /Insert image/.test(await page.textContent("#ee-body")) && !(await page.$('input[name="ee-gal-act"]')));
    check("article: upload offered to Devin", await page.isVisible("#ee-art-form"));
    await page.click("#ee-gal-grid [data-gal-id]");
    await page.waitForTimeout(300);
    const ins = await page.evaluate(() => {
      const f = document.querySelector("main.art-body figure"); if (!f) return null;
      const fc = f.querySelector("figcaption"), prev = f.previousElementSibling, sel = getSelection().anchorNode;
      return { img: !!f.querySelector(":scope > img"), fc: !!fc, empty: fc && fc.hasAttribute("data-ee-empty"), ph: fc && getComputedStyle(fc, "::before").content,
        after: prev && prev.matches("#lore p"), caret: !!(sel && fc && fc.contains(sel)), inP: !!f.closest("p") };
    });
    check("article: inserted as <figure><img><figcaption> after the paragraph (not inside it)", ins && ins.img && ins.fc && ins.after && !ins.inP, JSON.stringify(ins));
    check("article: empty caption shows 'Add a caption' and holds the caret", ins && ins.empty && /Add a caption/.test(ins.ph || "") && ins.caret, ins && ins.ph);
    await page.evaluate(() => document.querySelector("main.art-body figure").scrollIntoView({ block: "center" }));
    await page.screenshot({ path: path.join(OUT, "img-caption-edit-1440.png") });
    await page.keyboard.type("The Creator at rest");
    check("article: typing fills the caption (placeholder gone)", await page.evaluate(() => { const fc = document.querySelector("main.art-body figure figcaption"); return fc.textContent === "The Creator at rest" && !fc.hasAttribute("data-ee-empty"); }));
    // A second picture, caption left empty.
    await caretEnd(page, "main.art-body figure figcaption");
    await page.keyboard.press("Enter");
    const enterOk = await page.evaluate(() => { const n = getSelection().anchorNode, el = n.nodeType === 1 ? n : n.parentElement; return !!el.closest("p") && el.closest("p").previousElementSibling.tagName === "FIGURE"; });
    check("article: Enter in a caption starts a paragraph after the picture", enterOk);
    await page.keyboard.type("After the picture.");
    await page.click("#ee-img"); await page.waitForSelector("#ee-gal-grid [data-gal-id]");
    await page.click("#ee-gal-grid [data-gal-id]:nth-child(2)"); await page.waitForTimeout(300);
    await saveNow(page);
    const t1 = T(AP), F = figs(t1);
    check("article: saved with both copies identical", t1 === T(AP2));
    check("article: captioned figure saved in the site's caption markup", F.length === f0 + 2 && /<figure><img src="\/assets\/[^"]+" alt="[^"]*"><figcaption>The Creator at rest<\/figcaption><\/figure>/.test(t1), F.slice(-2).join(" | ").slice(0, 240));
    check("article: the empty caption is not saved", F.length === f0 + 2 && !/<figcaption>\s*<\/figcaption>/.test(t1) && /<figure><img src="\/assets\/[^"]+" alt="[^"]*"><\/figure>/.test(t1));
    check("article: no edit-mode marks saved", !/data-ee-|ee-cap-tools|Add a caption/.test(t1));
    check("article: the paragraph typed after it is saved", /<p[^>]*>After the picture\.<\/p>/.test(t1));
    check("article: no page errors", !errs.length, errs.join(" | "));
    // Public view: caption styled like the Journal; an empty one stays hidden.
    await page.goto(BASE + A, { waitUntil: "load" }).catch(() => {});
    await ctx.close();

    // ---- 2) Journal: Remove / Add caption on an existing picture; upload as a figure ----
    ctx = await ctxFor(browser, "devin"); page = await ctx.newPage(); errs = watch(page);
    const J = "journal/", JP = "journal/index.html";
    const j0 = T(JP), jcap0 = (j0.match(/<figcaption>/g) || []).length;
    await openEdit(page, J);
    const img1 = await page.evaluateHandle(() => document.querySelector("main figure:has(figcaption) img"));
    await img1.evaluate((im) => im.scrollIntoView({ block: "center" }));
    const oldCap = await img1.evaluate((im) => im.closest("figure").querySelector("figcaption").textContent);
    await img1.click();
    await page.waitForSelector("#ee-cap-tools [data-cap]", { timeout: 5000 });
    check("journal: clicking a captioned picture offers Remove caption (and no zoom in edit mode)", (await page.textContent("#ee-cap-tools")).includes("Remove caption") && !(await page.isVisible("#map-zoom").catch(() => false)));
    await page.click('#ee-cap-tools [data-cap="rm"]');
    check("journal: caption removed", !(await img1.evaluate((im) => !!im.closest("figure").querySelector("figcaption"))));
    await img1.click();
    await page.waitForSelector('#ee-cap-tools [data-cap="add"]', { timeout: 5000 });
    check("journal: a picture without a caption offers Add caption", true);
    await page.click('#ee-cap-tools [data-cap="add"]');
    await page.keyboard.type("A new caption here");
    // Caption on the second picture edited inline.
    await caretEnd(page, "main figure:nth-of-type(2) figcaption");
    const hasSecond = await page.$("main figure:nth-of-type(2) figcaption");
    if (hasSecond) await page.keyboard.type(" Zq");
    // Upload a new picture as a captioned figure.
    await caretEnd(page, "main p");
    await page.click("#ee-img"); await page.waitForSelector("#ee-art-file", { state: "attached", timeout: 15000 });
    const BIG = makePng(3000, 1200, 5);
    await page.setInputFiles("#ee-art-file", { name: "wide test art.png", mimeType: "image/png", buffer: BIG });
    await page.fill("#ee-art-title", "Wide Test Art");
    await page.click("#ee-art-up"); await page.waitForTimeout(800);
    await page.keyboard.type("Uploaded and captioned");
    const n0 = mock.log.length;
    await saveNow(page);
    const j1 = T(JP);
    check("journal: both Journal copies identical", j1 === T("journal.html"));
    check("journal: first picture now has the new caption", /<figcaption>A new caption here<\/figcaption>/.test(j1) && (j1.split(oldCap).length === j0.split(oldCap).length - 1), (j1.match(/<figure>.{0,40}/) || [""])[0]);
    check("journal: inline edit of an existing caption saved", !hasSecond || / Zq<\/figcaption>/.test(j1));
    const up = mock.log.slice(n0).filter((e) => e.committed)[0];
    const webp = up && up.committed.paths.filter((p) => /^assets\/.*wide-test-art.*\.webp$/i.test(p))[0];
    const head = mock.commits[mock.heads.main].files;
    const sz = webp && webpSize(head[webp]);
    check("journal: upload saved as a 2400px WebP in assets/", !!webp && sz && Math.max(sz.w, sz.h) === 2400, webp + " " + JSON.stringify(sz));
    check("journal: uploaded picture inserted as a captioned figure", webp && new RegExp('<figure><img src="/' + webp.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + '" alt="Wide Test Art"><figcaption>Uploaded and captioned</figcaption></figure>').test(j1), (j1.match(/<figure><img src="\/assets\/wide[^>]*>.{0,80}/) || [""])[0]);
    check("journal: captions unchanged elsewhere (count)", (j1.match(/<figcaption>/g) || []).length === jcap0 + 1, (j1.match(/<figcaption>/g) || []).length + " vs " + jcap0);
    check("journal: no page errors", !errs.length, errs.join(" | "));
    await ctx.close();

    // ---- 3) Rich paste still works ----
    ctx = await ctxFor(browser, "devin"); page = await ctx.newPage(); errs = watch(page);
    await openEdit(page, "codex/lore/");
    await caretEnd(page, "main p");
    await page.evaluate(() => { const dt = new DataTransfer(); dt.setData("text/html", "<p>Pasted <b>bold</b> and <i>italic</i> words</p>"); dt.setData("text/plain", "Pasted bold and italic words");
      const n = getSelection().anchorNode, el = n.nodeType === 1 ? n : n.parentElement; el.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true })); });
    await page.waitForTimeout(400);
    check("codex: rich paste keeps bold / italic", await page.evaluate(() => { const m = document.querySelector("main"); return !!m.querySelector("b, strong") && /Pasted/.test(m.textContent) && Array.from(m.querySelectorAll("b,strong")).some((b) => b.textContent === "bold"); }));
    check("codex: Image button on Codex pages", !!(await page.$("#ee-img")));
    await ctx.close();

    // ---- 4) Players: only where they can edit; gallery only, no upload ----
    ctx = await ctxFor(browser, "sawyer"); page = await ctx.newPage(); errs = watch(page);
    await openEdit(page, "articles/vaerek/");
    check("player: Image button on Sawyer's own article", !!(await page.$("#ee-img")));
    await caretEnd(page, "main.art-body #lore p, main.art-body p");
    await page.click("#ee-img");
    await page.waitForSelector("#ee-body .ee-k", { timeout: 15000 }); await page.waitForTimeout(1200);
    check("player: gallery opens, no upload form, no hero choice", /Insert image/.test(await page.textContent("#ee-body")) && !(await page.isVisible("#ee-art-form")) && !(await page.$('input[name="ee-gal-act"]')));
    const pic = await page.$("#ee-gal-grid [data-gal-id]");
    if (pic) { await pic.click(); await page.waitForTimeout(300); }
    check("player: picture inserted as a captioned figure", !pic || await page.evaluate(() => !!document.querySelector("main.art-body figure > figcaption")));
    check("player: no page errors", !errs.length, errs.join(" | "));
    await page.goto(BASE + "articles/aghor/", { waitUntil: "load" }); await page.waitForTimeout(1500);
    check("player: no editing (so no Image) on someone else's article", !(await page.$("#ee-img")) && await page.evaluate(() => { try { window.EloraeEditor.tryEnterEdit(); } catch (e) {} return true; }) && !(await page.$("#ee-img")));
    await ctx.close();

    // ---- 5) Public view ----
    ctx = await ctxFor(browser, "jack"); page = await ctx.newPage();
    await page.route((u) => u.href === BASE + A, (r) => r.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: T(AP).replace("<figcaption>The Creator at rest</figcaption>", "<figcaption>The Creator at rest</figcaption></figure><figure><img src=\"/favicon.svg\" alt=\"\"><figcaption></figcaption>") }));
    await page.goto(BASE + A, { waitUntil: "load" }); await page.waitForTimeout(500);
    const pub = await page.evaluate(() => { const c = Array.from(document.querySelectorAll("main.art-body figcaption")); const s = c[0] && getComputedStyle(c[0]); return { n: c.length, color: s && s.color, align: s && s.textAlign, font: s && s.fontFamily, emptyHidden: c.slice(1).every((x) => getComputedStyle(x).display === "none") }; });
    check("public: article caption styled like the Journal's (centred, sans, #b7b0a4)", pub.n >= 1 && pub.color === "rgb(183, 176, 164)" && pub.align === "center" && /Helvetica/.test(pub.font), JSON.stringify(pub));
    check("public: an empty caption is never shown", pub.emptyHidden);
    await ctx.close();
  } finally { await browser.close(); srv.close(); }
  const ok = results.filter((r) => r.ok).length;
  console.log(`\n${ok}/${results.length} passed`);
  process.exit(ok === results.length ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(2); });
