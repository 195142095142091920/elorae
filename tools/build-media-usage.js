/* Rebuilds edit/media/usage.json (Gallery "Used on") from every site page. Edit-mode saves keep
   it current on their own (edit/usage.js via core.js); run this after pages change outside the
   editor:   node tools/build-media-usage.js */
"use strict";
const fs = require("fs"), path = require("path"), { execSync } = require("child_process");
const U = require("../edit/usage.js");
const ROOT = path.resolve(__dirname, "..");
const files = execSync("git ls-files '*.html'", { cwd: ROOT }).toString().split("\n").filter(Boolean)
  .map((p) => ({ path: p, text: fs.readFileSync(path.join(ROOT, p), "utf8") }));
const out = path.join(ROOT, U.PATH);
const next = U.update(JSON.stringify(U.empty()), files) || JSON.stringify(U.empty(), null, 1) + "\n";
fs.writeFileSync(out, next);
const o = JSON.parse(next), imgs = new Set();
Object.values(o.pages).forEach((p) => Object.keys(p.u).forEach((k) => imgs.add(k)));
console.log(`usage.json: ${Object.keys(o.pages).length} pages, ${imgs.size} images, ${next.length} bytes`);
