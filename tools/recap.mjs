#!/usr/bin/env node
/* tools/recap.mjs (nt22): session recap generator (no dependencies, Node 18+).
   Takes the NEWEST chapter of journal.html (the first <h1 id> in <main>; the source is
   newest-first) and writes data/recap.json, served as https://elorae.world/data/recap.json
   (GitHub Pages sends Access-Control-Allow-Origin: *), for the Foundry join screen and the
   in-game journal:
     { v, kind, id, title, label, url, image, caption, paragraphs[{html,text}], fragment, chapters, sourceHash }
   Text is the site's prose verbatim (first two paragraphs); links and images are made absolute.
   Deterministic: same journal.html, same output. Re-run after each new chapter:
     node tools/recap.mjs [--journal journal.html] [--base https://elorae.world/] [--out data] [--paragraphs 2] */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";

const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, all) => (x.startsWith("--") ? a.concat([[x.slice(2), all[i + 1]]]) : a), []));
const JOURNAL = args.journal ?? "journal.html";
const BASE = (args.base ?? "https://elorae.world/").replace(/\/?$/, "/");
const OUT = args.out ?? "data";
const NPARA = Number(args.paragraphs ?? 2);

const decode = (s) => s.replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
  .replace(/&(quot|amp|lt|gt|apos|nbsp|rsquo|lsquo|ldquo|rdquo|mdash|ndash|hellip);/g, (_, n) =>
    ({ quot: '"', amp: "&", lt: "<", gt: ">", apos: "'", nbsp: "\u00a0", rsquo: "\u2019", lsquo: "\u2018", ldquo: "\u201c", rdquo: "\u201d", mdash: "\u2014", ndash: "\u2013", hellip: "\u2026" }[n]));
const textOf = (html) => decode(html.replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();
const escAttr = (s) => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
const escText = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const pageUrl = new URL("journal.html", BASE).href;
const abs = (ref) => new URL(decode(ref), pageUrl).href;
const absolutize = (html) => html.replace(/\b(href|src)="([^"]*)"/g, (_, a, v) => `${a}="${escAttr(abs(v))}"`);

const src = readFileSync(JOURNAL, "utf8");
const main = src.slice(src.indexOf("<main"), src.indexOf("</main>"));
const parts = main.split(/(?=<h1 id=")/).filter((p) => p.startsWith("<h1 id="));
if (!parts.length) { console.error("No <h1 id> chapters in", JOURNAL); process.exit(1); }
const ch = parts[0];
const id = ch.match(/^<h1 id="([^"]+)"/)[1];
const title = textOf(ch.match(/^<h1[^>]*>([\s\S]*?)<\/h1>/)[1]);
const paras = [...ch.matchAll(/<p>([\s\S]*?)<\/p>/g)].slice(0, NPARA).map((m) => ({ html: absolutize(m[1]), text: textOf(m[1]) }));
const fig = ch.match(/<figure>([\s\S]*?)<\/figure>/);
const image = fig && fig[1].match(/<img[^>]*src="([^"]+)"/) ? abs(fig[1].match(/<img[^>]*src="([^"]+)"/)[1]) : "";
const caption = fig && fig[1].match(/<figcaption>([\s\S]*?)<\/figcaption>/) ? textOf(fig[1].match(/<figcaption>([\s\S]*?)<\/figcaption>/)[1]) : "";
const url = `${pageUrl}#${id}`;
const label = title.replace(/^Act ([IVXLC]+), /, "Act $1 · ");
const fragment = [
  `<article class="elorae-recap" data-chapter="${escAttr(id)}">`,
  `<p class="elorae-recap-label"><a href="${escAttr(url)}">${escText(label)}</a></p>`,
  image ? `<figure class="elorae-recap-figure"><img src="${escAttr(image)}" alt="${escAttr(caption)}">${caption ? `<figcaption>${escText(caption)}</figcaption>` : ""}</figure>` : "",
  ...paras.map((p) => `<p>${p.html}</p>`),
  `<p class="elorae-recap-more"><a href="${escAttr(url)}">Read the full chapter \u2192</a></p>`,
  `</article>`
].filter(Boolean).join("\n");
const recap = {
  v: 1, kind: "elorae-recap", id, title, label, url, image, caption, paragraphs: paras, fragment,
  chapters: parts.length, source: JOURNAL, base: BASE,
  sourceHash: createHash("sha256").update(ch).digest("hex").slice(0, 16)
};
mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, "recap.json"), JSON.stringify(recap, null, 2) + "\n");
console.log(`recap: ${id} "${title}" -> ${join(OUT, "recap.json")} (hash ${recap.sourceHash})`);
