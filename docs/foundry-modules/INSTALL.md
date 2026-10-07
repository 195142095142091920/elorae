# Install Elorae Foundry modules (copy world only)

**Target:** Foundry at `http://66.30.4.136:30000/` · world **`copy`** · core **14.368** · system **pf2e 8.5.1**.

**Do not enable these in the original / production world.** Installing into `Data/modules/` makes the packages available to every world, but each world enables modules separately — leave them off everywhere except `copy` until Devin says otherwise.

Zips in this folder (lookup + chronicle-sync **v0.1.1**, calendar **v0.1.0**):

| Zip | Module | Risk |
|---|---|---|
| `elorae-lookup.zip` | Mid-game site lookup + `/elorae` | Low (read-only) |
| `elorae-chronicle-sync.zip` | One-way journal → Foundry Chronicle | Med (writes journals). **Join rewrite stays OFF by default.** |
| `elorae-calendar.zip` | Valoran date HUD + `/date` | Low–Med (offset / advance) |

Full design notes: [`../foundry-elorae-integration.md`](../foundry-elorae-integration.md).

## 1. Put the zips on the Foundry host

On the machine that hosts Foundry user data:

```bash
# From a machine that has these zips (or download them from the site repo path docs/foundry-modules/)
cd "<Foundry user data>/Data/modules"
unzip -o /path/to/elorae-lookup.zip
unzip -o /path/to/elorae-chronicle-sync.zip
unzip -o /path/to/elorae-calendar.zip
# Expect: elorae-lookup/module.json, elorae-chronicle-sync/module.json, elorae-calendar/module.json
```

Alternatively: Foundry **Setup** → Add-on Modules → Install Module → “Manifest URL” / local zip (needs the administrator password). Returning to Setup **closes the running world** for everyone — prefer filesystem unzip while `copy` is active if you can.

Restart Foundry, or return to Setup and launch **`copy`** again so the new packages appear.

## 2. Enable order in world `copy` only

Confirm `/api/status` (or the `/join` title) still says world **`copy`** before enabling anything.

1. **Elorae Lookup** alone  
   - Game Settings → Manage Modules → enable **Elorae Lookup** → Save Module Settings → reload.  
   - Smoke: `/elorae vaerek` → Vaerek Rathkin; sealed names (e.g. Bel Harath) → no public results; optional **Post to chat**.  
   - Token controls book icon / Journal sidebar **Elorae** button should open the same UI.

2. **Elorae Chronicle Sync** (join rewrite **OFF**)  
   - Enable **Elorae Chronicle Sync**. Leave **Rewrite the join-screen World Description** unchecked (default).  
   - On GM load, console should show a chronicle sync line (`elorae-chronicle-sync | chronicle …`).  
   - Expect journal **Elorae Chronicle** with newest chapter first; players Observer. Re-sync with no site change should write nothing.  
   - Optional chat: `/chronicle`, `/chronicle sync` (GM).

3. **Elorae Calendar** (optional, independent)  
   - Enable → HUD / `/date` / set campaign date once. pf2e Golarion clock stays separate.

4. **Join rewrite** — leave **off** for now (night-4 / this package). Only turn on later in **`copy`**, after Devin reviews, style Inline preferred.

## 3. Guarantees

- Modules do not auto-enable in the original world.  
- Chronicle Sync never deletes Foundry pages; sealed / `private: true` site entries are excluded from Lookup and optional Archives.  
- No join-screen `editWorld` unless that setting is explicitly turned on (default false).

## 4. What this packaging pass did / did not do

- Packaged zips + this INSTALL into the site repo for review.  
- Live site parser smoke for Lookup (Vaerek public; Bel Harath absent from public index) — **not** a Foundry UI enable.  
- **Did not** install into Foundry `Data/modules/` (no host filesystem / Setup admin from this agent).  
- **Did not** enable any module in any world. **Original world untouched.**

**v0.1.1 note:** Lookup / Chronicle Sync sealed detection now uses `main.art-body.private|sealed` (masthead `data-owner` alone does not seal a page).
