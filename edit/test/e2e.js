/* Edit mode + visibility layer end-to-end test (headless Chromium, GitHub API mocked).
   Run from the repo root with a static server on BASE:
     python3 -m http.server 8123 --bind 127.0.0.1 &
     PLAYWRIGHT=/path/to/playwright-core CHROME=/usr/bin/google-chrome node edit/test/e2e.js
   Never talks to the real GitHub API: every api.github.com request is intercepted. */
"use strict";
const path = require("path");
const fs = require("fs");
const { chromium } = require(process.env.PLAYWRIGHT || "playwright-core");
const { MockGitHub, blobSha } = require("./mock-github.js");
const S = require("../srcmap.js");

const BASE = process.env.BASE || "http://127.0.0.1:8123/";
const ROOT = path.resolve(__dirname, "../..");
const SHOTS = process.env.SHOTS || "/tmp/ee-shots";
fs.mkdirSync(SHOTS, { recursive: true });
const REPO = "195142095142091920/elorae";
const results = [];
function check(name, ok, detail) { results.push({ name, ok: !!ok, detail }); console.log((ok ? "PASS " : "FAIL ") + name + (detail ? "  — " + detail : "")); }

const TOKENS = { "github_pat_jonfg": "jon-gh", "ghp_test_broad": "arts-gh", "ghp_test_noscope": "arts-gh", "ghp_test_notcollab": "newbie-gh", "ghp_test_devin": "devin-gh", "ghp_test_sawyer": "sawyer-gh", "ghp_test_julie": "julie-gh", "ghp_test_arts": "arts-gh", "ghp_test_viewer": "viewer-gh", "ghp_test_jon": "jon-gh" };
const PROFILES = { repo: REPO, profiles: {
  "devin-gh": { name: "Devin", person: "devin", role: "admin", title: "GM", permissions: ["**"], save: "direct" },
  // Sawyer's and Julie's profiles deliberately over-reach: rules outside articles/ must be ignored (ceiling).
  "sawyer-gh": { name: "Sawyer", person: "sawyer", role: "editor", permissions: ["articles/vaerek.html", "index/ancients.html", "codex/lore.html"], save: "pr" },
  "julie-gh": { name: "Julie", person: "julie", role: "editor", permissions: ["articles/saoirse.html", "index/**", "codex/**", "**"], save: "pr" },
  "jon-gh": { name: "Jon", person: "jon", role: "editor", permissions: ["articles/silar-scorria.html", "articles/telorin.html"], save: "pr" },
  "arts-gh": { name: "Articles editor", role: "editor", permissions: ["articles/*.html", "codex/**"], save: "direct" },
  "viewer-gh": { name: "Viewer", role: "viewer", permissions: "view" } } };

function newMock() {
  return new MockGitHub({ repo: REPO, root: ROOT, tokens: TOKENS, scopes: { "ghp_test_broad": "repo, gist", "ghp_test_noscope": "gist" }, noRepo: ["github_pat_jonfg"], noPush: ["ghp_test_notcollab"], overrides: { "edit/profiles.json": JSON.stringify(PROFILES, null, 2) } });
}

async function ctxFor(browser, mock, opts = {}) {
  const ctx = await browser.newContext({ viewport: opts.viewport || { width: 1440, height: 900 }, deviceScaleFactor: 1, reducedMotion: "reduce" });
  const external = [];
  await ctx.route("https://api.github.com/**", (r) => mock.handle(r));
  // Simulate the deployed copy of mutable edit-system files (what Pages would serve after deploy).
  await ctx.route((u) => u.href.startsWith(BASE) && /\/edit\/(visibility\.json|secrets\/[^/?]+\.json)$/.test(u.pathname), (r) => {
    const p = new URL(r.request().url()).pathname.replace(/^\//, "");
    const text = mock.file(p);
    return text == null ? r.fulfill({ status: 404, body: "" }) : r.fulfill({ status: 200, contentType: "application/json", body: text });
  });
  ctx.on("request", (q) => { const u = q.url(); if (!u.startsWith(BASE) && !u.startsWith("data:")) external.push(u); });
  if (opts.init) await ctx.addInitScript(opts.init);
  ctx.external = external;
  return ctx;
}
const sessionInit = (token, login, extra = {}) => `try{sessionStorage.setItem("elorae-edit-session", ${JSON.stringify(JSON.stringify(Object.assign({ token, login, remember: false }, extra)))})}catch(e){}`;
const sealInit = (who) => `try{localStorage.setItem("elorae-seal", ${JSON.stringify(who)})}catch(e){}`;

async function waitEditor(page) { await page.waitForFunction(() => window.EloraeEditor && window.EloraeEditor.state, null, { timeout: 10000 }); await page.waitForTimeout(400); }

async function signInViaPanel(page, token) {
  await page.waitForSelector("#ee-panel:not([hidden]) #ee-token", { timeout: 10000 });
  await page.fill("#ee-token", token);
  await page.click("#ee-form button[type=submit]");
  await page.waitForSelector("#ee-signout", { timeout: 10000 });
}

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ["--no-sandbox"] });
  try {
    /* 1. Anonymous visitors: no UI, no extra requests. */
    {
      const mock = newMock();
      for (const [vpName, vp] of [["desktop", { width: 1440, height: 900 }], ["phone", { width: 390, height: 844 }]]) {
        const ctx = await ctxFor(browser, mock, { viewport: vp });
        const page = await ctx.newPage();
        const reqs = [];
        page.on("request", (q) => reqs.push(q.url()));
        for (const p of ["index.html", "index/ancients.html", "articles/vaerek.html", "codex/lore.html", "journal.html", "articles/yena.html", "articles/telorin.html"]) {
          reqs.length = 0;
          await page.goto(BASE + p, { waitUntil: "networkidle" });
          const info = await page.evaluate(() => ({
            ee: document.querySelectorAll("[id^=ee-],.ee-editable,.ee-dash").length,
            css: !!document.querySelector('link[href*="edit/edit.css"]'),
            ce: document.querySelectorAll("[contenteditable]").length
          }));
          const editReqs = reqs.filter((u) => /\/edit\//.test(u) && !/\/edit\/edit\.js/.test(u));
          check(`anonymous ${vpName} ${p}: no edit UI or requests`, info.ee === 0 && !info.css && info.ce === 0 && editReqs.length === 0 && !reqs.some((u) => u.includes("api.github.com")), JSON.stringify(info) + (editReqs.length ? " " + editReqs.join(",") : ""));
        }
        await ctx.close();
      }
    }

    /* 2. Source map matches the live DOM on every content page. */
    {
      const mock = newMock();
      const ctx = await ctxFor(browser, mock);
      const page = await ctx.newPage();
      const files = require("child_process").execFileSync("git", ["grep", "-l", "edit/edit.js", "--", "*.html"], { cwd: ROOT, encoding: "utf8" }).split("\n").filter((f) => /^(articles|codex|index)\/|^journal\.html$/.test(f));
      let bad = [];
      for (const f of files) {
        await page.goto(BASE + f, { waitUntil: "load" });
        await page.waitForFunction(() => window.EloraeSrcMap || true);
        const src = fs.readFileSync(path.join(ROOT, f), "utf8");
        const sb = S.sourceBlocks(src).map((b) => ({ tag: b.tag, inner: b.inner }));
        await page.addScriptTag({ url: BASE + "edit/srcmap.js" });
        const r = await page.evaluate((sb) => {
          const M = window.EloraeSrcMap;
          const live = M.collectBlocks(document.body, M.DOM);
          const norm = (s) => String(s || "").replace(/\s+/g, " ").trim();
          const t = document.createElement("template");
          let match = 0;
          sb.forEach((b, i) => { t.innerHTML = b.inner; if (live[i] && live[i].tagName.toLowerCase() === b.tag && norm(t.content.textContent) === norm(live[i].textContent)) match++; });
          return { live: live.length, src: sb.length, match };
        }, sb);
        if (r.src !== r.live || r.match !== r.src) bad.push(f + " " + JSON.stringify(r));
      }
      check(`source blocks map 1:1 to live DOM on ${files.length} content pages`, bad.length === 0, bad.slice(0, 5).join("; "));
      await ctx.close();
    }

    /* 3. #edit shows the sign-in panel (desktop + phone). */
    for (const [vpName, vp] of [["desktop", { width: 1440, height: 900 }], ["phone", { width: 390, height: 844 }]]) {
      const mock = newMock();
      const ctx = await ctxFor(browser, mock, { viewport: vp });
      const page = await ctx.newPage();
      await page.goto(BASE + "articles/vaerek.html#edit", { waitUntil: "networkidle" });
      await page.waitForSelector("#ee-panel:not([hidden]) #ee-token", { timeout: 10000 });
      const box = await page.evaluate(() => { const r = document.querySelector("#ee-panel .ee-box").getBoundingClientRect(); return { l: r.left, r: r.right, w: innerWidth, close: !!document.querySelector("#ee-panel .ee-close svg") }; });
      check(`#edit shows sign-in panel (${vpName})`, box.l >= 0 && box.r <= box.w && box.close, JSON.stringify(box));
      await page.screenshot({ path: `${SHOTS}/signin-${vpName}.png` });
      await ctx.close();
    }

    /* 3b. Sign-in UX: pre-filled token link, remember on by default, "you can edit" list,
          auto EDIT without #edit once remembered, friendly errors, expiry prompt, sign-out. */
    {
      const mock = newMock();
      const ctx = await ctxFor(browser, mock);
      const page = await ctx.newPage();
      await page.goto(BASE + "articles/saoirse.html#edit", { waitUntil: "networkidle" });
      await page.waitForSelector("#ee-panel:not([hidden]) #ee-token", { timeout: 10000 });
      const ui = await page.evaluate(() => ({ href: document.getElementById("ee-mint").href, remember: document.getElementById("ee-remember").checked, steps: document.querySelectorAll(".ee-steps > li").length }));
      const u = new URL(ui.href);
      check("sign-in: 'Make my token' opens GitHub's new-token page pre-filled (description + public_repo)", u.origin + u.pathname === "https://github.com/settings/tokens/new" && u.searchParams.get("scopes") === "public_repo" && u.searchParams.get("description") === "Elorae edit mode", ui.href);
      check("sign-in: two numbered steps, 'Remember on this device' on by default", ui.steps === 2 && ui.remember === true);
      await page.screenshot({ path: `${SHOTS}/signin-steps-desktop.png` });
      // friendly errors
      const tryToken = async (tok) => { await page.fill("#ee-token", tok); await page.click("#ee-form button[type=submit]"); await page.waitForFunction(() => { const e = document.getElementById("ee-err"); return e && !e.hidden && !/Checking/.test(e.textContent); }, null, { timeout: 8000 }); return page.textContent("#ee-err"); };
      let t = await tryToken("hello"); check("sign-in: non-token text gets a plain-English hint", /doesn't look like a GitHub token/.test(t), t);
      t = await tryToken("ghp_wrongwrong"); check("sign-in: rejected/expired token explained", /didn't accept that token/.test(t), t);
      t = await tryToken("github_pat_jonfg"); check("sign-in: fine-grained token on someone else's repo explained", /fine-grained tokens/.test(t) && /Make my token/.test(t), t);
      t = await tryToken("ghp_test_noscope"); check("sign-in: token without public_repo explained", /missing the public_repo/.test(t), t);
      t = await tryToken("ghp_test_notcollab"); check("sign-in: not-yet-collaborator explained with invitation hint", /isn't a collaborator/.test(t), t);
      // success, remembered by default
      await page.fill("#ee-token", "ghp_test_sawyer"); await page.click("#ee-form button[type=submit]");
      await page.waitForSelector("#ee-signout", { timeout: 10000 });
      await page.waitForFunction(() => /Vaerek Rathkin/.test(document.getElementById("ee-pages").textContent), null, { timeout: 5000 });
      const who = (await page.textContent("#ee-body")).replace(/\s+/g, " ");
      check("signed in: 'Signed in as Sawyer', 'You can edit: Vaerek Rathkin', how saves work", /Signed in as Sawyer/.test(who) && /You can edit/i.test(who) && /Vaerek Rathkin/.test(who) && /pull request/.test(who) && /Remembered on this device/.test(who), who.slice(0, 220));
      await page.screenshot({ path: `${SHOTS}/signedin-desktop.png` });
      const stored = await page.evaluate(() => !!localStorage.getItem("elorae-edit-session"));
      check("remembered: session kept in localStorage (default on)", stored);
      // a new tab later, no #edit: EDIT shows by itself on his article
      const page2 = await ctx.newPage();
      await page2.goto(BASE + "articles/vaerek.html", { waitUntil: "networkidle" });
      await waitEditor(page2);
      check("remembered: EDIT button appears on his own article without #edit", !!(await page2.$("#ee-glyph")));
      // token revoked/expired -> friendly prompt, token forgotten
      delete mock.tokens["ghp_test_sawyer"];
      await page2.reload({ waitUntil: "networkidle" });
      await page2.waitForSelector("#ee-bar.ee-expired", { timeout: 10000 });
      const exp = await page2.textContent("#ee-bar");
      const gone = await page2.evaluate(() => !localStorage.getItem("elorae-edit-session") && !sessionStorage.getItem("elorae-edit-session"));
      check("expired token: friendly 'sign in again' prompt, token forgotten, no EDIT", /expired/.test(exp) && gone && !(await page2.$("#ee-glyph")), exp.trim().slice(0, 90));
      await page2.screenshot({ path: `${SHOTS}/expired-desktop.png` });
      await page2.click("#ee-resign");
      await page2.waitForSelector("#ee-panel:not([hidden]) #ee-token");
      check("expired token: 'Sign in again' opens the steps with an explanation", /expired or was deleted/.test(await page2.textContent("#ee-body")));
      mock.tokens["ghp_test_sawyer"] = "sawyer-gh";
      // broad classic token warning + sign out
      await page2.fill("#ee-token", "ghp_test_broad"); await page2.click("#ee-form button[type=submit]");
      await page2.waitForSelector("#ee-signout", { timeout: 10000 });
      check("broad 'repo' token: signed in with a gentle narrower-token warning", /only public_repo is enough/.test(await page2.textContent("#ee-body")));
      await page2.click("#ee-signout");
      const out = await page2.evaluate(() => ({ ls: localStorage.getItem("elorae-edit-session"), ss: sessionStorage.getItem("elorae-edit-session"), txt: document.getElementById("ee-body").textContent }));
      check("sign out: token removed from this browser, confirmation shown", !out.ls && !out.ss && /Signed out/.test(out.txt));
      await ctx.close();
      // phone screenshot of the steps
      const pctx = await ctxFor(browser, newMock(), { viewport: { width: 390, height: 844 } });
      const pp = await pctx.newPage();
      await pp.goto(BASE + "articles/vaerek.html#edit", { waitUntil: "networkidle" });
      await pp.waitForSelector("#ee-panel:not([hidden]) #ee-token");
      const fit = await pp.evaluate(() => { const r = document.querySelector("#ee-panel .ee-box").getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.bottom <= innerHeight; });
      check("phone: sign-in steps fit the screen", fit);
      await pp.screenshot({ path: `${SHOTS}/signin-steps-phone.png` });
      await pctx.close();
    }

    /* 4. Viewer can't edit. */
    {
      const mock = newMock();
      const ctx = await ctxFor(browser, mock);
      const page = await ctx.newPage();
      await page.goto(BASE + "articles/vaerek.html#edit", { waitUntil: "networkidle" });
      await signInViaPanel(page, "ghp_test_viewer");
      const t = await page.textContent("#ee-body");
      await page.click("#ee-panel .ee-close");
      await page.waitForTimeout(300);
      const g = await page.$("#ee-glyph");
      const forced = await page.evaluate(() => { window.EloraeEditor.startEdit(); return document.querySelectorAll("[contenteditable]").length; });
      check("viewer: signed in, no EDIT glyph, cannot enter edit mode", /View only/.test(t) && !g && forced === 0, t.replace(/\s+/g, " ").slice(0, 120));
      check("viewer: no DASHBOARD link", !(await page.$("#ee-dash")));
      await ctx.close();
    }

    /* 5. Articles editor: vaerek yes, codex no; splice touches only the edited block; sanitizer. */
    const vaerekPath = "articles/vaerek.html";
    const vaerekSrc = fs.readFileSync(path.join(ROOT, vaerekPath), "utf8");
    {
      const mock = newMock();
      const ctx = await ctxFor(browser, mock, { init: sessionInit("ghp_test_arts", "arts-gh") });
      const page = await ctx.newPage();
      await page.goto(BASE + "codex/lore.html", { waitUntil: "networkidle" });
      await waitEditor(page);
      check("articles editor: no EDIT glyph on codex/lore.html", !(await page.$("#ee-glyph")));
      await page.goto(BASE + vaerekPath, { waitUntil: "networkidle" });
      await waitEditor(page);
      await page.waitForSelector("#ee-glyph", { timeout: 5000 });
      check("articles editor: EDIT glyph on articles/vaerek.html", true);
      await page.screenshot({ path: `${SHOTS}/glyph-desktop.png` });
      await page.click("#ee-glyph");
      await page.waitForSelector("#ee-save");
      const nEditable = await page.evaluate(() => document.querySelectorAll(".ee-editable").length);
      const navEditable = await page.evaluate(() => document.querySelectorAll(".mast [contenteditable], nav [contenteditable], aside [contenteditable], #related [contenteditable], h2[contenteditable], h1[contenteditable]:not(.art-title h1)").length);
      const titleEditable = await page.evaluate(() => document.querySelectorAll(".art-title [contenteditable]").length);
      // arts-gh is not admin: body blocks only (no hero name/epithet).
      check("edit mode: content blocks editable, nav/chrome/headings/related not", nEditable === 20 && navEditable === 0 && titleEditable === 0, `editable=${nEditable} chrome=${navEditable} title=${titleEditable}`);
      // Type into the 3rd lore paragraph.
      const target = 'main.art-body #lore p.art-life:nth-of-type(3)';
      await page.click(target);
      await page.keyboard.press("Control+End");
      await page.keyboard.type(" An added sentence.");
      await page.screenshot({ path: `${SHOTS}/editing-desktop.png` });
      await page.click("#ee-save");
      await page.waitForSelector("#ee-bar.ee-done", { timeout: 10000 });
      const put = mock.log.find((e) => e.written);
      const out = put.written.text;
      // Diff: everything outside the edited block must be byte-identical.
      let a = 0; while (a < out.length && out[a] === vaerekSrc[a]) a++;
      let b = 0; while (b < out.length - a && out[out.length - 1 - b] === vaerekSrc[vaerekSrc.length - 1 - b]) b++;
      const blocks = S.sourceBlocks(vaerekSrc);
      const blk = blocks.find((x) => x.start <= a && vaerekSrc.length - b <= x.end);
      const changedOld = vaerekSrc.slice(a, vaerekSrc.length - b), changedNew = out.slice(a, out.length - b);
      fs.writeFileSync(`${SHOTS}/splice-diff.txt`, `changed byte range ${a}..${vaerekSrc.length - b} of ${vaerekSrc.length}\n-${changedOld}\n+${changedNew}\n`);
      check("save: PUT with sha + exact message", put.body.sha === blobSha(vaerekSrc) && put.body.message === "Edit articles/vaerek.html via edit mode [edit-mode]" && put.body.branch === "main", put.body.message);
      const hb = blocks.find((x) => x.inner.startsWith("He chose to travel"));
      const expected = S.splice(vaerekSrc, [{ start: hb.start, end: hb.end, html: hb.inner + " An added sentence." }]);
      check("save: splice changed only the edited block (rest byte-identical)", out === expected && out.slice(0, hb.start) === vaerekSrc.slice(0, hb.start) && out.slice(hb.end + 19) === vaerekSrc.slice(hb.end), `block bytes ${hb.start}..${hb.end} of ${vaerekSrc.length}; +${out.length - vaerekSrc.length} bytes, inserted ${JSON.stringify(changedNew)} (diff: ${SHOTS}/splice-diff.txt)`);
      const barText = await page.textContent("#ee-bar");
      check("save: success state mentions 1–2 minute Pages delay", /1–2 minutes/.test(barText), barText.trim().slice(0, 90));
      await page.screenshot({ path: `${SHOTS}/saved-desktop.png` });

      // Editing a block that contains character references keeps them (minimal diff).
      mock.log.length = 0;
      await page.click("#ee-x");
      await page.click("#ee-glyph"); await page.waitForSelector("#ee-save");
      await page.click('main.art-body #lore p.art-life:nth-of-type(2)'); await page.keyboard.press("Control+End"); await page.keyboard.type(" X.");
      await page.click("#ee-save"); await page.waitForSelector("#ee-bar.ee-done", { timeout: 10000 });
      const prevOut = out, out3 = mock.log.find((e) => e.written).written.text;
      let a3 = 0; while (out3[a3] === prevOut[a3]) a3++;
      check("editing a block with &#x27; entities: only the typed text differs", out3.length === prevOut.length + 3 && out3.slice(a3, a3 + 3) === " X." && out3.slice(0, a3) + out3.slice(a3 + 3) === prevOut && /didn&#x27;t last/.test(out3), `inserted at ${a3}`);

      // Sanitizer: hostile markup in an edited block.
      mock.log.length = 0;
      await page.click("#ee-x");
      await page.click("#ee-glyph");
      await page.waitForSelector("#ee-save");
      await page.evaluate(() => {
        const p = document.querySelector("main.art-body #lore p.art-life:nth-of-type(4)");
        p.innerHTML = 'X<img src=x onerror="alert(1)"><script>alert(2)<\/script><style>*{}</style><b onclick="x()" style="color:red">bold</b> <a href="javascript:alert(3)" onmouseover="y">bad</a> <a href="../articles/saoirse.html">ok</a><div>line</div><iframe src="//evil"></iframe>';
      });
      await page.click("#ee-save");
      await page.waitForSelector("#ee-bar.ee-done", { timeout: 10000 });
      const put2 = mock.log.find((e) => e.written).written.text;
      const nb = S.sourceBlocks(put2)[blocks.findIndex((x) => x === blocks.filter((y) => y.tag === "p")[0]) >= 0 ? 0 : 0];
      const p4 = S.sourceBlocks(put2).filter((x) => x.tag === "p")[5].inner; // description p, lore? computed below
      const all = S.sourceBlocks(put2).map((x) => x.inner).join("\n");
      const ok = !/<script|<style|onerror|onclick|onmouseover|javascript:|<iframe|<img|style=/i.test(all) && /<b>bold<\/b>/.test(all) && /<a href="\.\.\/articles\/saoirse\.html">ok<\/a>/.test(all) && /<a>bad<\/a>/.test(all) && /<br>line/.test(all);
      check("sanitizer: strips script/style/img/iframe/event handlers/javascript: and keeps b, a[href], br", ok, (all.match(/X<b>.*?line/) || [""])[0]);
      await ctx.close();
    }

    /* 5b. Admin: hero name (h1) + epithet editable; players still cannot. */
    {
      const mock = newMock();
      // Sawyer (player): titles stay locked.
      {
        const ctx = await ctxFor(browser, mock, { init: sessionInit("ghp_test_sawyer", "sawyer-gh") });
        const page = await ctx.newPage();
        await page.goto(BASE + vaerekPath, { waitUntil: "networkidle" });
        await waitEditor(page);
        await page.click("#ee-glyph"); await page.waitForSelector("#ee-save");
        const t = await page.evaluate(() => ({
          n: document.querySelectorAll(".ee-editable").length,
          title: document.querySelectorAll(".art-title [contenteditable]").length,
          h1: !!(document.querySelector(".art-title h1[contenteditable]")),
          ep: !!(document.querySelector(".art-title .art-epithet[contenteditable]"))
        }));
        check("player (Sawyer): hero name/epithet not editable", t.title === 0 && !t.h1 && !t.ep && t.n === 20, JSON.stringify(t));
        await ctx.close();
      }
      // Devin (admin): edit epithet only — rest of file byte-identical; trailing period stripped.
      {
        const ctx = await ctxFor(browser, mock, { init: sessionInit("ghp_test_devin", "devin-gh", { person: "devin", role: "admin" }) });
        const page = await ctx.newPage();
        await page.goto(BASE + vaerekPath, { waitUntil: "networkidle" });
        await waitEditor(page);
        await page.click("#ee-glyph"); await page.waitForSelector("#ee-save");
        const t = await page.evaluate(() => ({
          n: document.querySelectorAll(".ee-editable").length,
          title: document.querySelectorAll(".art-title [contenteditable]").length,
          h1: document.querySelector(".art-title h1").textContent,
          ep: document.querySelector(".art-title .art-epithet").textContent
        }));
        check("admin (Devin): hero name + epithet editable (+2 blocks)", t.title === 2 && t.n === 22, JSON.stringify(t));
        await page.evaluate(() => { document.querySelector(".art-title .art-epithet").textContent = "Ranger of the Wreath."; });
        await page.click("#ee-save"); await page.waitForSelector("#ee-bar.ee-done", { timeout: 10000 });
        const put = mock.log.filter((e) => e.written).pop().written.text;
        const before = S.sourceBlocks(vaerekSrc, { includeTitles: true });
        const after = S.sourceBlocks(put, { includeTitles: true });
        const epBefore = before.find((b) => b.tag === "p" && b.inner === "Wreathbound Ranger");
        const epAfter = after.find((b) => b.start === epBefore.start || b.inner === "Ranger of the Wreath");
        const nameSame = before[0].inner === after[0].inner && before[0].tag === "h1";
        // Only the hero epithet range changes; trailing period stripped per site rule.
        const expected = S.splice(vaerekSrc, [{ start: epBefore.start, end: epBefore.end, html: "Ranger of the Wreath" }]);
        check("admin epithet save: only hero epithet region changes; trailing period stripped", put === expected && epAfter && epAfter.inner === "Ranger of the Wreath" && nameSame && !/\.$/.test(epAfter.inner), `ep=${JSON.stringify(epAfter && epAfter.inner)} delta=${put.length - vaerekSrc.length}`);
        // Body lore paragraph with entities still untouched.
        check("admin epithet save: body entity block unchanged", /didn&#x27;t last/.test(put) && put.includes(before.find((b) => /didn&#x27;t last/.test(b.inner)).inner));
        await ctx.close();
      }
      // Devin: edit name only — only the h1 region changes.
      {
        mock.setUpstream(vaerekPath, vaerekSrc); // reset after epithet test mutated the mock file
        mock.log.length = 0;
        const ctx = await ctxFor(browser, mock, { init: sessionInit("ghp_test_devin", "devin-gh", { person: "devin", role: "admin" }) });
        const page = await ctx.newPage();
        await page.goto(BASE + vaerekPath, { waitUntil: "networkidle" });
        await waitEditor(page);
        await page.click("#ee-glyph"); await page.waitForSelector("#ee-save");
        await page.evaluate(() => { document.querySelector(".art-title h1").textContent = "Vaerek Rathkin Prime"; });
        await page.click("#ee-save"); await page.waitForSelector("#ee-bar.ee-done", { timeout: 10000 });
        const put = mock.log.filter((e) => e.written).pop().written.text;
        const h1 = S.sourceBlocks(vaerekSrc, { includeTitles: true })[0];
        const expected = S.splice(vaerekSrc, [{ start: h1.start, end: h1.end, html: "Vaerek Rathkin Prime" }]);
        check("admin name save: only h1 region changes", put === expected && S.sourceBlocks(put, { includeTitles: true })[0].inner === "Vaerek Rathkin Prime", `h1=${JSON.stringify(S.sourceBlocks(put,{includeTitles:true})[0].inner)} delta=${put.length - vaerekSrc.length}`);
        // Entity preservation for titles: preserveEntities keeps &#x27; from the source when the glyph remains.
        const kept = await page.evaluate(() => window.EloraeEditor.preserveEntities("Vaerek's Rathkin X", "Vaerek&#x27;s Rathkin"));
        check("admin name: preserveEntities keeps &#x27; in title text", kept === "Vaerek&#x27;s Rathkin X", kept);
        await ctx.close();
      }
    }

    /* 6. Conflicts. */ 
    {
      const mock = newMock();
      const ctx = await ctxFor(browser, mock, { init: sessionInit("ghp_test_arts", "arts-gh") });
      const page = await ctx.newPage();
      await page.goto(BASE + vaerekPath, { waitUntil: "networkidle" });
      await waitEditor(page);
      const target = 'main.art-body #lore p.art-life:nth-of-type(2)';
      // (a) someone else edited the SAME block meanwhile -> refuse, no PUT
      await page.click("#ee-glyph"); await page.waitForSelector("#ee-save");
      await page.click(target); await page.keyboard.press("Control+End"); await page.keyboard.type(" Mine.");
      const blocks = S.sourceBlocks(vaerekSrc);
      const pIdx = blocks.findIndex((b) => b.inner.startsWith("The bastard son"));
      mock.setUpstream(vaerekPath, S.splice(vaerekSrc, [{ start: blocks[pIdx].start, end: blocks[pIdx].end, html: blocks[pIdx].inner + " Theirs." }]));
      await page.click("#ee-save");
      await page.waitForSelector("#ee-bar.ee-bad-bar", { timeout: 10000 });
      const t1 = await page.textContent("#ee-bar");
      check("conflict (same region changed upstream): clear message, nothing written", /changed this part of the page/.test(t1) && !mock.log.some((e) => e.written), t1.trim().slice(0, 100));
      // (b) PUT returns 409
      mock.heads.main = mock._newCommit("main", null); // reset upstream to original
      mock.hooks.before = (e) => (e.method === "PUT" ? { status: 409, data: { message: "articles/vaerek.html does not match abc" } } : null);
      await page.click("#ee-save");
      await page.waitForSelector("#ee-bar.ee-bad-bar", { timeout: 10000 });
      await page.waitForTimeout(300);
      const t2 = await page.textContent("#ee-bar");
      check("conflict (409 from GitHub): clear message", /changed this part of the page/.test(t2), t2.trim().slice(0, 100));
      mock.hooks.before = null;
      // (c) upstream changed a DIFFERENT block -> safe automatic rebase, both edits kept
      const other = blocks.findIndex((b) => b.inner.startsWith("He chose to travel"));
      const upstream = S.splice(vaerekSrc, [{ start: blocks[other].start, end: blocks[other].end, html: blocks[other].inner + " Upstream." }]);
      mock.setUpstream(vaerekPath, upstream);
      await page.click("#ee-save");
      await page.waitForSelector("#ee-bar.ee-done", { timeout: 10000 });
      const w = mock.log.filter((e) => e.written).pop().written.text;
      check("upstream change elsewhere: rebased, both edits kept", w.includes(" Upstream.") && w.includes(" Mine.") && w === S.splice(upstream, [{ start: S.sourceBlocks(upstream)[pIdx].start, end: S.sourceBlocks(upstream)[pIdx].end, html: S.sourceBlocks(upstream)[pIdx].inner + " Mine." }]), `len ${w.length} vs ${vaerekSrc.length}+16; ${JSON.stringify((w.match(/.{30}Mine\..{10}/) || [""])[0])}`);
      await ctx.close();
    }

    /* 7. PR mode (Sawyer). */
    {
      const mock = newMock();
      const ctx = await ctxFor(browser, mock, { init: sessionInit("ghp_test_sawyer", "sawyer-gh") });
      const page = await ctx.newPage();
      await page.goto(BASE + "articles/saoirse.html", { waitUntil: "networkidle" });
      await waitEditor(page);
      check("sawyer: no EDIT glyph on articles/saoirse.html", !(await page.$("#ee-glyph")));
      await page.goto(BASE + vaerekPath, { waitUntil: "networkidle" });
      await waitEditor(page);
      await page.click("#ee-glyph"); await page.waitForSelector("#ee-save");
      await page.click("main.art-body .art-dossier dd:nth-of-type(2)"); await page.keyboard.press("End"); await page.keyboard.type(" (test)");
      await page.click("#ee-save");
      await page.waitForSelector("#ee-bar.ee-done", { timeout: 10000 });
      const put = mock.log.find((e) => e.written);
      const pr = mock.pulls[0];
      check("sawyer (pr mode): branch + PUT on branch + pull request, main untouched", put && put.written.branch.startsWith("edit/sawyer-gh/") && pr && pr.base === "main" && mock.heads.main && !mock.commits[mock.heads.main].files[vaerekPath], put && put.written.branch);
      const t = await page.textContent("#ee-bar");
      check("pr mode: success message links the PR", /pull request #1/.test(t), t.trim().slice(0, 100));
      await ctx.close();
    }

    /* 7b. Hard ceiling: players are refused outside articles/, even for their own character. */
    {
      const mock = newMock();
      const cases = [
        ["ghp_test_sawyer", "sawyer-gh", ["index/ancients.html", "codex/lore.html", "atlas/hesk.html", "journal.html", "articles/saoirse.html", "articles/yena.html"], "articles/vaerek.html"],
        ["ghp_test_julie", "julie-gh", ["index/ancients.html", "codex/magics.html", "articles/vaerek.html", "articles/telorin.html", "articles/darmstadt.html"], "articles/saoirse.html"],
        ["ghp_test_jon", "jon-gh", ["articles/vaerek.html", "articles/bel-harath.html", "index/ancients.html"], "articles/silar-scorria.html"],
        ["ghp_test_jon", "jon-gh", [], "articles/telorin.html"],
        ["ghp_test_arts", "arts-gh", ["index/ancients.html", "journal.html"], "articles/kojin.html"]
      ];
      for (const [tok, login, refused, allowed] of cases) {
        const ctx = await ctxFor(browser, mock, { init: sessionInit(tok, login) });
        const page = await ctx.newPage();
        for (const p of refused) {
          await page.goto(BASE + p, { waitUntil: "networkidle" });
          await waitEditor(page);
          const r = await page.evaluate(() => { window.EloraeEditor.startEdit(); return { glyph: !!document.getElementById("ee-glyph"), ce: document.querySelectorAll("[contenteditable]").length }; });
          await page.waitForTimeout(150);
          check(`ceiling: ${login} refused on ${p} (no EDIT, edit mode won't start)`, !r.glyph && r.ce === 0 && !mock.log.some((e) => e.path.includes("/contents/" + p)), JSON.stringify(r));
        }
        await page.goto(BASE + allowed + "#edit", { waitUntil: "networkidle" });
        await waitEditor(page);
        const g = !!(await page.$("#ee-glyph"));
        const note = await page.textContent("#ee-body");
        check(`ceiling: ${login} still gets EDIT on ${allowed}`, g, note.replace(/\s+/g, " ").slice(0, 160));
        if (login === "sawyer-gh" || login === "julie-gh") check(`ceiling: ${login}'s out-of-articles rules are shown as ignored`, /players can only edit articles/i.test(note));
        await ctx.close();
      }
    }

    /* 8. Phone layout in edit mode. */
    {
      const mock = newMock();
      const ctx = await ctxFor(browser, mock, { viewport: { width: 390, height: 844 }, init: sessionInit("ghp_test_arts", "arts-gh") });
      const page = await ctx.newPage();
      await page.goto(BASE + vaerekPath, { waitUntil: "networkidle" });
      await waitEditor(page);
      await page.waitForSelector("#ee-glyph");
      await page.screenshot({ path: `${SHOTS}/glyph-phone.png` });
      await page.click("#ee-glyph"); await page.waitForSelector("#ee-save");
      const r = await page.evaluate(() => { const b = document.querySelector("#ee-bar").getBoundingClientRect(); return { l: b.left, r: b.right, bottom: b.bottom, w: innerWidth, h: innerHeight }; });
      await page.screenshot({ path: `${SHOTS}/editing-phone.png` });
      check("phone: Save/Cancel bar docked full-width at bottom", r.l === 0 && Math.abs(r.r - r.w) < 1 && Math.abs(r.bottom - r.h) < 1, JSON.stringify(r));
      await ctx.close();
    }

    /* 9. Dashboard link: Devin only. */
    {
      const mock = newMock();
      const cases = [
        ["anonymous", ""], ["seal jack", sealInit("jack")], ["arts editor", sessionInit("ghp_test_arts", "arts-gh", { role: "editor" })],
        ["devin (edit session)", sessionInit("ghp_test_devin", "devin-gh", { person: "devin", role: "admin" })], ["devin (seal)", sealInit("devin")]
      ];
      for (const [name, init] of cases) {
        const ctx = await ctxFor(browser, mock, { init });
        const page = await ctx.newPage();
        await page.goto(BASE + vaerekPath, { waitUntil: "networkidle" });
        await page.waitForTimeout(400);
        const d = await page.evaluate(() => { const a = document.getElementById("ee-dash"); if (!a) return null; const r = a.getBoundingClientRect(); return { text: getComputedStyle(a).textTransform === "uppercase" ? a.textContent.toUpperCase() : a.textContent, x: Math.round(r.left), y: Math.round(r.top), vis: r.width > 0 }; });
        const want = name.startsWith("devin");
        check(`DASHBOARD link ${want ? "shown" : "absent"} for ${name}`, want ? d && d.text === "DASHBOARD" && d.vis : !d, JSON.stringify(d));
        if (name === "devin (seal)") await page.screenshot({ path: `${SHOTS}/devin-nav-desktop.png`, clip: { x: 0, y: 0, width: 1440, height: 120 } });
        await ctx.close();
      }
      const ctx = await ctxFor(browser, mock, { viewport: { width: 390, height: 844 }, init: sealInit("devin") });
      const page = await ctx.newPage();
      await page.goto(BASE + vaerekPath, { waitUntil: "networkidle" });
      await page.waitForTimeout(400);
      const d = await page.evaluate(() => { const a = document.getElementById("ee-dash"); const r = a && a.getBoundingClientRect(); return r && { l: r.left, r: r.right, w: innerWidth, vis: r.width > 0 && r.height > 0 }; });
      check("DASHBOARD link visible on phone for Devin", d && d.vis && d.l >= 0 && d.r <= d.w, JSON.stringify(d));
      await page.screenshot({ path: `${SHOTS}/devin-nav-phone.png`, clip: { x: 0, y: 0, width: 390, height: 120 } });
      await ctx.close();
    }

    /* 9b. Dashboard is active immediately after Devin signs in (same page, no navigation). */
    {
      const mock = newMock();
      for (const [label, vp] of [["desktop", { width: 1440, height: 900 }], ["phone", { width: 390, height: 844 }]]) {
        // Content page: nav DASHBOARD appears on the login-success view itself.
        const ctx = await ctxFor(browser, mock, { viewport: vp });
        const page = await ctx.newPage();
        await page.goto(BASE + vaerekPath + "#edit", { waitUntil: "networkidle" });
        await page.waitForSelector("#ee-token", { timeout: 10000 });
        check(`pre-signin (${label}): no DASHBOARD yet`, !(await page.$("#ee-dash")));
        await page.fill("#ee-token", "ghp_test_devin");
        await page.click("#ee-form button[type=submit]");
        await page.waitForFunction(() => /Signed in as Devin/.test((document.getElementById("ee-who") || {}).textContent || ""), null, { timeout: 15000 });
        const info = await page.evaluate(() => {
          const a = document.getElementById("ee-dash");
          const r = a && a.getBoundingClientRect();
          const btn = document.getElementById("ee-goto-dash");
          return {
            hasNav: !!(a && r && r.width > 0 && r.height > 0),
            firstInMark: !!(a && a.parentElement && a.parentElement.firstElementChild === a),
            hasPanelDash: !!(btn && /dashboard/i.test(btn.textContent)),
            url: location.href
          };
        });
        check(`post-signin (${label}): DASHBOARD in nav on login-success page (no navigation)`, info.hasNav && info.firstInMark && info.hasPanelDash && /vaerek\.html/.test(info.url), JSON.stringify(info));
        await page.screenshot({ path: `${SHOTS}/signin-success-${label}.png`, fullPage: false });
        await ctx.close();

        // Dashboard page: secrets table appears in place; success panel stays; no reload.
        const ctx2 = await ctxFor(browser, mock, { viewport: vp });
        const page2 = await ctx2.newPage();
        let navigations = 0;
        page2.on("framenavigated", (f) => { if (f === page2.mainFrame()) navigations++; });
        await page2.goto(BASE + "edit/dashboard.html", { waitUntil: "networkidle" });
        const navsAfterGoto = navigations;
        await page2.waitForSelector("#ee-in", { timeout: 10000 });
        await page2.click("#ee-in");
        await page2.waitForSelector("#ee-token");
        await page2.fill("#ee-token", "ghp_test_devin");
        await page2.click("#ee-form button[type=submit]");
        await page2.waitForFunction(() => /Signed in as Devin/.test((document.getElementById("ee-who") || {}).textContent || "") && document.querySelectorAll("tr[data-row]").length === 12, null, { timeout: 20000 });
        const dinfo = await page2.evaluate(() => ({
          who: (document.getElementById("ee-who") || {}).textContent,
          rows: document.querySelectorAll("tr[data-row]").length,
          notes: [...document.querySelectorAll("#ee-body .ee-note")].map((n) => n.textContent).join(" | "),
          panelDash: (document.getElementById("ee-goto-dash") || {}).textContent,
          mainHasKey: /Your key/.test((document.getElementById("ee-dash-main") || {}).innerText || "")
        }));
        check(`post-signin dashboard (${label}): active in place (12 rows) with success panel, no reload`, dinfo.rows === 12 && /Signed in as Devin/.test(dinfo.who) && /ready on this page/.test(dinfo.notes) && dinfo.panelDash === "Dashboard" && dinfo.mainHasKey && navigations === navsAfterGoto, JSON.stringify({ dinfo, navigations, navsAfterGoto }));
        await page2.screenshot({ path: `${SHOTS}/dashboard-signin-success-${label}.png`, fullPage: false });
        // Closing via Dashboard button reveals the live dashboard.
        await page2.click("#ee-goto-dash");
        await page2.waitForFunction(() => { const p = document.getElementById("ee-panel"); return p && p.hidden; });
        check(`post-signin dashboard (${label}): Dashboard button closes panel onto live dashboard`, (await page2.$$("tr[data-row]")).length === 12);
        await ctx2.close();
      }
    }

    /* 9c. Media catalog: admin upload + visibility (binary commit). */
    {
      const mock = newMock();
      const ctx = await ctxFor(browser, mock, { init: sessionInit("ghp_test_devin", "devin-gh", { person: "devin", role: "admin" }) });
      const page = await ctx.newPage();
      await page.goto(BASE + "edit/dashboard.html", { waitUntil: "networkidle" });
      await page.waitForSelector("#ee-media-up", { timeout: 15000 });
      // Minimal PNG (1x1)
      const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
      await page.setInputFiles("#ee-media-file", { name: "Test Hero.png", mimeType: "image/png", buffer: png });
      await page.fill("#ee-media-title", "Test Hero");
      await page.fill("#ee-media-tags", "heroes, test");
      await page.click("#ee-media-up button[type=submit]");
      await page.waitForFunction(() => /Uploaded Test Hero/.test((document.getElementById("ee-msg") || {}).textContent || ""), null, { timeout: 30000 });
      const cat = JSON.parse(mock.file("edit/media/catalog.json"));
      const id = Object.keys(cat.media)[0];
      const entry = cat.media[id];
      const bin = mock.file(entry.path);
      check("media upload: catalog entry + binary asset committed", id === "test-hero" && entry.path === "assets/test-hero.png" && entry.title === "Test Hero" && entry.tags.join() === "heroes,test" && Buffer.isBuffer(bin) && bin.length >= 8 && bin[0] === 0x89, JSON.stringify({ id, path: entry && entry.path, len: bin && bin.length }));
      // Restrict to Devin only, then confirm list still shows for admin
      await page.uncheck('input[data-media="test-hero"][data-who="everyone"]');
      // everyone starts unchecked; check sawyer then uncheck
      const sawyer = await page.$('input[data-media="test-hero"][data-who="sawyer"]');
      if (sawyer) { await page.check('input[data-media="test-hero"][data-who="sawyer"]'); await page.waitForFunction(() => /Saved/.test((document.getElementById("ee-msg") || {}).textContent || ""), null, { timeout: 20000 }); }
      const cat2 = JSON.parse(mock.file("edit/media/catalog.json"));
      check("media visibility: sawyer allowed in catalog", (cat2.media["test-hero"].allowed || []).indexOf("sawyer") >= 0, JSON.stringify(cat2.media["test-hero"]));
      await ctx.close();
    }

    /* 10. Visibility layer: enroll, encrypt one secret, share/unshare, everyone. */
    {
      const mock = newMock();
      const pass = { devin: "devin test passphrase one", jack: "jack test passphrase two", julie: "julie test passphrase three", sawyer: "sawyer test passphrase four" };
      // Non-admin cannot use the dashboard.
      {
        const ctx = await ctxFor(browser, mock, { init: sessionInit("ghp_test_arts", "arts-gh") });
        const page = await ctx.newPage();
        await page.goto(BASE + "edit/dashboard.html", { waitUntil: "networkidle" });
        await page.waitForTimeout(500);
        const t = await page.textContent("#ee-dash-main");
        check("dashboard refuses non-admins", /only for admins/.test(t) && !(await page.$("table")), t.trim().slice(0, 80));
        await ctx.close();
      }
      // People enroll on secret.html?enroll and hand Devin their code.
      const codes = {};
      for (const who of ["jack", "julie", "sawyer"]) {
        const ctx = await ctxFor(browser, mock);
        const page = await ctx.newPage();
        await page.goto(BASE + "edit/secret.html?enroll", { waitUntil: "networkidle" });
        await page.selectOption("#ee-person", who);
        await page.fill("#ee-p1", pass[who]); await page.fill("#ee-p2", pass[who]);
        await page.click("#ee-f button[type=submit]");
        await page.waitForSelector("#ee-code", { timeout: 20000 });
        codes[who] = await page.inputValue("#ee-code");
        if (who === "jack") await page.screenshot({ path: `${SHOTS}/enroll-code.png` });
        await ctx.close();
      }
      check("enrollment codes contain no passphrase and no plaintext private key", Object.entries(codes).every(([w, c]) => !c.includes(pass[w]) && !/"d":/.test(c) && JSON.parse(c).privateKey.ct));
      const ctx = await ctxFor(browser, mock, { init: sessionInit("ghp_test_devin", "devin-gh", { person: "devin", role: "admin" }) });
      const page = await ctx.newPage();
      await page.goto(BASE + "edit/dashboard.html", { waitUntil: "networkidle" });
      await page.waitForSelector("#ee-enroll", { timeout: 10000 });
      const rows = await page.$$eval("tr[data-row]", (t) => t.length);
      check("dashboard (Devin): lists all 12 secrets", rows === 12, `rows=${rows}`);
      const links = await page.$$eval("tr[data-row]", (t) => t.map((r) => [r.dataset.row, r.querySelector(".ee-t a").getAttribute("href"), r.querySelector(".ee-t a").href]));
      const ids = Object.keys(JSON.parse(fs.readFileSync(path.join(ROOT, "edit/visibility.json"), "utf8")).secrets);
      check("dashboard: each of the 12 links to its sealed article ../articles/<id>.html (file exists)", links.length === 12 && links.every(([id, h, abs]) => h === "../articles/" + id + ".html" && abs === BASE + "articles/" + id + ".html" && fs.existsSync(path.join(ROOT, "articles", id + ".html"))) && ids.every((id) => links.some((l) => l[0] === id)), links.map((l) => l[1]).join(" "));
      await page.fill("#ee-p1", pass.devin); await page.fill("#ee-p2", pass.devin);
      await page.click("#ee-enroll button");
      await page.waitForFunction(() => /Key created/.test((document.getElementById("ee-msg") || {}).textContent || ""), null, { timeout: 30000 });
      for (const who of ["jack", "julie", "sawyer"]) {
        await page.fill("#ee-addcode", codes[who]);
        await page.click("#ee-add button");
        await page.waitForFunction((w) => new RegExp("Key saved for").test((document.getElementById("ee-msg") || {}).textContent || "") && document.querySelector(".ee-people").textContent.includes("key set"), who, { timeout: 30000 });
        await page.waitForTimeout(200);
      }
      // Encrypt Yena (owner Jack).
      await page.click('[data-encrypt="yena"]');
      await page.waitForFunction(() => /Encrypted/.test((document.getElementById("ee-msg") || {}).textContent || ""), null, { timeout: 60000 });
      const enc = mock.log.filter((e) => e.committed).pop();
      check("encrypt yena: one [edit-mode] commit with visibility.json + secrets/yena.json", enc && /\[edit-mode\]$/.test(enc.committed.message) && mock.file("edit/secrets/yena.json") && JSON.parse(mock.file("edit/visibility.json")).secrets.yena.status === "encrypted", enc && enc.committed.message);
      const secFile = mock.file("edit/secrets/yena.json");
      const sf = JSON.parse(secFile), ctBytes = Buffer.from(sf.ct, "base64");
      check("encrypted payload: only {v,id,epoch,alg,iv,ct}; ciphertext contains no plaintext caption/HTML/image bytes", Object.keys(sf).sort().join() === "alg,ct,epoch,id,iv,v" && !ctBytes.includes(Buffer.from("Vestige of the Dragon Soul")) && !ctBytes.includes(Buffer.from("<!doctype")) && !ctBytes.includes(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) && !secFile.includes("Vestige"), `${(secFile.length / 1e6).toFixed(1)} MB`);
      await page.screenshot({ path: `${SHOTS}/dashboard-desktop.png`, fullPage: true });

      async function tryOpen(who, label) {
        const c = await ctxFor(browser, mock, { init: who ? sealInit(who) : "" });
        const pg = await c.newPage();
        await pg.goto(BASE + "edit/secret.html?id=yena", { waitUntil: "networkidle" });
        await pg.waitForTimeout(300);
        if (who && (await pg.$("#ee-pass"))) {
          await pg.selectOption("#ee-person", who);
          await pg.fill("#ee-pass", pass[who]);
          await pg.click("#ee-f button[type=submit]");
        }
        let opened = false;
        // Opened = the Yena article rendered AND visible (the .sealed CSS gate must not hide it for a non-owner reader).
        try { await pg.waitForFunction(() => { const h = document.querySelector(".art-title h1"), m = document.querySelector("main.art-body"); return h && /Yena/.test(h.textContent) && m && m.offsetHeight > 0 && h.offsetHeight > 0; }, null, { timeout: 8000 }); opened = true; } catch (e) {}
        const msg = opened ? "" : await pg.textContent("body");
        await c.close();
        return { opened, msg: msg.replace(/\s+/g, " ").trim().slice(0, 80) };
      }
      let r = await tryOpen("jack"); check("yena: owner Jack can decrypt", r.opened, r.msg);
      r = await tryOpen("julie"); check("yena: Julie cannot (not shared)", !r.opened && /isn't shared with Julie/.test(r.msg), r.msg);
      // Share with Julie.
      await page.check('input[data-id="yena"][data-who="julie"]');
      await page.waitForFunction(() => /Saved/.test((document.getElementById("ee-msg") || {}).textContent || ""), null, { timeout: 30000 });
      r = await tryOpen("julie"); check("after sharing: Julie can decrypt", r.opened, r.msg);
      r = await tryOpen("sawyer"); check("after sharing with Julie: Sawyer still cannot", !r.opened, r.msg);
      r = await tryOpen(""); check("after sharing with Julie: anonymous cannot", !r.opened, r.msg);
      const epochBefore = JSON.parse(mock.file("edit/visibility.json")).secrets.yena.epoch;
      // Unshare Julie -> rotation.
      await page.uncheck('input[data-id="yena"][data-who="julie"]');
      await page.waitForFunction(() => /Saved/.test((document.getElementById("ee-msg") || {}).textContent || "") && !document.querySelector("#ee-dash-main").textContent.includes("Hiding"), null, { timeout: 30000 });
      const v2 = JSON.parse(mock.file("edit/visibility.json")).secrets.yena;
      check("unsharing rotates the key (new epoch, Julie's wrapped key removed)", v2.epoch === epochBefore + 1 && !v2.keys.julie && v2.keys.jack && v2.keys.devin);
      r = await tryOpen("julie"); check("after unsharing: Julie cannot decrypt", !r.opened, r.msg);
      r = await tryOpen("jack"); check("after rotation: Jack still can", r.opened, r.msg);
      // Everyone on / off.
      await page.check('input[data-id="yena"][data-who="everyone"]');
      await page.waitForFunction(() => /Saved/.test((document.getElementById("ee-msg") || {}).textContent || ""), null, { timeout: 30000 });
      r = await tryOpen(""); check("everyone on: anonymous can open", r.opened, r.msg);
      await page.uncheck('input[data-id="yena"][data-who="everyone"]');
      await page.waitForFunction(() => /Saved/.test((document.getElementById("ee-msg") || {}).textContent || "") && !document.querySelector("#ee-dash-main").textContent.includes("Hiding"), null, { timeout: 30000 });
      r = await tryOpen(""); check("everyone off (rotated): anonymous cannot", !r.opened, r.msg);
      const v3 = JSON.parse(mock.file("edit/visibility.json")).secrets.yena;
      check("everyone off clears openKey", !v3.openKey && v3.everyone === false);
      const commits = mock.log.filter((e) => e.committed);
      check("every dashboard change is an [edit-mode] commit to main", commits.length >= 8 && commits.every((e) => /\[edit-mode\]$/.test(e.committed.message)), `${commits.length} commits`);
      await page.screenshot({ path: `${SHOTS}/dashboard-desktop-after.png`, fullPage: true });
      await page.setViewportSize({ width: 390, height: 844 });
      await page.screenshot({ path: `${SHOTS}/dashboard-phone.png`, fullPage: false });
      await ctx.close();

      // Unlocked appearance identical to the original page.
      const shot = async (url, init) => {
        const c = await ctxFor(browser, mock, { init });
        const pg = await c.newPage();
        await pg.goto(url, { waitUntil: "networkidle" });
        if (await pg.$("#ee-pass")) { await pg.selectOption("#ee-person", "jack"); await pg.fill("#ee-pass", pass.jack); await pg.click("#ee-f button[type=submit]"); }
        await pg.waitForFunction(() => document.querySelector(".art-title h1"), null, { timeout: 10000 });
        await pg.waitForTimeout(4000);
        const buf = await pg.screenshot();
        const dom = await pg.evaluate(() => { const b = document.body.cloneNode(true); b.querySelectorAll(".art-hero.sealed, .art-body.sealed").forEach((e) => { e.classList.remove("sealed"); if (!e.className) e.removeAttribute("class"); }); b.querySelectorAll("img,[data-src],button[data-src]").forEach((i) => { i.removeAttribute("src"); i.removeAttribute("data-src"); }); b.querySelectorAll("canvas").forEach((c) => c.replaceWith(document.createElement("canvas"))); return b.outerHTML; });
        await c.close();
        buf.dom = dom;
        return buf;
      };
      const a = await shot(BASE + "articles/yena.html", sealInit("jack"));
      const a2 = await shot(BASE + "articles/yena.html", sealInit("jack"));
      const b2 = await shot(BASE + "edit/secret.html?id=yena", sealInit("jack"));
      fs.writeFileSync(`${SHOTS}/yena-original.png`, a); fs.writeFileSync(`${SHOTS}/yena-original-2.png`, a2); fs.writeFileSync(`${SHOTS}/yena-decrypted.png`, b2);
      // Pixel stats: [pixels differing at all, pixels differing by > 8/255, mean abs difference]
      const pxdiff = (x, y) => JSON.parse(require("child_process").execFileSync("python3", ["-c", "import sys,json;from PIL import Image;import numpy as n;a=n.asarray(Image.open(sys.argv[1]).convert('RGB')).astype(int);b=n.asarray(Image.open(sys.argv[2]).convert('RGB')).astype(int);d=abs(a-b).max(axis=2);print(json.dumps([int((d>0).sum()),int((d>8).sum()),float(d.mean())]))", x, y]).toString());
      const noise = pxdiff(`${SHOTS}/yena-original.png`, `${SHOTS}/yena-original-2.png`);
      const dd = pxdiff(`${SHOTS}/yena-original.png`, `${SHOTS}/yena-decrypted.png`);
      check("decrypted Yena: same rendered DOM as the unlocked sealed article (image URLs and the .sealed gate class aside)", a.dom === b2.dom && a.dom === a2.dom);
      check("decrypted Yena: screenshot matches the original (within the page's own frame-to-frame noise)", dd[1] <= 0.001 * 1440 * 900 && dd[2] < 0.5, `orig vs decrypted: ${dd[0]} px differ, ${dd[1]} by >8/255, mean ${dd[2].toFixed(3)}; orig vs orig: ${noise[0]} px, ${noise[1]} by >8/255`);
    }
  } catch (e) {
    console.error(e);
    check("no exceptions", false, e.message);
  } finally {
    await browser.close();
  }
  const failed = results.filter((r) => !r.ok);
  fs.writeFileSync(`${SHOTS}/results.json`, JSON.stringify(results, null, 2));
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
})();
