# Edit-mode sign-in: current flow, friction, options

The goal is for players (Sawyer, Jon, Jack, Julie) to edit their own article pages with as
little ceremony as possible, without weakening security. Everything here is client-side on a
static GitHub Pages site. No server or secret is involved unless noted.

## 1. Current flow, step by step (as shipped in this change)

1. **One time:** Devin invites the player as a collaborator (repo Settings → Collaborators) and puts
   their GitHub login in `edit/profiles.json`. The player accepts the invitation.
2. The player opens any article with `#edit`, e.g. `https://elorae.world/articles/vaerek.html#edit`.
3. The panel shows two numbered steps:
   1. **Make my token** opens `https://github.com/settings/tokens/new?description=Elorae%20edit%20mode&scopes=public_repo`
      (a classic token with the name and `public_repo` pre-filled). The player picks an expiry and
      clicks *Generate token*, then copies it.
   2. They paste it and click **Enter**. *Remember on this device* is **on by default**.
4. The editor checks the token (`GET /user`, `GET /repos/…`, `edit/profiles.json`) and shows
   **"Signed in as Sawyer @login · You can edit: Vaerek Rathkin"** (titles come from the pages
   themselves), whether saves go live directly or as a PR, and **Sign out on this device**.
5. From then on, on that device, the **EDIT** button appears on their own article pages by itself.
   No `#edit` is needed. It never appears on other pages (articles-only ceiling) or for visitors.
6. If the token expires or is deleted, the next page load shows a small bar: *"Your edit sign-in has
   expired… [Enter again]"*. The dead token is forgotten, and the button reopens the steps with an
   explanation. If it expires mid-edit, Save keeps the edits on the page and asks them to enter again first.

Errors are in plain English: not a token, wrong or expired token, a fine-grained token (unsupported
here, see below), missing `public_repo`, not yet a collaborator (with the invitations link), or no
edit profile yet. A classic token with the broad `repo` scope works but shows a gentle "public_repo is
enough" note.

## 2. Friction points

| # | Friction | Status |
|---|---|---|
| F1 | **Fine-grained tokens don't work for players.** GitHub doesn't let fine-grained PATs write to a repository owned by another *personal* account, even for collaborators (documented limitation). The first version of the docs said to use fine-grained tokens, which would have failed for every player. | Fixed for now: classic `public_repo` token, pre-filled link and a clear error if someone pastes a fine-grained one. A real fix is O1 or O3 below. |
| F2 | Making a token means a trip to GitHub settings with many choices. | Reduced: one pre-filled link. Classic links can pre-fill description and scopes only; the expiry has to be picked by hand. |
| F3 | A classic `public_repo` token can write to *all* of the player's public repos, not just this one. | Inherent to classic tokens. Mitigations: expiry, kept only in the browser, sign-out. Real fix: O1 or O3. |
| F4 | Having to remember `#edit`. | Fixed: remembered sessions show EDIT on their own pages automatically. |
| F5 | Expired tokens failed silently or as a raw "401". | Fixed: proactive check on page load and a friendly re-sign-in. Note: GitHub's token-expiry header isn't exposed to browsers (CORS), so expiry is detected when GitHub rejects the token. |
| F6 | Not knowing what you can edit. | Fixed: "You can edit: <their articles>" list with links. |
| F7 | Accepting the collaborator invite is easy to miss. | Partly fixed: a specific error and an invitations link. Devin still has to send the invite. |
| F8 | Signing in again on each device (phone and laptop). | Inherent to browser-only storage. O3/O4 would make it "click Enter with GitHub" instead. |

## 3. Options, ranked by effort (low → high) with security notes

### Shipped now (client-side, additive)
| Option | Effort | Security |
|---|---|---|
| Pre-filled "Make my token" link (classic, `public_repo`); fine-grained template link for the owner | tiny | Neutral. Least-privilege scope that works for collaborators. |
| Two-step checklist in the panel, plain-English errors | small | Neutral. |
| *Remember on this device* default **on**, clear **Sign out on this device** | tiny | Slightly weaker: the token persists in localStorage until sign-out or expiry. Anyone using that browser profile, or a malicious script on the site, could read it. The site loads only its own first-party scripts. |
| Validation and "Signed in as X, you can edit: …" | small | Neutral or better (catches wrong tokens early). |
| Auto EDIT on own articles when remembered | tiny | Neutral (server-side guard and ceiling still apply). |
| Expiry/revocation detection with a friendly re-sign-in prompt | small | Better (dead tokens are forgotten). |

### Not shipped, worth considering
**O1. Move the repo into a free GitHub organization (≈30 min, no code).** Devin creates an org
(e.g. `elorae-world`), transfers the repo (Pages and the custom domain move with it, but re-check
the Pages settings), and adds players as org members with Write on just this repo. Then players can
use **fine-grained tokens limited to this one repo** (Contents and Pull requests: write). The panel's
fine-grained link can pre-fill name, owner, expiry and permissions; only the repo has to be picked.
*Security: much better than classic `public_repo`.* Code change: switch the panel's primary link to the
fine-grained template, and update `REPO` in `edit/core.js` and the workflow owner check.

**O2. Branch protection plus required Edit-guard check (≈10 min, no code).** Not sign-in UX, but it
makes any token leak far less harmful: non-admin changes can only reach `main` via reviewed PRs.

**O3. "Enter with GitHub" via a GitHub App plus a tiny proxy (≈half a day for Devin, ~150 lines).**
GitHub's OAuth endpoints (`github.com/login/oauth/access_token`, `github.com/login/device/code`)
**don't send CORS headers**, so a static site can't complete OAuth or the device flow from the browser.
It needs a small proxy, e.g. a Cloudflare Worker (free tier). What Devin would set up:
1. **Create a GitHub App** (Settings → Developer settings → GitHub Apps): name "Elorae edit mode",
   Callback URL `https://elorae.world/edit/callback.html`, enable "Request user authorization (OAuth)
   during installation", optionally enable the **Device flow**. Permissions: Repository → Contents
   **Read and write**, Pull requests **Read and write**. Metadata read (automatic). Webhook off.
2. **Install the App** on only the `elorae` repository.
3. **Generate a client secret.** Store it only in the Worker (`wrangler secret put GITHUB_CLIENT_SECRET`),
   never in the repo.
4. **Deploy the Worker** (~40 lines): `POST /token` forwards `{code}` (or the device code) plus the
   client id and secret to `https://github.com/login/oauth/access_token` and returns the JSON with
   `Access-Control-Allow-Origin: https://elorae.world`. Optional `POST /refresh` for refresh tokens.
5. Tell me the App's client id and the Worker URL. The editor would then show a **Enter with GitHub**
   button: redirect, then back with `?code=`, then the Worker, then a user-to-server token (`ghu_…`).
   It acts as the player but can only touch repos where the App is installed (just `elorae`), and only
   with Contents/PR permissions. It expires after 8 hours with a refresh token, so no tokens are copied by hand.
*Security: best for players (a token scoped to one repo, short-lived, no copy and paste). New moving
parts: one Worker, one App, one secret, and Devin owns all three.*

**O4. Plain OAuth App plus the same proxy (≈same effort as O3).** Simpler to register, but OAuth App
tokens use classic scopes (`public_repo` reaches all the user's public repos) and don't expire. *Worse than O3. Not recommended.*

**O5. A server that commits on players' behalf (GitHub App installation token in a Worker, with
players logging in some other way: passphrase, magic link).** Most seamless (no GitHub account
needed), but the Worker becomes the security boundary (auth, rate-limits, per-path checks) and
commits would come from the App, not the player. *Highest effort and risk. Only if players shouldn't need GitHub at all.*

### Recommendation
Do **O1 (org) + O2 (branch protection)** soon: big security win, zero code, and players get repo-scoped
fine-grained tokens. If copying tokens is still too much, do **O3**: it removes tokens from the player's
view entirely.
