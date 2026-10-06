#!/usr/bin/env node
/* Edit guard (run by .github/workflows/edit-guard.yml).
   Server-side enforcement of edit/profiles.json. For every pushed / PR commit that is tagged
   "[edit-mode]", or that was pushed by someone whose profile is not admin, each changed path must
   be allowed for that GitHub login. The edit system itself (edit/**: profiles.json,
   visibility.json, secrets, keys, scripts) and .github/** may only be changed by admins.
   Rules are always read from the BASE commit (before the push / the PR base), so a push can't
   grant itself permissions. The workflow runs this script from the base commit too.

   Usage: node guard.js  (reads GITHUB_EVENT_PATH, GITHUB_EVENT_NAME, GITHUB_ACTOR,
          GITHUB_REPOSITORY_OWNER; uses git in the current checkout)
   Test:  node guard.js --base <sha> --head <sha> --actor <login> [--pr-author <login>] */
"use strict";
const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const P = require(path.join(__dirname, "perms.js"));

const ZERO = /^0+$/;
function git(...args) { return execFileSync("git", args, { encoding: "utf8", maxBuffer: 64 << 20 }).trim(); }
function tryGit(...args) { try { return git(...args); } catch (e) { return null; } }
function arg(name) { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : null; }

function context() {
  if (arg("--base")) {
    return { base: arg("--base"), head: arg("--head"), actors: [arg("--actor"), arg("--pr-author")].filter(Boolean), owner: arg("--owner") || "", kind: "manual" };
  }
  const ev = JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, "utf8"));
  const name = process.env.GITHUB_EVENT_NAME;
  const owner = process.env.GITHUB_REPOSITORY_OWNER || "";
  if (name === "pull_request" || name === "pull_request_target") {
    return { base: ev.pull_request.base.sha, head: ev.pull_request.head.sha, actors: [...new Set([ev.pull_request.user.login, process.env.GITHUB_ACTOR].filter(Boolean))], owner, kind: "pr" };
  }
  // push: the pusher (GITHUB_ACTOR) is the token owner and can't be spoofed via commit metadata.
  let base = ev.before;
  if (!base || ZERO.test(base)) base = tryGit("merge-base", "origin/main", ev.after) || tryGit("rev-parse", ev.after + "^") || ev.after;
  return { base, head: ev.after, actors: [process.env.GITHUB_ACTOR], owner, kind: "push", deleted: !!ev.deleted };
}

function main() {
  const ctx = context();
  if (ctx.deleted || !ctx.head || ZERO.test(ctx.head)) { console.log("Branch deletion: nothing to check."); return 0; }
  let profilesText = tryGit("show", ctx.base + ":edit/profiles.json");
  let bootstrap = false;
  if (profilesText == null) { profilesText = tryGit("show", ctx.head + ":edit/profiles.json"); bootstrap = true; }
  if (profilesText == null) { console.log("No edit/profiles.json yet: nothing to enforce."); return 0; }
  const doc = JSON.parse(profilesText);
  const commits = (ctx.base === ctx.head ? [] : git("rev-list", "--reverse", ctx.base + ".." + ctx.head).split("\n").filter(Boolean));
  const errors = [];
  const report = [];

  for (const actor of ctx.actors) {
    const profile = P.profileFor(doc, actor);
    const isOwner = actor && ctx.owner && actor.toLowerCase() === ctx.owner.toLowerCase();
    const admin = isOwner || P.isAdmin(profile);
    for (const sha of commits) {
      const msg = git("log", "-1", "--format=%B", sha);
      const tagged = /\[edit-mode\]/.test(msg);
      // Checked: anything from edit mode, and every commit pushed by a listed non-admin editor.
      if (!tagged && (admin || !profile)) continue;
      const files = git("diff-tree", "--no-commit-id", "--name-only", "-r", "-m", "--root", sha).split("\n").filter(Boolean);
      for (const f of [...new Set(files)]) {
        let ok, why;
        if (admin) { ok = true; }
        else if (!profile) { ok = false; why = "@" + actor + " has no edit profile"; }
        else if (P.isProtected(f)) { ok = false; why = "only admins may change " + f; }
        else { ok = P.canEdit(profile, f); why = "@" + actor + " may not edit " + f; }
        report.push(`${ok ? "ok  " : "DENY"} ${sha.slice(0, 8)} @${actor} ${f}`);
        if (!ok) errors.push({ sha, file: f, why });
      }
    }
  }
  console.log(`Edit guard (${ctx.kind}) base=${ctx.base.slice(0, 8)} head=${ctx.head.slice(0, 8)} actors=${ctx.actors.join(",")}${bootstrap ? " [bootstrap: profiles from head]" : ""}`);
  report.forEach((l) => console.log("  " + l));
  if (process.env.GITHUB_STEP_SUMMARY) {
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, "### Edit guard\n\n" + (errors.length ? errors.map((e) => `- ❌ \`${e.sha.slice(0, 8)}\` ${e.why}`).join("\n") : "- ✅ all checked changes are allowed") + "\n");
  }
  for (const e of errors) console.log(`::error file=${e.file}::${e.why} (commit ${e.sha.slice(0, 8)})`);
  return errors.length ? 1 : 0;
}
process.exitCode = main();
