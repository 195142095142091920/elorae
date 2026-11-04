/* E2E: nav glyphs (player-mark.js ni1) + profile glyph for every signed-in person.
   Run: PLAYWRIGHT=<path> CHROME=/usr/bin/google-chrome node edit/test/e2e-nav.js  (SHOTS=<dir> for screenshots) */
"use strict";
const { chromium } = require(process.env.PLAYWRIGHT || "playwright-core");
const { MockGitHub } = require("./mock-github.js");
const { serverForTests } = require("./server.js");
const SHOTS = process.env.SHOTS || "";
const results = [];
function check(n, ok, d) { results.push(ok); console.log((ok ? "PASS " : "FAIL ") + n + (d ? "  — " + d : "")); }
const PAGES = ["journal/", "articles/vaerek/", "index/ancients/", "journal/iii-xix/", "atlas/"];
(async () => {
  const srv = await serverForTests(); const BASE = srv.base;
  const mock = new MockGitHub({ repo: "195142095142091920/elorae", root: require("./server.js").ROOT, tokens: { ghp_t: "devin-gh" } });
  const browser = await chromium.launch({ executablePath: process.env.CHROME, args: ["--no-sandbox"] });
  for (const who of ["jack", "jon", "julie", "sawyer", "sylum", "jason", "devin", "guest"]) {
    for (const vp of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
      const ctx = await browser.newContext({ viewport: vp });
      await ctx.route("https://api.github.com/**", (r) => mock.handle ? mock.handle(r) : r.abort());
      await ctx.route((u) => !u.href.startsWith(BASE) && !u.href.startsWith("data:") && !u.href.startsWith("https://api.github.com"), (r) => r.abort());
      const init = who === "guest" ? `localStorage.setItem("elorae-guest","1");`
        : `localStorage.setItem("elorae-login","${who}");document.cookie="elorae-login=${who};path=/";` +
          (who === "devin" ? `localStorage.setItem("elorae-edit-session",${JSON.stringify(JSON.stringify({ token: "ghp_t", login: "devin-gh", person: "devin", role: "admin", remember: true }))});` : "");
      await ctx.addInitScript(`try{${init}}catch(e){}`);
      const page = await ctx.newPage();
      for (const p of (vp.width === 390 ? ["journal/"] : PAGES)) {
        await page.goto(BASE + p, { waitUntil: "load" }); await page.waitForTimeout(700);
        const r = await page.evaluate(() => {
          const pm = document.querySelector(".mast .nt-pmark");
          const nav = [...document.querySelectorAll(".mast .filters a")].map((a) => [a.getAttribute("data-ni"), a.title, a.getBoundingClientRect().width]);
          const vis = (id) => { const e = document.getElementById(id); return !!(e && e.offsetParent && e.getAttribute("data-ni")); };
          return { pm: pm ? pm.getAttribute("href") : null, pmVis: !!(pm && pm.offsetParent), nav, ed: vis("ee-edit"), gal: vis("ee-gallery"), lo: vis("login-logout"), sw: document.documentElement.scrollWidth };
        });
        const tag = `${who} ${vp.width} ${p}`;
        if (who === "guest") check(tag + " no profile", !r.pm);
        else check(tag + " profile", r.pmVis && /\/players\/(\w+)\/$/.test(r.pm) && r.pm.endsWith("/players/" + who + "/"), r.pm);
        check(tag + " nav icons", r.nav.length === 4 && r.nav.every((n) => n[0] && n[1] && n[2] < 60), JSON.stringify(r.nav.map((n) => n[1])));
        if (who === "devin" && vp.width === 1440) check(tag + " edit/gallery/logout icons", r.ed && r.gal && r.lo);
        if (who !== "devin") check(tag + " no edit/gallery", !r.ed && !r.gal);
        if (vp.width === 390) console.log("   scrollWidth", r.sw);
        if (SHOTS && p === "journal/" && (who === "devin" || who === "sawyer")) await page.screenshot({ path: `${SHOTS}/nav-${who}-${vp.width}.png` });
      }
      await ctx.close();
    }
  }
  await browser.close(); srv.close();
  const f = results.filter((x) => !x).length;
  console.log(`\n${results.length - f}/${results.length} passed`); process.exit(f ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
