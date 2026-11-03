/* Rewrites the Categories rail in every article page (both copies) from the Index rail, using the
   same build() the pages run (rail-sections.js rd2), so the static copy and the runtime refresh
   always agree. Run from the repo root after cards are added outside the organizer:
     PLAYWRIGHT=<path> CHROME=/usr/bin/google-chrome node tools/sync-article-rails.js */
"use strict";
const fs = require("fs"), path = require("path");
const { chromium } = require(process.env.PLAYWRIGHT || "playwright");
const ROOT = path.resolve(__dirname, "..");
(async () => {
  const files = [];
  for (const d of fs.readdirSync(path.join(ROOT, "articles"))) {
    const f = path.join(ROOT, "articles", d, "index.html");
    if (fs.existsSync(f)) files.push({ slug: d, f, copy: path.join(ROOT, "articles", d + ".html") });
  }
  const indexHtml = fs.readFileSync(path.join(ROOT, "index/ancients/index.html"), "utf8");
  const rs = fs.readFileSync(path.join(ROOT, "rail-sections.js"), "utf8");
  const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ["--no-sandbox"] });
  const page = await browser.newPage();
  await page.setContent("<!doctype html><body></body>");
  await page.addScriptTag({ content: rs });
  let changed = 0;
  for (const it of files) {
    const T = fs.readFileSync(it.f, "utf8");
    const m = /(<nav class="art-index-panel"[^>]*>[\s\S]*?<h3>Categories<\/h3>)([\s\S]*?)(<\/nav>)/.exec(T);
    if (!m) continue;
    const out = await page.evaluate(([idx, cur, p]) => {
      const idoc = new DOMParser().parseFromString(idx, "text/html");
      const old = document.createElement("div"); old.innerHTML = cur;
      const prev = old.querySelector(".toc-cat > .toc-row > a.on");
      const frag = window.EloraeRailSections.build(idoc, p, prev && prev.getAttribute("href"));
      const d = document.createElement("div"); d.appendChild(frag);
      return d.innerHTML;
    }, [indexHtml, m[2], "/articles/" + it.slug + "/"]);
    if (!out || out === m[2]) continue;
    const N = T.slice(0, m.index) + m[1] + out + m[3] + T.slice(m.index + m[0].length);
    fs.writeFileSync(it.f, N);
    if (fs.existsSync(it.copy)) {
      const C = fs.readFileSync(it.copy, "utf8");
      if (C === T) fs.writeFileSync(it.copy, N);
      else {
        const mc = /(<nav class="art-index-panel"[^>]*>[\s\S]*?<h3>Categories<\/h3>)([\s\S]*?)(<\/nav>)/.exec(C);
        if (mc) fs.writeFileSync(it.copy, C.slice(0, mc.index) + mc[1] + out + mc[3] + C.slice(mc.index + mc[0].length));
      }
    }
    changed++;
  }
  await browser.close();
  console.log(`rails rewritten in ${changed} of ${files.length} articles (both copies)`);
})();
