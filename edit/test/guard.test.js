/* Edit guard tests: builds a throwaway git repo and runs edit/guard.js against scenarios.
   Run: node edit/test/guard.test.js */
"use strict";
const { execFileSync, spawnSync } = require("child_process");
const fs = require("fs"), os = require("os"), path = require("path");
const GUARD = path.resolve(__dirname, "../guard.js");
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "edit-guard-"));
const git = (...a) => execFileSync("git", ["-c", "user.name=T", "-c", "user.email=t@t", ...a], { cwd: dir, encoding: "utf8" }).trim();
const write = (p, t) => { fs.mkdirSync(path.dirname(path.join(dir, p)), { recursive: true }); fs.writeFileSync(path.join(dir, p), t); };
const commit = (msg) => { git("add", "-A"); git("commit", "-q", "-m", msg); return git("rev-parse", "HEAD"); };
const run = (base, head, actor) => { const r = spawnSync("node", [GUARD, "--base", base, "--head", head, "--actor", actor, "--owner", "owner-gh"], { cwd: dir, encoding: "utf8" }); return { code: r.status, out: r.stdout + r.stderr }; };
let pass = 0, fail = 0;
const check = (name, ok, detail) => { console.log((ok ? "PASS " : "FAIL ") + name + (ok || !detail ? "" : "\n" + detail)); ok ? pass++ : fail++; };

git("init", "-q", "-b", "main");
write("edit/profiles.json", JSON.stringify({ profiles: {
  "owner-gh": { role: "admin", permissions: ["**"] },
  "sawyer-gh": { role: "editor", permissions: ["articles/vaerek.html", "index/heroes.html", "codex/vaerek.html"] },
  "julie-gh": { role: "editor", permissions: ["articles/saoirse.html", "**"] },
  "jon-gh": { role: "editor", permissions: ["articles/silar-scorria.html", "articles/telorin.html"] },
  "player5-gh": { role: "editor", person: "sylum", permissions: ["articles/alaric.html"], save: "pr" },
  "viewer-gh": { role: "viewer", permissions: "view" } } }));
for (const f of ["articles/vaerek.html", "articles/saoirse.html", "articles/silar-scorria.html", "articles/telorin.html", "articles/yena.html", "index/heroes.html", "codex/vaerek.html", "index/ancients.html", "journal.html", "codex/lore.html", "index.html", "edit/visibility.json", "articles/alaric.html", "articles/alaric/index.html", "articles/galand-helviath.html", "players/sylum.html", "players/sylum/index.html"]) write(f, "<p>x</p>\n");
const BASE = commit("base");
const scenario = (name, files, msg, actor, expectCode, expectText) => {
  git("checkout", "-q", "--detach", BASE);
  for (const f of files) fs.appendFileSync(path.join(dir, f), "y\n");
  const head = commit(msg);
  const r = run(BASE, head, actor);
  check(name, r.code === expectCode && (!expectText || r.out.includes(expectText)), r.out);
};
scenario("sawyer edits own article", ["articles/vaerek.html"], "Edit articles/vaerek.html via edit mode [edit-mode]", "sawyer-gh", 0);
scenario("sawyer refused on index/ (listed in his profile)", ["index/heroes.html"], "Edit index/heroes.html via edit mode [edit-mode]", "sawyer-gh", 1, "non-admins may only edit articles/*.html");
scenario("sawyer refused on codex/ (listed in his profile)", ["codex/vaerek.html"], "x [edit-mode]", "sawyer-gh", 1, "non-admins may only edit articles/*.html");
scenario("sawyer refused on another player's article", ["articles/saoirse.html"], "x [edit-mode]", "sawyer-gh", 1, "may not edit articles/saoirse.html");
scenario("julie with '**' still refused on index/", ["index/ancients.html"], "x [edit-mode]", "julie-gh", 1, "non-admins may only edit");
scenario("julie with '**' still refused on journal", ["journal.html"], "x [edit-mode]", "julie-gh", 1, "non-admins may only edit");
scenario("julie with '**' still refused on codex/", ["codex/lore.html"], "x [edit-mode]", "julie-gh", 1);
scenario("julie's over-reaching rule is warned about", ["articles/saoirse.html"], "x [edit-mode]", "julie-gh", 0, "rule \"**\" for @julie-gh is ignored");
scenario("player without the trailer is still checked", ["index/heroes.html"], "sneaky", "sawyer-gh", 1);
scenario("player can't touch edit/ (visibility)", ["edit/visibility.json"], "x", "sawyer-gh", 1, "only admins may change edit/visibility.json");
scenario("player can't grant himself permissions", ["edit/profiles.json", "articles/vaerek.html"], "x [edit-mode]", "sawyer-gh", 1, "only admins may change edit/profiles.json");
scenario("viewer refused", ["articles/vaerek.html"], "x [edit-mode]", "viewer-gh", 1);
scenario("unknown login with [edit-mode] refused", ["articles/vaerek.html"], "x [edit-mode]", "stranger", 1, "has no edit profile");
scenario("jon edits both his articles (Silar Scorria + Telorin)", ["articles/silar-scorria.html", "articles/telorin.html"], "x [edit-mode]", "jon-gh", 0);
scenario("jon refused on a private article", ["articles/yena.html"], "x [edit-mode]", "jon-gh", 1, "may not edit articles/yena.html");
scenario("admin (Devin) edits index/, journal, private article, edit/", ["index/ancients.html", "journal.html", "articles/yena.html", "edit/visibility.json", "index.html"], "x [edit-mode]", "owner-gh", 0);
scenario("sylum edits Alaric (both copies)", ["articles/alaric.html", "articles/alaric/index.html"], "Edit articles/alaric.html via edit mode [edit-mode]", "player5-gh", 0);
scenario("sylum (Alaric) login is case-insensitive", ["articles/alaric.html"], "x [edit-mode]", "Player5-GH", 0);
scenario("sylum refused on Galand", ["articles/galand-helviath.html"], "x [edit-mode]", "player5-gh", 1, "may not edit articles/galand-helviath.html");
scenario("sylum refused on his player page (non-admin ceiling)", ["players/sylum.html"], "x [edit-mode]", "player5-gh", 1, "non-admins may only edit articles/*.html");
scenario("sylum can't grant himself permissions", ["edit/profiles.json"], "x", "player5-gh", 1, "only admins may change edit/profiles.json");
// Same rules against the repo's real profiles.json (perms.js is shared by editor + guard).
{
  const P = require(path.resolve(__dirname, "../perms.js"));
  const real = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../profiles.json"), "utf8"));
  // Sylum has no GitHub login yet: the entry is keyed by a <placeholder> (matches nobody), like the other players.
  const key = Object.keys(real.profiles).find(k => real.profiles[k] && real.profiles[k].person === "sylum");
  const sy = key && real.profiles[key];
  check("real profiles.json: sylum entry is a placeholder-keyed pr-mode editor", !!sy && /^<.*>$/.test(key) && sy.role === "editor" && P.saveMode(sy) === "pr");
  check("real profiles.json: no profile answers to the slug \"sylum\" as a login", P.profileFor(real, "sylum") === null);
  check("real profiles.json: sylum can edit articles/alaric.html + pretty copy", P.canEdit(sy, "articles/alaric.html") && P.canEdit(sy, "articles/alaric/index.html") && P.ownsPage(sy, "articles/alaric.html"));
  for (const f of ["articles/galand-helviath.html", "articles/galand-helviath/index.html", "articles/vaerek.html", "articles/yena.html", "players/sylum.html", "players/sylum/index.html", "index/ancients.html", "journal.html", "edit/profiles.json", "edit/visibility.json"])
    check("real profiles.json: sylum cannot edit " + f, !P.canEdit(sy, f));
}
fs.rmSync(dir, { recursive: true, force: true });
console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
