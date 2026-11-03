/* E2E: add / edit a Dossier in edit mode (editor.js dos1). Harness copied from e2e-editor.js.
   Run: PLAYWRIGHT=<path> CHROME=/usr/bin/google-chrome node edit/test/e2e-dossier.js
   ---- original harness notes ----
   Full-page editor E2E (headless Chrome, GitHub API mocked). Covers the Critical
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

const DL = (f) => (String(f || "").match(/<section class="art-sec" id="dossier">[\s\S]*?<\/section>/) || [""])[0];
const rows = (p) => p.evaluate(() => [...document.querySelectorAll("main.art-body dl.art-dossier > dt")].map((d) => d.textContent + "=" + ((d.nextElementSibling || {}).textContent || "")).join("|"));
async function saveAndWait(p) {
  await p.click("#ee-save");
  await p.waitForFunction(() => /Saved|failed|conflict|pull request/i.test((document.getElementById("ee-bar") || {}).textContent || ""), null, { timeout: 20000 });
}
async function viewAs(browser, mock, vp, url, html, who) {
  const ctx = await ctxFor(browser, mock, vp, who); const p = await ctx.newPage();
  await p.route(BASE + url, (r) => r.fulfill({ status: 200, contentType: "text/html", body: html }));
  await p.goto(BASE + url, { waitUntil: "load" }); await p.waitForTimeout(300);
  return { ctx, p };
}
async function run(browser, vpName) {
  const vp = VPS[vpName];
  // 1. No Dossier: + Add dossier, type fields with Enter, save, reload.
  {
    const mock = newMock(); const ctx = await ctxFor(browser, mock, vp); const p = await ctx.newPage(); const W = watch(p);
    await openEdit(p, "articles/cressana/");
    const btn = await p.evaluate(() => { const b = document.querySelector("main.art-body .ee-dossier-tools .ee-dos-add"); if (!b) return null; const r = b.getBoundingClientRect(); const d = document.getElementById("description"); return { t: b.textContent, vis: r.width > 0 && r.height > 0, afterDesc: !d || !!(d.compareDocumentPosition(b) & 4), beforeLore: !!(b.compareDocumentPosition(document.getElementById("lore")) & 4) }; });
    check(`[${vpName}] dossier: an article with no Dossier shows "+ Add dossier" in edit mode, after Description and before Lore`, btn && btn.t === "+ Add dossier" && btn.vis && btn.afterDesc && btn.beforeLore, JSON.stringify(btn));
    await p.click("main.art-body .ee-dos-add"); await p.waitForTimeout(150);
    await p.keyboard.type("Status"); await p.keyboard.press("Enter"); await p.keyboard.type("Alive");
    await p.keyboard.press("Enter"); await p.keyboard.type("Home"); await p.keyboard.press("Enter"); await p.keyboard.type("Morath");
    await p.click("main.art-body .ee-dos-add"); await p.waitForTimeout(100); // an extra row left blank
    const r = await rows(p), tools = await p.evaluate(() => (document.querySelector(".ee-dossier-tools .ee-dos-add") || {}).textContent);
    check(`[${vpName}] dossier: Add dossier creates it with a field; Enter goes name -> value -> next field; the control becomes "+ Add field"`, r === "Status=Alive|Home=Morath|=" && tools === "+ Add field", JSON.stringify({ r, tools }));
    await saveAndWait(p);
    const f = String(mock.file("articles/cressana/index.html")), f2 = String(mock.file("articles/cressana.html"));
    const want = '<section class="art-sec" id="dossier"><h2>Dossier</h2><dl class="art-dossier"><dt>Status</dt><dd>Alive</dd><dt>Home</dt><dd>Morath</dd></dl></section>';
    check(`[${vpName}] dossier: Save writes the new Dossier to both copies (blank row dropped, no editor UI saved), before Lore`, f.includes(want) && f2.includes(want) && f.indexOf('id="dossier"') < f.indexOf('id="lore"') && !/ee-dossier-tools|ee-dos-add|data-ee-|contenteditable/.test(f.replace(/<script[\s\S]*?<\/script>/g, "")), DL(f).slice(0, 260));
    check(`[${vpName}] dossier: no page errors (add)`, W.errs.length === 0, W.errs.join(" | "));
    await ctx.close();
    const v = await viewAs(browser, mock, vp, "articles/cressana/", f);
    const seen = await v.p.evaluate(() => [...document.querySelectorAll("main.art-body dl.art-dossier > dt")].filter((d) => d.getClientRects().length).map((d) => d.textContent).join("|") + (document.querySelector(".ee-dossier-tools") ? " +tools" : ""));
    check(`[${vpName}] dossier: after reload the new fields show for viewers (no edit controls)`, seen === "Status|Home", seen);
    await v.p.evaluate(() => window.EloraeEditor.tryEnterEdit()); await v.p.waitForSelector("#ee-save"); await v.p.waitForTimeout(200);
    const re = await rows(v.p), t2 = await v.p.evaluate(() => (document.querySelector(".ee-dossier-tools .ee-dos-add") || {}).textContent);
    check(`[${vpName}] dossier: editing again shows the fields and "+ Add field"`, re === "Status=Alive|Home=Morath" && t2 === "+ Add field", JSON.stringify({ re, t2 }));
    await v.ctx.close();
  }
  // 2. Every template, on an article without and with a Dossier.
  for (const url of ["articles/minashi/", "articles/vaerek/"]) {
    const mock = newMock(); const ctx = await ctxFor(browser, mock, vp); const p = await ctx.newPage(); const W = watch(p);
    await openEdit(p, url);
    const base = await rows(p);
    const tpls = await p.evaluate(() => window.EloraeMedia ? window.EloraeMedia.ART_TEMPLATES.map((t) => [t.id, t.label, t.fields]) : null);
    const bad = [];
    for (const [id, label, fields] of tpls || []) {
      await p.click("#ee-tpl"); await p.click(`#ee-tpl-menu [data-tpl="${id}"]`); await p.waitForTimeout(120);
      const r = (await rows(p)).split("|").map((x) => x.split("=")[0]);
      const missing = fields.filter((f) => !r.some((x) => x.toLowerCase() === f.toLowerCase()));
      const cls = await p.evaluate(() => (document.querySelector("main.art-body dl.art-dossier") || {}).className);
      if (missing.length || cls !== "art-dossier tpl-" + id) bad.push(label + ":" + missing.join(",") + ":" + cls);
    }
    await p.click("#ee-tpl"); await p.click('#ee-tpl-menu [data-tpl=""]'); await p.waitForTimeout(120);
    const after = await rows(p), hasDl = await p.evaluate(() => !!document.querySelector("main.art-body dl.art-dossier"));
    check(`[${vpName}] dossier: every template (${(tpls || []).length}) adds its fields on /${url} (${base ? "has" : "no"} Dossier); None goes back`, tpls && tpls.length === 7 && !bad.length && (base ? after === base : !hasDl), JSON.stringify({ bad, after, base }));
    check(`[${vpName}] dossier: no page errors (templates /${url})`, W.errs.length === 0, W.errs.join(" | "));
    await ctx.close();
  }
  // 3. Template on an article with none, saved empty: hidden for viewers incl. heading; shown in edit mode; Add dossier left empty is not saved.
  {
    const mock = newMock(); const ctx = await ctxFor(browser, mock, vp); const p = await ctx.newPage(); watch(p);
    await openEdit(p, "articles/olesh/");
    await p.click("main.art-body .ee-dos-add"); await p.waitForTimeout(100);
    p._answer = true; await p.click("#ee-cancel"); await p.waitForTimeout(200);
    check(`[${vpName}] dossier: Cancel takes an unsaved new Dossier and the edit controls away`, await p.evaluate(() => !document.querySelector("main.art-body dl.art-dossier, .ee-dossier-tools")));
    await openEdit(p, "articles/olesh/");
    await p.click("main.art-body .ee-dos-add"); await p.waitForTimeout(100);
    await p.click("#ee-tpl"); await p.click('#ee-tpl-menu [data-tpl="conflict"]'); await p.waitForTimeout(100);
    await saveAndWait(p);
    const f = String(mock.file("articles/olesh/index.html"));
    check(`[${vpName}] dossier: a Dossier with only empty template fields saves them empty (blank added row dropped)`, /<dl class="art-dossier tpl-conflict">(<dt>[^<]+<\/dt><dd><\/dd>)+<\/dl>/.test(DL(f)) && !/<dt><\/dt>/.test(DL(f)), DL(f).slice(0, 240));
    await ctx.close();
    const v = await viewAs(browser, mock, vp, "articles/olesh/", f);
    const hid = await v.p.evaluate(() => { const s = document.getElementById("dossier"); return s && getComputedStyle(s).display; });
    check(`[${vpName}] dossier: viewers do not see an all-empty Dossier (heading included)`, hid === "none", hid);
    await v.p.evaluate(() => window.EloraeEditor.tryEnterEdit()); await v.p.waitForSelector("#ee-save"); await v.p.waitForTimeout(200);
    const shown = await v.p.evaluate(() => { const s = document.getElementById("dossier"); return { sec: getComputedStyle(s).display, h: s.querySelector("h2").getClientRects().length > 0, rows: [...s.querySelectorAll("dt")].filter((d) => d.getClientRects().length).length, dd: [...s.querySelectorAll("dd")].filter((d) => d.getBoundingClientRect().height > 8).length }; });
    check(`[${vpName}] dossier: edit mode shows the empty Dossier, its heading and every empty field`, shown.sec !== "none" && shown.h && shown.rows === 2 && shown.dd === shown.rows, JSON.stringify(shown));
    await v.ctx.close();
    const m2 = newMock(); const c2 = await ctxFor(browser, m2, vp); const p2 = await c2.newPage();
    await openEdit(p2, "articles/the-six-kings/");
    const orig = String(m2.file("articles/the-six-kings/index.html"));
    await p2.click("main.art-body .ee-dos-add"); await p2.waitForTimeout(100);
    await p2.evaluate(() => { const l = document.querySelector("main.art-body p"); if (l) l.append(" Zq"); document.querySelector("main.art-body").dispatchEvent(new Event("input", { bubbles: true })); });
    await saveAndWait(p2);
    const f2 = String(m2.file("articles/the-six-kings/index.html"));
    check(`[${vpName}] dossier: an added Dossier left empty is not saved`, f2 !== orig && !/id="dossier"/.test(f2), (f2.match(/<main[\s\S]{0,200}/) || [""])[0]);
    await c2.close();
  }
  // 4. A player on their own character: Add field, save (pull request).
  {
    const mock = newMock(); const ctx = await ctxFor(browser, mock, vp, "sawyer"); const p = await ctx.newPage(); const W = watch(p);
    await openEdit(p, "articles/vaerek/");
    await p.click("main.art-body .ee-dos-add"); await p.waitForTimeout(100);
    await p.keyboard.type("Zq Field"); await p.keyboard.press("Enter"); await p.keyboard.type("Zq Value");
    // Shift+Enter keeps a line break inside a value.
    await p.keyboard.press("Shift+Enter"); await p.keyboard.type("Two");
    await saveAndWait(p);
    const pr = mock.pulls[0], a = pr && String(mock.file("articles/vaerek/index.html", pr.head)), b = pr && String(mock.file("articles/vaerek.html", pr.head));
    check(`[${vpName}] dossier: a player adds a field to their own character; it goes in the pull request (both copies)`, pr && a.includes("<dt>Zq Field</dt><dd>Zq Value<br>Two</dd></dl>") && a === b, DL(a).slice(0, 300));
    check(`[${vpName}] dossier: no page errors (player)`, W.errs.length === 0, W.errs.join(" | "));
    await ctx.close();
  }
}
(async () => {
  const srv = await serverForTests(); BASE = srv.base;
  const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ["--no-sandbox"] });
  try {
    for (const vpName of ["desktop", "phone"]) {
      try { await run(browser, vpName); } catch (e) { check(`[${vpName}] dossier stage ran without exceptions`, false, e.stack.split("\n").slice(0, 3).join(" ")); }
    }
  } finally { await browser.close(); srv.close(); }
  const fail = results.filter((r) => !r.ok);
  console.log(`\n${results.length - fail.length}/${results.length} passed`);
  process.exit(fail.length ? 1 : 0);
})();
