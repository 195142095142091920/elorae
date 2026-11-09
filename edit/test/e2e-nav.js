/* E2E: text nav by default (player-mark.js nt1); optional icons via Settings
   (localStorage elorae-nav-icons:<who>); profile link for every signed-in person;
   Edit/Gallery Devin-only (do1).
   Run: PLAYWRIGHT=<path> CHROME=/usr/bin/google-chrome node edit/test/e2e-nav.js  (SHOTS=<dir> for screenshots) */
"use strict";
const { chromium } = require(process.env.PLAYWRIGHT || "playwright-core");
const { MockGitHub } = require("./mock-github.js");
const { serverForTests } = require("./server.js");
const SHOTS = process.env.SHOTS || "";
const results = [];
function check(n, ok, d) { results.push(ok); console.log((ok ? "PASS " : "FAIL ") + n + (d ? "  — " + d : "")); }
const PAGES = ["journal/", "articles/vaerek/", "index/ancients/", "journal/iii-xix/", "atlas/", "players/jack/", "players/devin/", "codex/lore/", "atlas.html", "articles/vaerek.html", "404.html"];
const PLAYERS = ["jack", "jon", "julie", "sawyer", "sylum", "jason", "devin"];
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
          const nav = [...document.querySelectorAll(".mast .filters a")].map((a) => ({
            ni: a.getAttribute("data-ni"),
            text: (a.textContent || "").trim(),
            title: a.title,
            w: a.getBoundingClientRect().width
          }));
          const vis = (id) => { const e = document.getElementById(id); return !!(e && e.offsetParent); };
          const visNi = (id) => { const e = document.getElementById(id); return !!(e && e.offsetParent && e.getAttribute("data-ni")); };
          return {
            pm: pm ? pm.getAttribute("href") : null,
            pmVis: !!(pm && pm.offsetParent),
            pmNi: pm ? pm.getAttribute("data-ni") : null,
            pmSvg: !!(pm && pm.querySelector("svg")),
            nav,
            ed: vis("ee-edit"), gal: vis("ee-gallery"),
            edNi: visNi("ee-edit"), galNi: visNi("ee-gallery"), loNi: visNi("login-logout"),
            lo: vis("login-logout"),
            sw: document.documentElement.scrollWidth
          };
        });
        const tag = `${who0} ${vp.width} ${p}`;
        if (who !== "devin") check(tag + " no edit/gallery during load", !early);
        if (who === "guest" || who === "none") check(tag + " no profile", !r.pm);
        else if (p === "404.html") {}
        else check(tag + " profile", r.pmVis && /\/players\/(\w+)\/$/.test(r.pm) && r.pm.endsWith("/players/" + who + "/"), r.pm);
        if (r.nav.length) {
          // Default = text words, no data-ni, and wide enough to be words (not icon-only ~40px).
          check(tag + " nav text default", r.nav.length === 4 && r.nav.every((n) => !n.ni && /^(Atlas|Codex|Index|Journal)$/.test(n.text) && n.w > 40), JSON.stringify(r.nav.map((n) => [n.ni, n.text, Math.round(n.w)])));
        }
        if (who === "devin" && vp.width === 1440 && p !== "404.html") {
          check(tag + " edit/gallery/logout text", r.ed && r.gal && r.lo && !r.edNi && !r.galNi && !r.loNi);
        }
        if (who !== "devin") check(tag + " no edit/gallery", !r.ed && !r.gal);
        if (vp.width === 390) console.log("   scrollWidth", r.sw);
        if (SHOTS && p === "journal/" && who0 === "devin" && vp.width === 1440) {
          await page.screenshot({ path: `${SHOTS}/nav-text-1440.png`, fullPage: false });
        }
      }
      await ctx.close();
    }
  }

  // Icon toggle: each signed-in person can flip Settings and then sees icons; fresh = text.
  for (const who of PLAYERS) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await ctx.route("https://api.github.com/**", (r) => mock.handle ? mock.handle(r) : r.abort());
    await ctx.route((u) => !u.href.startsWith(BASE) && !u.href.startsWith("data:") && !u.href.startsWith("https://api.github.com"), (r) => r.abort());
    const init = `localStorage.setItem("elorae-login","${who}");document.cookie="elorae-login=${who};path=/";` +
      (who === "devin" ? `localStorage.setItem("elorae-edit-session",${JSON.stringify(JSON.stringify({ token: "ghp_t", login: "devin-gh", person: "devin", role: "admin", remember: true }))});` : "");
    await ctx.addInitScript(`try{${init}}catch(e){}`);
    const page = await ctx.newPage();
    await page.goto(BASE + "journal/", { waitUntil: "load" }); await page.waitForTimeout(500);
    let r = await page.evaluate(() => [...document.querySelectorAll(".mast .filters a")].map((a) => a.getAttribute("data-ni")));
    check(`${who} fresh journal text`, r.every((x) => !x), JSON.stringify(r));

    await page.goto(BASE + "players/" + who + "/", { waitUntil: "load" }); await page.waitForTimeout(900);
    const hasSw = await page.evaluate(() => !!document.querySelector(".nt-pl-settings .nt-pl-sw"));
    check(`${who} settings switch`, hasSw);
    if (hasSw) {
      await page.click(".nt-pl-settings .nt-pl-sw");
      await page.waitForTimeout(300);
      r = await page.evaluate(() => ({
        pressed: document.querySelector(".nt-pl-settings .nt-pl-sw").getAttribute("aria-checked"),
        nav: [...document.querySelectorAll(".mast .filters a")].map((a) => [a.getAttribute("data-ni"), a.title]),
        pref: localStorage.getItem("elorae-nav-icons:" + (localStorage.getItem("elorae-login") || ""))
      }));
      check(`${who} toggle on`, r.pressed === "true" && r.pref === "1" && r.nav.length === 4 && r.nav.every((n) => n[0] && n[1]), JSON.stringify(r.nav));
      if (who === "devin" && SHOTS) {
        await page.screenshot({ path: `${SHOTS}/nav-settings-control.png`, fullPage: false });
        // Crop-ish: also grab journal with icons
      }
      await page.goto(BASE + "journal/", { waitUntil: "load" }); await page.waitForTimeout(500);
      r = await page.evaluate(() => ({
        nav: [...document.querySelectorAll(".mast .filters a")].map((a) => [a.getAttribute("data-ni"), a.getBoundingClientRect().width]),
        ed: !!(document.getElementById("ee-edit") && document.getElementById("ee-edit").offsetParent && document.getElementById("ee-edit").getAttribute("data-ni")),
        gal: !!(document.getElementById("ee-gallery") && document.getElementById("ee-gallery").offsetParent && document.getElementById("ee-gallery").getAttribute("data-ni")),
        pm: document.querySelector(".mast .nt-pmark") && document.querySelector(".mast .nt-pmark").getAttribute("data-ni")
      }));
      check(`${who} icons persist journal`, r.nav.every((n) => n[0] && n[1] < 60) && r.pm === "profile", JSON.stringify(r));
      if (who === "devin") check(`${who} icons edit/gallery`, r.ed && r.gal);
      if (who === "devin" && SHOTS) await page.screenshot({ path: `${SHOTS}/nav-icons-via-setting-1440.png`, fullPage: false });

      // Flip back off
      await page.goto(BASE + "players/" + who + "/", { waitUntil: "load" }); await page.waitForTimeout(700);
      await page.click(".nt-pl-settings .nt-pl-sw");
      await page.waitForTimeout(300);
      r = await page.evaluate(() => ({
        pressed: document.querySelector(".nt-pl-settings .nt-pl-sw").getAttribute("aria-checked"),
        pref: localStorage.getItem("elorae-nav-icons:" + (localStorage.getItem("elorae-login") || "")),
        nav: [...document.querySelectorAll(".mast .filters a")].map((a) => a.getAttribute("data-ni"))
      }));
      check(`${who} toggle off`, r.pressed === "false" && !r.pref && r.nav.every((x) => !x), JSON.stringify(r));
    }
    await ctx.close();
  }

  await browser.close(); srv.close();
  const f = results.filter((x) => !x).length;
  console.log(`\n${results.length - f}/${results.length} passed`); process.exit(f ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
