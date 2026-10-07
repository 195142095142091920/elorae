# Shared art catalog

Images uploaded in edit mode land in `assets/` (shared site art) and are registered in
`edit/media/catalog.json` with title, tags, uploader, date, and who may see them in the editor.

## Visibility
Same shape as secret pages: `owner`, `allowed` (person slugs), `everyone`. Devin always sees
every entry. The gallery browse/insert UI only lists images the signed-in person may see.

## Public URL limit
GitHub Pages cannot hide a file that exists under `assets/`. A visitor who knows or guesses the
URL can fetch it even when `everyone` is false. Catalog visibility only affects the **editor**.
Truly private art needs encrypted blobs (same approach as `edit/secrets/`) — planned later.

## Admin-only (for now)
Upload, tag, visibility, hero replace, and insert are admin-only until players get a narrower path.
