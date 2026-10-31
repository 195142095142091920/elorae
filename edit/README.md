# Elorae edit mode + visibility layer

Additive tooling for editing elorae.world in the browser and for keeping secret pages
genuinely secret. Visitors see nothing new: each page only loads `edit/edit.js`, which does
nothing unless the URL ends in `#edit`, an editor session already exists in that browser, or
Devin is signed in (then a bare **DASHBOARD** link appears in the top-right nav spot).

Nothing secret is committed. There are no passwords or tokens in the repo.

## Who can do what

| Person | GitHub login (fill in) | Role | Can edit |
|---|---|---|---|
| Devin (GM) | `195142095142091920` (repo owner, assumed to be Devin) | admin, saves direct to `main` | whole site, `edit/**`, dashboard, all secrets |
| Sawyer | `<sawyer-github-login>` | player (editor), saves as PR | Vaerek Rathkin: `articles/vaerek.html` |
| Jon | `<jon-github-login>` | player (editor), saves as PR | Silar Scorria: `articles/silar-scorria.html`; Telorin: `articles/telorin.html` |
| Jack | `<jack-github-login>` | player (editor), saves as PR | Galand Helviath: `articles/galand-helviath.html` |
| Julie | `<julie-github-login>` | player (editor), saves as PR | Saoirse: `articles/saoirse.html` |
| Sylum | `<sylum-github-login>` | player (editor), saves as PR | Alaric: `articles/alaric.html` |
| Jason | `<jason-github-login>` | viewer (no character, can't edit) | nothing |

**Hard ceiling: players edit article pages only.** Every non-admin is capped at
`articles/*.html` in code (`edit/perms.js`, used by both the editor and the guard). Codex, journal,
the Index pages and every other page outside `articles/` are off-limits to players: no EDIT button
there, and the guard rejects such commits. Within `articles/`, a player gets only the exact pages
listed for them, so other characters' articles and the 12 private articles stay admin-only. Any non-admin
rule in `profiles.json` that reaches outside `articles/` (for example `index/x.html`, `codex/**`,
`**` or `articles/**`) is **ignored** by the editor, shown as "ignored" in the sign-in
panel, and reported as a warning by the guard. Only `"role": "admin"` lifts the ceiling.

Permission levels in `edit/profiles.json`:

- `"role": "admin"`: everything, including `edit/**` (profiles, visibility, secrets, keys) and `.github/**`.
- `"role": "editor"` (a player) with `"permissions"`: exact article paths such as `"articles/vaerek.html"`, or
  `"articles/*.html"` for every article. Nothing outside `articles/` takes effect.
- `"permissions": "view"`: can enter but can't edit anything.
- `"save": "direct"` commits straight to `main`. `"save": "pr"` (the default for non-admins) creates a branch `edit/<login>/…` and opens a pull request.

To give a player another article, an admin adds its exact path (for example `articles/telorin.html`) to their permissions.

### Add a person
1. Get their GitHub login (exactly as shown on github.com/<login>).
2. In `edit/profiles.json`, replace the `<…-github-login>` placeholder key with that login, or
   add a new entry. Placeholders contain `<` `>`, which GitHub logins can't contain, so they
   never match anyone.
3. Repo **Settings → Collaborators**: invite them with **Write** access. Their token can only write
   if they are a collaborator.
4. Commit as an admin. The edit guard rejects profile changes from anyone else.

## Each editor: make a token (one time)
> **Important:** GitHub doesn't let *fine-grained* tokens write to a repository owned by another
> person's account, even for invited collaborators. This repo is owned by a personal account, so
> **players need a classic token with the `public_repo` scope**. The repo is public, so that scope is
> enough. Fine-grained tokens work only for the owner (Devin). See `SIGNIN-UX.md` for ways to remove
> this step entirely (an organization or a GitHub App).

1. Accept the collaborator invite: <https://github.com/195142095142091920/elorae/invitations>.
2. Open any page with `#edit` (for example `https://elorae.world/articles/vaerek.html#edit`) and click
   **Make my token**. GitHub opens with the name and the `public_repo` scope pre-filled. Pick an
   expiry (90 days is fine), leave everything else unticked (especially `workflow`), click
   **Generate token** and copy it.
3. Paste it into step 2 of the panel and click **Enter**. *Remember on this device* is on by
   default: after that the **EDIT** button appears on your own article pages by itself, with no
   `#edit` needed. The panel shows "Signed in as …" and the pages you can edit.
4. When the token expires or is deleted, the site says so and offers **Enter again**. Use
   **Sign out on this device** to remove the token from that browser.

The token stays in your browser (localStorage when remembered, otherwise sessionStorage) and is sent
only to `api.github.com`. A `public_repo` token can also write to your *other* public repositories.
Keep it private, use an expiry, and delete it at <https://github.com/settings/tokens> when you're done.

Devin (owner) can instead use the panel's pre-filled **fine-grained token** link (Contents and Pull
requests: write, 90 days). The repository must be selected by hand: *Only select repositories*, then
`elorae`.

## Editing
Enter, then click **EDIT** (bottom-right, only on pages you can edit; for players that means only
their own article pages). Article text and dossier values become editable (for Devin, codex prose,
journal text and Index text too). On secret/private articles, Devin gets **Share** (Everyone / per-player toggles or Encrypt, same commits as the dashboard; requires unlocked secrets key) and **Owner** (assign which player may edit the page via `profiles.json`). Devin can also edit the article hero **name** (`h1`) and **epithet**
(`.art-epithet`) in place; players cannot. Nav, other headings, links lists and structure don't. **Save** works like this:

1. GET `/repos/195142095142091920/elorae/contents/<path>?ref=main` to read the current source and its `sha`.
2. A small offset-preserving tokenizer (`edit/srcmap.js`) finds each editable block's exact
   byte range in the raw file. Only blocks you changed are replaced. Their HTML is sanitized
   (inline formatting, `a[href]`, `br`, and `p`/`blockquote` inside quotes. Scripts, styles,
   images, iframes, event handlers and `javascript:` URLs are removed) and spliced in. Every other
   byte of the file is left exactly as it was. Character references such as `&#x27;` are kept.
3. If the file changed on GitHub since you started, the save still goes through when someone else
   only touched *other* blocks. If they changed the same block, you get a clear conflict message and
   nothing is saved.
4. PUT the new content with the `sha` and the message `Edit <path> via edit mode [edit-mode]`. A
   409 or sha mismatch shows the conflict message.
5. Direct saves go live after the Pages deploy (about 1–2 minutes). PR saves go live 1–2 minutes after the PR is merged.

## Server-side enforcement: `.github/workflows/edit-guard.yml`

> **Install step (one time, Devin):** the workflow ships as `edit/workflows/edit-guard.yml` because
> the automation token couldn't write workflow files. Copy it to `.github/workflows/edit-guard.yml`
> (github.com → Add file → Create new file, paste it, then commit). Until then nothing is enforced server-side.

`profiles.json` only drives the UI. The **Edit guard** workflow runs on every push and PR. It runs
the guard script **from the base commit**, reads `profiles.json` **from the base commit**, and
identifies the person by the pusher (`github.actor`) or the PR author, not by commit metadata, which
can be forged. Then:

- Every commit tagged `[edit-mode]`, and every commit pushed by a listed non-admin, must only touch
  paths that person's rules allow, and never anything outside `articles/*.html` unless they're an admin.
- `edit/**` (profiles, visibility.json, secrets, keys, editor code) and `.github/**` may only be changed by admins.
- Violations fail the check with an annotation per file.

### Limits (please read)
- A collaborator's token can technically push **anything** to any branch. The guard catches it
  after the fact on direct pushes (red check and notification). It can only **block** a change
  when it is a required check on a pull request. So:
  - **Settings → Branches → Add rule for `main`**: require a pull request before merging, require
    the status check **Edit guard / guard**, and allow only Devin (admin) to bypass. Then
    non-admin edits can only reach `main` through reviewed PRs. Admin `direct` saves still work.
  - Optionally add `.github/CODEOWNERS` with `* @195142095142091920` and require code-owner review.
  - Only give collaborator access to people you trust. Tokens without the *Workflows* permission
    cannot change `.github/workflows/*`.
- The Pages workflow publishes from `main` only. Edit branches run it but the `github-pages`
  environment refuses to deploy them, so you may see a failed "Deploy" run on `edit/*` branches.

## Visibility layer (secrets): visibility among friends, no encryption
Since 2026-10-30 secrets are **not encrypted**. A secret is a normal page, article, link or image
in this repo; `edit/visibility.json` only says who sees it. This is a curtain among friends, not a
lock: anyone can read the repo or view the page source.

- `visibility.json` `secrets.<id>`: `title`, `owner`, `path` (the page, if any), `allowed` (people),
  `everyone`, `kind: "nav"` for a link-only secret, `listed: false` = no profile card. Devin always
  sees everything; the owner always sees their own.
- **Pages** (e.g. Jason's journal tabs, `journal/ghostly-wanderer/<tab>/index.html`):
  `<html data-secret-page="<id>" data-owner="<owner>">` plus `/vis-gate.js` in `<head>`. The owner
  and Devin see the page at once; anyone else waits for the manifest and either sees it or gets the
  site's Not found page at the same URL. Guests and signed-out visitors are sent to sign-in first by
  `session-gate.js`. `noindex`, no search or sitemap entry.
- **Links / elements** (the Journal sidebar's Private Journal link, Index Private cards, article
  sidebars): class `private` + `data-owner` (hidden by `html.css` for all but the owner and Devin),
  `data-secret="<id>"` where there is no article path. `vis-gate.js` (loaded by `login.js` on every
  page) removes `private` for anyone else the manifest allows, so Devin's toggles reveal them.
- **Dashboard** (and the editor's Share panel): Everyone + one checkbox per person; each click is
  one `[edit-mode]` commit of `visibility.json`. No keys, passphrases or re-keying.
- **Edit mode** on these pages is normal edit mode: admin (Devin) only (players' permissions never
  cover them), saving plain HTML; a pasted picture becomes a normal image file. The journal tabs swap
  in place (`ghostly-swap.js`) and edit mode follows the tab shown.
- **Source of truth:** the repo files. The old `/workspace/gw2` pipeline (`build-secrets.js`,
  encrypted payloads, `edit/secrets/m/*.bin`) is retired (`/workspace/gw2/retired/`). The journal's
  shared CSS/JS live in `/ghostly.css` and `/ghostly.js`; images are normal `/assets/` files resized
  by Cloudflare like other chapter art.
- **No encryption anywhere:** the old encrypted copy of `yena` and every key were removed
  (Oct 30); `articles/yena.html` is the one Yena page (owner Jack; Jack + Devin). Old
  `edit/secret.html?id=<id>` links redirect to the plain page. `crypto.js`/`vis.js` remain only as
  dormant helpers for the Dashboard; nothing in the manifest is encrypted.

## Shared art catalog
Admins can upload images from the dashboard (**Media**) or replace an article hero via **Art** while editing.
Uploads go to `assets/` and are listed in `edit/media/catalog.json` with title, tags, and who may see them
**in the editor**. Devin always sees all. Files under `assets/` remain public URLs on GitHub Pages —
catalog visibility does not hide HTTP access. Encrypting private images is planned later.

## Files
`edit/edit.js` (bootstrap, the only thing pages load), `core.js` (session + GitHub API),
`perms.js` (globs, shared with the guard), `srcmap.js` (tokenizer/splicer), `recent.js` (after a
save, a reload in the ~30 s before the site rebuilds shows your saved copy — your browser only; see its
header), `editor.js` (UI and save), `edit.css`, `profiles.json`, `visibility.json`, `secrets/`, `crypto.js`, `vis.js`,
`secret.html` + `secret.js`, `media.js` + `media/catalog.json`, `dashboard.html` + `dashboard.js`, `guard.js`, `workflows/edit-guard.yml` (to install), `test/` (`e2e.js`: browser test
with a mocked GitHub API, see its header; `e2e-editor.js`: full-page editor — sizes/fonts, one-line save diffs, conflicts, unsaved-changes prompts, Index organizer, instant reload after a save; both serve this checkout on a fresh port via `server.js`; `guard.test.js`: guard scenarios, `node edit/test/guard.test.js`).
