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
| Jon | `<jon-github-login>` | player (editor), saves as PR | Silar Scorria: `articles/silar-scorria.html`. Telorin has no article page (only `figures/telorin.html`), so Jon has **no editable Telorin page** until `articles/telorin.html` exists |
| Jack | `<jack-github-login>` | player (editor), saves as PR | Galand Helviath: `articles/galand-helviath.html` |
| Julie | `<julie-github-login>` | player (editor), saves as PR | Saoirse: `articles/saoirse.html` |

**Hard ceiling: players edit article pages only.** Every non-admin is capped at
`articles/*.html` in code (`edit/perms.js`, used by both the editor and the guard). That covers
`figures/`, `gallery/`, codex, journal, index and every other page, including the figure/gallery pages of
a player's own character: no EDIT button there, and the guard rejects such commits. Any non-admin
rule in `profiles.json` that reaches outside `articles/` (for example `figures/x.html`, `gallery/**`,
`codex/**`, `**` or `articles/**`) is **ignored** by the editor, shown as "ignored" in the sign-in
panel, and reported as a warning by the guard. Only `"role": "admin"` lifts the ceiling.

Permission levels in `edit/profiles.json`:

- `"role": "admin"`: everything, including `edit/**` (profiles, visibility, secrets, keys) and `.github/**`.
- `"role": "editor"` (a player) with `"permissions"`: exact article paths such as `"articles/vaerek.html"`, or
  `"articles/*.html"` for every article. Nothing outside `articles/` takes effect.
- `"permissions": "view"`: can sign in but can't edit anything.
- `"save": "direct"` commits straight to `main`. `"save": "pr"` (the default for non-admins) creates a branch `edit/<login>/…` and opens a pull request.

To let Jon edit Telorin's text, an admin first creates `articles/telorin.html`, then adds it to Jon's permissions.

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
3. Paste it into step 2 of the panel and click **Sign in**. *Remember on this device* is on by
   default: after that the **EDIT** button appears on your own article pages by itself, with no
   `#edit` needed. The panel shows "Signed in as …" and the pages you can edit.
4. When the token expires or is deleted, the site says so and offers **Sign in again**. Use
   **Sign out on this device** to remove the token from that browser.

The token stays in your browser (localStorage when remembered, otherwise sessionStorage) and is sent
only to `api.github.com`. A `public_repo` token can also write to your *other* public repositories.
Keep it private, use an expiry, and delete it at <https://github.com/settings/tokens> when you're done.

Devin (owner) can instead use the panel's pre-filled **fine-grained token** link (Contents and Pull
requests: write, 90 days). The repository must be selected by hand: *Only select repositories*, then
`elorae`.

## Editing
Sign in, then click **EDIT** (bottom-right, only on pages you can edit; for players that means only
their own article pages). Article text and dossier values become editable (for Devin, codex prose,
journal text and figure lore too). Nav, headings, links lists and
structure don't. **Save** works like this:

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
Today, the 12 "sealed" pages (Bel Harath, Haethlin in the Dream, Ito Gangara, Vallorca, Yena (Jack's);
Curse of Olesh, Cursed of Olesh, Darmstadt, Elraim, Imani Valash, Rathalon, Sen Teloch Ini (Devin's))
are **public plaintext**. Their gallery and figure pages, images, `vault.js`, `search-index.js` and
`index.html` tiles are all in the public repo. They are hidden only by CSS. The friend-door phrases
are in `vault.js` and in a comment in `seal.js`. The SHA-256 hashes of one-word phrases can also be
brute-forced instantly. That mechanism is a curtain, not a lock.

The new layer gives real secrecy:

- Each secret's page (HTML with images inlined) is encrypted with its own random **AES-256-GCM**
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
1. Sign in at `edit/dashboard.html` (or the DASHBOARD link) with your token.
2. Create your vault key with your own passphrase. Next time, unlock it with that passphrase.
3. Paste each person's enrollment code under **People → Add key**.
4. **Encrypt** a secret, then use its toggles: *Everyone*, plus a checkbox per person. Each click is one
   `[edit-mode]` commit to `main` (visibility.json, plus the secret file when the key rotates).

### Migration status
Encrypting a secret in the dashboard **adds** the encrypted copy and does not remove anything. The
plaintext stays public until a separate, explicit cleanup removes or replaces `gallery/<id>.html`,
`figures/<id>.html`, its `index.html` tile, its `search-index.js` entry, its `vault.js` entry and its image in
`assets/`, and points the tile at `edit/secret.html?id=<id>`. Image files also stay in git history,
so truly secret art needs a history rewrite or new art. This cleanup is deliberately not automated.

## Files
`edit/edit.js` (bootstrap, the only thing pages load), `core.js` (session + GitHub API),
`perms.js` (globs, shared with the guard), `srcmap.js` (tokenizer/splicer), `editor.js` (UI and
save), `edit.css`, `profiles.json`, `visibility.json`, `secrets/`, `crypto.js`, `vis.js`,
`secret.html` + `secret.js`, `dashboard.html` + `dashboard.js`, `guard.js`, `workflows/edit-guard.yml` (to install), `test/` (`e2e.js`: browser test
with a mocked GitHub API, see its header; `guard.test.js`: guard scenarios, `node edit/test/guard.test.js`).
