/* Rebuilds autolink.json (site-wide auto-links) from every article page, the Gallery catalog
   and usage.json. Admin edit-mode saves keep it current on their own (edit/autolink.js via core.js);
   run this after articles change outside the editor:   node tools/build-autolink.js */
"use strict";
const fs = require("fs"), path = require("path"), { execSync } = require("child_process");
const A = require("../edit/autolink.js");
const ROOT = path.resolve(__dirname, "..");
const rd = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
// Prefer the pretty copy articles/<slug>/index.html; fall back to articles/<slug>.html.
const all = execSync("git ls-files 'articles/*.html' 'articles/*/index.html'", { cwd: ROOT }).toString().split("\n").filter(Boolean);
const bySlug = {};
all.forEach((p) => { const s = A.slugOf(p); if (s && (!bySlug[s] || /\/index\.html$/.test(p))) bySlug[s] = p; });
const files = Object.keys(bySlug).map((s) => ({ path: bySlug[s], text: rd(bySlug[s]) }));
// Atlas places are never used as name parts.
global.window = {}; require(path.join(ROOT, "search-index.js"));
const reserved = (window.SEARCH_INDEX || []).filter((e) => e.kind === "atlas").map((e) => e.title).sort();
const base = A.empty(); base.reserved = reserved;
let old = ""; try { old = rd(A.PATH); } catch (e) {}
try { const o = JSON.parse(old); if (o && o._readme) base._readme = o._readme; } catch (e) {}
const next = A.update(A.render(base), files, rd(A.CATALOG), rd(A.USAGE)) || A.render(base);
fs.writeFileSync(path.join(ROOT, A.PATH), next);
const o = JSON.parse(next);
console.log(`autolink.json: ${Object.keys(o.articles).length} articles, ${Object.keys(o.terms).length} terms, ${Object.keys(o.skipped).length} skipped, ${next.length} bytes`);
if (Object.keys(o.skipped).length) console.log("skipped (ambiguous):", JSON.stringify(o.skipped));
