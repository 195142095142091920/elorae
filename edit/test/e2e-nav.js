/* E2E: nav glyphs (player-mark.js ni1) + profile glyph for every signed-in person.
   Run: PLAYWRIGHT=<path> CHROME=/usr/bin/google-chrome node edit/test/e2e-nav.js  (SHOTS=<dir> for screenshots) */
"use strict";
const { chromium } = require(process.env.PLAYWRIGHT || "playwright-core");
const { MockGitHub } = require("./mock-github.js");
const { serverForTests } = require("./server.js");
const SHOTS = process.env.SHOTS || "";
const results = [];
function check(n, ok, d) { results.push(ok); console.log((ok ? "PASS " : "FAIL ") + n + (d ? "  — " + d : "")); }
const PAGES = ["journal/", "articles/vaerek/", "index/ancients/", "journal/iii-xix/", "atlas/", "players/jack/", "players/devin/", "codex/lore/", "atlas.html", "articles/vaerek.html", "404.html"];
// "+devin-gh" = player/guest login on a browser that still holds a Devin GitHub session (the leak).
(async () => {
  const srv = await serverForTests(); const BASE = srv.base;
  const mock = new MockGitHub({ repo: "195142095142091920/elorae", root: require("./server.js").ROOT, tokens: { ghp_t: "devin-gh" } });
  const browser = await chromium.launch({ executablePath: process.env.CHROME, args: ["--no-sandbox"] });
  for (const who0 of ["jack", "jon", "julie", "sawyer", "sylum", "jason", "devin", "guest", "jack+devin-gh", "jason+devin-gh", "guest+devin-gh", "none+devin-gh", "jack+devin-ls"]) {
    const who = who0.split("+")[0], leak = who0.includes("+"), ls = who0.endsWith("devin-ls");
    for (const vp of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
      const ctx = await browser.newContext({ viewport: vp });
      await ctx.route("https://api.github.com/**", (r) => mock.handle ? mock.handle(r) : r.abort());
      await ctx.route((u) => !u.href.startsWith(BASE) && !u.href.startsWith("data:") && !u.href.startsWith("https://api.github.com"), (r) => r.abort());
      const init = (who === "none" ? "" : who === "guest" ? `localStorage.setItem("elorae-guest","1");`
        // devin-ls: cookie says the player, but localStorage still says devin
        : `localStorage.setItem("elorae-login","${ls ? "devin" : who}");document.cookie="elorae-login=${who};path=/";`) +
          (who === "devin" || leak ? `localStorage.setItem("elorae-edit-session",${JSON.stringify(JSON.stringify({ token: "ghp_t", login: "devin-gh", person: "devin", role: "admin", remember: true }))});` : "");
      await ctx.addInitScript(`try{${init}}catch(e){}`);
      const page = await ctx.newPage();
      for (const p of (vp.width === 390 ? ["journal/", "players/jack/"] : PAGES)) {
        let early = false;
        if (who !== "devin") {
          await page.goto(BASE + p, { waitUntil: "commit" });
          for (let i = 0; i < 12; i++) { early = early || await page.evaluate(() => { const v = (id) => { const e = document.getElementById(id); return !!(e && e.getBoundingClientRect().width > 0); }; return v("ee-edit") || v("ee-gallery"); }).catch(() => false); await page.waitForTimeout(50); }
        }
        await page.goto(BASE + p, { waitUntil: "load" }); await page.waitForTimeout(700);
        const r = await page.evaluate(() => {
          const pm = document.querySelector(".mast .nt-pmark");
          const nav = [...document.querySelectorAll(".mast .filters a")].map((a) => [a.getAttribute("data-ni"), a.title, a.getBoundingClientRect().width]);
          const vis = (id) => { const e = document.getElementById(id); return !!(e && e.offsetParent && e.getAttribute("data-ni")); };
          return { pm: pm ? pm.getAttribute("href") : null, pmVis: !!(pm && pm.offsetParent), nav, ed: vis("ee-edit"), gal: vis("ee-gallery"), lo: vis("login-logout"), sw: document.documentElement.scrollWidth };
        });
        const tag = `${who0} ${vp.width} ${p}`;
        if (who !== "devin") check(tag + " no edit/gallery during load", !early);
        if (who === "guest" || who === "none") check(tag + " no profile", !r.pm);
        else if (p === "404.html") {}
        else check(tag + " profile", r.pmVis && /\/players\/(\w+)\/$/.test(r.pm) && r.pm.endsWith("/players/" + who + "/"), r.pm);
        if (r.nav.length) check(tag + " nav icons", r.nav.length === 4 && r.nav.every((n) => n[0] && n[1] && n[2] < 60), JSON.stringify(r.nav.map((n) => n[1])));
        if (who === "devin" && vp.width === 1440 && p !== "404.html") check(tag + " edit/gallery/logout icons", r.ed && r.gal && r.lo);
        if (who !== "devin") check(tag + " no edit/gallery", !r.ed && !r.gal);
        if (vp.width === 390) console.log("   scrollWidth", r.sw);
        if (SHOTS && p === "journal/" && (who0 === "devin" || who0 === "sawyer")) await page.screenshot({ path: `${SHOTS}/nav-${who}-${vp.width}.png` });
      }
      await ctx.close();
    }
  }
  await browser.close(); srv.close();
  const f = results.filter((x) => !x).length;
  console.log(`\n${results.length - f}/${results.length} passed`); process.exit(f ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
