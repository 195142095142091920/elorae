/* e2e-invite.js (inv1): player Invite lives on Devin's player page, Devin only; Dashboard is gone.
   PLAYWRIGHT=… CHROME=/usr/bin/google-chrome node edit/test/e2e-invite.js */
"use strict";
const { chromium } = require(process.env.PLAYWRIGHT || "playwright-core");
const { MockGitHub } = require("./mock-github.js");
const { serverForTests, ROOT } = require("./server.js");
const REPO = "195142095142091920/elorae";
let fails = 0;
function check(n, ok, d) { if (!ok) fails++; console.log((ok ? "PASS " : "FAIL ") + n + (d ? "  — " + d : "")); }
(async () => {
  const srv = await serverForTests(); const BASE = srv.base;
  const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ["--no-sandbox"] });
  const mock = new MockGitHub({ repo: REPO, root: ROOT, tokens: { ghp_test_devin: "195142095142091920", ghp_test_jack: "jack-gh" } });
  async function ctx(who, vp) {
    const c = await browser.newContext({ viewport: vp || { width: 1440, height: 900 } });
    await c.route("https://api.github.com/**", (r) => mock.handle(r));
    if (who) {
      const s = JSON.stringify({ token: "ghp_test_" + who, login: who + "-gh", person: who, role: who === "devin" ? "admin" : "editor", remember: true });
      await c.addInitScript(`localStorage.setItem("elorae-edit-session",${JSON.stringify(s)});localStorage.setItem("elorae-login","${who}");document.cookie="elorae-login=${who};path=/";`);
    }
    return c;
  }
  for (const who of ["", "jack"]) {
    const c = await ctx(who); const p = await c.newPage();
    await p.goto(BASE + "players/devin/", { waitUntil: "networkidle" }); await p.waitForTimeout(600);
    check(`no Invite for ${who || "guest"}`, !(await p.$("#pl-invite"))); await c.close();
  }
  const c = await ctx("devin"); const p = await c.newPage();
  await p.goto(BASE + "players/devin/", { waitUntil: "networkidle" });
  await p.waitForSelector('#pl-invite form[data-invite="sawyer"]', { timeout: 15000 });
  check("Devin: no DASHBOARD in nav, Gallery present", !(await p.$("#ee-dash")) && !!(await p.$("#ee-gallery")));
  await p.fill('#pl-invite form[data-invite="sawyer"] input', "sawyer-real");
  await p.click('#pl-invite form[data-invite="sawyer"] button');
  await p.waitForFunction(() => /Profile updated/.test((document.getElementById("pl-invite-msg") || {}).textContent || ""), null, { timeout: 15000 });
  const prof = JSON.parse(mock.file("edit/profiles.json")).profiles;
  check("invite: collaborator PUT (push) + profiles.json bound", mock.collabs && mock.collabs["sawyer-real"] && mock.collabs["sawyer-real"].permission === "push" && prof["sawyer-real"] && prof["sawyer-real"].person === "sawyer" && !prof["<sawyer-github-login>"]);
  check("invite: row shows @sawyer-real", /@sawyer-real/.test(await p.textContent('#pl-invite li[data-person="sawyer"]')));
  if (process.env.SHOT) { await p.evaluate(() => document.getElementById("pl-invite").scrollIntoView()); await p.screenshot({ path: process.env.SHOT }); }
  await p.goto(BASE + "edit/dashboard/", { waitUntil: "load" }); await p.waitForTimeout(500);
  check("old Dashboard URL redirects to the Index", /\/index\/$/.test(p.url()), p.url());
  await browser.close(); srv.close && srv.close();
  console.log(fails ? fails + " FAILED" : "ALL PASS"); process.exit(fails ? 1 : 0);
})();
