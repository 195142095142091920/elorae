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

## Visibility layer (secrets)
Today, the 12 "private" pages (Bel Harath, Haethlin in the Dream, Ito Gangara, Vallorca, Yena (Jack's);
Curse of Olesh, Cursed of Olesh, Darmstadt, Elraim, Imani Valash, Rathalon, Sen Teloch Ini (Devin's))
are **public plaintext**. Each one is a private article, `articles/<id>.html`
(`<main class="art-body private" data-owner=…>`), with its image in `assets/`, its `search-index.js`
entry and its card in the Index **Private** category (`index/ancients.html`), all in the public repo.
They are hidden only by CSS (`.private` + `login.js`). The old friend-door phrases are in a comment in
`login.js`, and the SHA-256 hashes of one-word phrases can be brute-forced instantly anyway. That
mechanism is a curtain, not a lock.

The new layer gives real secrecy:

- Each secret's private article (`visibility.json` `path`, HTML with images inlined) is encrypted with its own random **AES-256-GCM**
  content key and stored in `edit/secrets/<id>.json`.
- Each person has an **RSA-OAEP-3072** keypair made in their own browser. `edit/visibility.json`
  stores their public key and their private key **encrypted with their passphrase**
  (PBKDF2-SHA-256, 600,000 iterations). The passphrase is never stored or sent anywhere.
- For every allowed person, the content key is wrapped (encrypted) with that person's public key.
  Devin is always included.
- **Everyone** publishes the content key (`openKey`), so anyone can open the page.
- **Revealing** to someone wraps the key for them (one commit). **Hiding** from someone, or turning
  Everyone off, **rotates** the key: a new key, re-encryption, and re-wrapping for the people who remain.
- Titles, owners and who-can-see lists in `visibility.json` are public metadata (the dashboard
  needs them); only the page content is encrypted.
- A shared page decrypts in the reader's browser; they can copy it. Weak passphrases can be
  brute-forced offline from the published encrypted key, so use long ones.
- Anything already revealed may have been saved, cached or screenshotted. Rotation protects future
  versions only. Git history keeps old ciphertext, but old keys only ever went to people who were allowed at the time.

### Setup, per person
1. Open `https://elorae.world/edit/secret.html?enroll`, choose your name, and pick a passphrase of
   four or more random words. Keep it private. It can't be recovered.
2. Send the enrollment code shown to Devin. It contains only your public key and a passphrase-locked private key.
3. To read something shared with you, use the link Devin gives you (`edit/secret.html?id=<secret>`),
   choose your name and enter your passphrase.

### Setup, Devin
1. Enter at `edit/dashboard.html` (or the DASHBOARD link) with your token. The dashboard activates on that same page as soon as you enter (no need to navigate away); the DASHBOARD link also appears immediately in the top nav on every content page.
2. Create your secrets key with your own passphrase. Next time, unlock it with that passphrase.
3. Paste each person's enrollment code under **People → Add key**.
4. **Encrypt** a secret, then use its toggles: *Everyone*, plus a checkbox per person. Each click is one
   `[edit-mode]` commit to `main` (visibility.json, plus the secret file when the key rotates).

### Migration status
Encrypting a secret in the dashboard **adds** the encrypted copy and does not remove anything. The
plaintext now lives in `articles/<id>.html` and stays public until a separate, explicit cleanup
removes or replaces that article, its `search-index.js` entry, its card in the Index Private category
(`index/ancients.html`) and its image in `assets/`, and points the card at `edit/secret.html?id=<id>`.
The viewer shows the decrypted article as the unlocked original (it drops only the `.private` CSS gate). Image files also stay in git history,
so truly secret art needs a history rewrite or new art. This cleanup is deliberately not automated.

### Hidden pages (no public trace)
Some pages exist only as secrets: no HTML file, no image file, no search or sitemap entry, no link
in static HTML. Their URL simply 404s for everyone else. Today: the six Journal tabs shared with
Jason (`jason-journal-1` … `-6`) and the Journal sidebar link to them (`jason-journal-nav`).

- `visibility.json` `secrets.<id>.routes` holds `sha256("elorae-route:" + path)` for each URL the
  page answers at (path with a trailing slash; `.html` and `/index.html` forms map to it), so the
  path itself is not published. `404.html` loads `/hidden.js`: if the signed-in person's key opens a
  secret routed at that path, the decrypted page replaces the 404 at the same URL.
- `kind: "nav"` secrets carry `payload.nav` (`where` selector + link HTML); `/hidden.js` with
  `data-mode="nav"` adds the links for people the secret is shared with (journal page).
- The payload is the whole page with its CSS/JS inlined, so Share / Hide / key rotation in the
  dashboard work unchanged. Images are separate files, `secrets/m/<hash>.bin`, each AES-256-GCM
  with its own key; the keys sit only inside the encrypted page (`#gw-media`), and the page's own
  loader decrypts them near the viewport. Rotation re-keys the page, not the image files (rebuild
  to re-key those).
- **Edit mode on hidden pages: Devin (admin) only.** `perms.js` `canEditSecret` is true for admins
  only; no player gets an Edit button, the `#edit` panel or a save path there, the owner (Jason)
  included, even with a linked GitHub login. The guard already rejects any non-admin change
  under `edit/**`. Each page carries `<meta name="elorae-secret" content="<id>">` (the tab swap keeps
  it current), which makes the editor take its source from the decrypted payload instead of a repo
  file. Devin's secrets key must be unlocked in that tab (Dashboard) or Edit says so and stops.
  Save re-encrypts the edited page in the browser with the page's own content key at epoch + 1 and
  commits (directly, as for any admin edit) only `secrets/<id>.json`, that epoch in
  `visibility.json` and, for pasted or dropped pictures, `secrets/m/<hash>.bin` (AES-256-GCM, own
  key, metadata stripped; the key goes into the page's `#gw-media`). The commit message names the id
  only (`Edit private page jason-journal-3 via edit mode`). No plaintext is ever sent to GitHub. Art /
  Share / Owner / New article are hidden on these pages.
- **Source of truth after a browser edit: the encrypted blob, not `/workspace/gw2/src`.**
  `build-secrets.js` records the sha256 of every blob it writes (`/workspace/gw2/built.json`) and
  refuses to run if any blob differs (that is, it was edited in the browser since the last build):
  - `node build-secrets.js --skip-edited` rebuilds the rest and leaves edited tabs (blob, manifest
    entry, pictures) untouched;
  - `node build-secrets.js --force` overwrites them (the browser edits are lost; recover from git);
  - bring the edits into `src` first by hand (decrypt as Devin, copy the changed text), then
    `--force`; `--record` marks the current blobs as built after review.
  It never deletes `secrets/m/*.bin` files it did not make itself, so pictures added in edit mode
  survive any rebuild.
- Speed: a decrypted page is kept for the tab in sessionStorage (`elorae-hp:<path>`, next to the
  unlocked key). With it, `/hidden.js` writes the page while the 404 is still parsing, so it renders
  in one pass like any static page; the manifest is then re-checked and a re-keyed or unshared page
  is dropped. `payload.warm` / `payload.nav.warm` list pages to decrypt ahead of time when idle.
- Keys: the secrets key is unlocked at sign-in (phrase-is-key). In a new tab the remembered login
  phrase unlocks it again. Devin's current key was made on the dashboard with its own passphrase:
  unlock it on the Dashboard first, then open the page in the same tab.
- Not covered: the plaintext of the journal and its images were public briefly on
  2026-10-30 and remain in git history and in older Cloudflare Pages deployments.

## Shared art catalog
Admins can upload images from the dashboard (**Media**) or replace an article hero via **Art** while editing.
Uploads go to `assets/` and are listed in `edit/media/catalog.json` with title, tags, and who may see them
**in the editor**. Devin always sees all. Files under `assets/` remain public URLs on GitHub Pages —
catalog visibility does not hide HTTP access. Encrypting private images is planned later.

## Files
`edit/edit.js` (bootstrap, the only thing pages load), `core.js` (session + GitHub API),
`perms.js` (globs, shared with the guard), `srcmap.js` (tokenizer/splicer), `editor.js` (UI and
save), `edit.css`, `profiles.json`, `visibility.json`, `secrets/`, `crypto.js`, `vis.js`,
`secret.html` + `secret.js`, `media.js` + `media/catalog.json`, `dashboard.html` + `dashboard.js`, `guard.js`, `workflows/edit-guard.yml` (to install), `test/` (`e2e.js`: browser test
with a mocked GitHub API, see its header; `e2e-editor.js`: full-page editor — sizes/fonts, one-line save diffs, conflicts, unsaved-changes prompts, Index organizer; both serve this checkout on a fresh port via `server.js`; `guard.test.js`: guard scenarios, `node edit/test/guard.test.js`).
