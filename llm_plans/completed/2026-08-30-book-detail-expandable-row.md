# Book detail — expandable catalogue row

_Point-in-time plan, agreed 2026-08-30. Builds on the component-test infra from
`2026-08-30-svelte-component-testing.md` (#72). Supersedes the "hide ISBN
columns" sketch — the ISBN columns still go, but into a full detail panel, not
just a two-field sub-row._

## Context

The catalogue table (`BooksTable` / `BooksTableRow`) shows eight columns, two of
them raw identifiers (ISBN 10, ISBN 13) before the title, and it's the only
place a book can be viewed or edited. Meanwhile the app **stores and never
shows**: cover art (small/medium/large URLs), subtitle, page count, publication
date, copyright date. A book catalogue with no covers and ISBNs up front is
backwards.

Replace the flat row with a disclosure row + an in-place **detail panel**: cover
image and every field, all inline-editable (same click-to-edit feel as the
cells today). The ISBN columns leave the default view and reappear in the panel.
Collapsed rows stay a fast scan; a single-copy book with the panel closed looks
almost exactly like today, minus two columns.

Decisions taken (with the user, 2026-08-30):
- **Placement:** expandable row, not a drawer or a `/books/:id` route. Keeps one
  surface and composes with duplicate-copies Stage 1
  (`2026-08-30-duplicate-copies.md`), which also expands rows.
- **Editing:** always inline-editable, no view/edit toggle.

## Design

### Columns

Header drops **ISBN 10** and **ISBN 13**. New order:

```
[▸] | cover | Title | Author | Tags | Series | Read? | Scanned | [⌫]
```

- `[▸]` disclosure toggle — per-row `expanded` (`$state(false)` in
  `BooksTableRow`). Rotates to `▾` when open.
- `cover` — a small (~28px tall) thumbnail, or a placeholder box when there's no
  image. Makes the list scannable at a glance.
- `[⌫]` delete moves to the **end** of the row (row-actions-on-the-right is the
  common table idiom; also gets it away from the new disclosure control).
- Empty-state `<td colspan>` drops 9 → 8.

### Store seam (needed to test any of this)

`BooksTable` and `BooksTableRow` call the `getBooksStore()` module singleton
(over `realDb`) directly — unrenderable under jsdom. Add an optional prop:

- `BooksTable.svelte`: `let { booksStore = getBooksStore() } = $props()`, pass
  `{booksStore}` down to each `<BooksTableRow>`.
- `BooksTableRow.svelte`: `booksStore` becomes a prop (remove its own
  `getBooksStore()` call).
- `+page.svelte` is unchanged — the default binds the singleton in production.
- New `src-ui/testing/component-helpers.ts`: `booksStoreWith(seed: NewBook[])`
  — builds a store on the per-test `testDb.drizzle` (via `createTestBooksStore`,
  already exported), inserts the seed, awaits load. The reusable render fixture.

### `Editable` primitive (first commit, isolated)

`EditableTd.svelte`'s guts (a `contenteditable` element with `bind:innerText`,
blur → `onChange`, Enter → commit) get their second consumer in the panel.
Extract them:

- New `Editable.svelte` — `<span contenteditable bind:innerText>` + the blur /
  Enter logic. `display:block` so it fills its container and the whole area is a
  click target.
- `EditableTd.svelte` → `<td><Editable {value} {onChange} /></td>`.
- New `EditableField.svelte` — `<div class="field"><span class="label">{label}
  </span><Editable {value} {onChange} /></div>` for the panel's labelled rows.

This commit ships alone with tests proving table editing is unchanged, so the
regression risk on the most-used component is caught before the panel lands.

### `BookDetail.svelte` — the panel

Rendered in a second `<tr><td colspan>` under the book when `expanded`. Bulma
`.media` layout:

- **figure:** `<img>` at `coverImages.medium`, with `?default=false` appended so
  a missing cover 404s and an `onerror` swaps in a placeholder (📖 box with the
  title's initials). `coverImages` itself is display-only, not editable.
- **content:** `EditableField` rows for every editable field —
  `subtitle`, `publicationDate` (freeform: "1965", "October 1996"),
  `copyrightDate`, `pageCount`, `isbn10`, `isbn13`. Plus `title` / `authors` /
  `tags` / `series` (also on the row; both edit through the same store — fine).
  `readAt` as a checkbox + its date. `createdAt` ("Added") read-only — it's the
  acquisition record.

Field writes reuse existing store methods:
- scalars → `booksStore.edit({ ...book, [field]: value })` (already spreads every
  column; `pageCount` coerced `Number(v) || null`, empty string → `null` for the
  nullable text fields).
- `authors` / `tags` / `series` → `updateAuthors` / `updateTags` / `updateSeries`
  (unchanged, as `BooksTableRow` calls them today).

No schema change, no sync change — every field already syncs.

### AddBookModal

Reorder fields so identifiers come last: Title / Author(s) / Tags / Read?, then
ISBN-10 / ISBN-13 under a plain "Identifiers" sub-heading. No behaviour change.
(Longer-term the user wants "Add Book" to be an inline empty row instead of a
modal — out of scope here, noted in `2026-08-30-duplicate-copies.md`.)

## Stages

**PR 1 — substrate + declutter.** Store seam + `component-helpers.ts`;
`Editable` extraction; disclosure column; drop ISBN columns; cover thumbnail in
the row; delete moves right; `BookDetail` with **just** the ISBN fields +
"Added" so nothing is lost; AddBookModal reorder. Ships the "ISBNs aren't in my
face" win.

**PR 2 — full panel.** `BookDetail` gains the cover image (+ placeholder /
`onerror`), subtitle, publication date, copyright date, page count, and the
title/authors/tags/series editors. `EditableField` throughout.

Splittable further if PR 2 gets big (cover image as its own step). One PR is
fine too if review stays manageable.

## Explicitly out of scope

- CSV parity for the newly-editable fields (`csv-import` / `csv-export` only
  carry a subset today) — worth a follow-up once the fields are proven in the UI.
- A cover-forward gallery / grid view of the catalogue — tempting given "creative
  UX", but a separate feature.
- Editing `coverImages` (picking / overriding a cover).
- Route-level detail (`/books/:id`), deep links.
- Duplicate-copies grouping (`2026-08-30-duplicate-copies.md`).

## Commit discipline & TDD

Every component change is test-first against the #72 infra
(`@testing-library/svelte`, jsdom). Specs live next to the component as
`*.spec.ts`.

1. **`Editable` extraction.** Move `EditableTd.spec.ts`'s cases to
   `Editable.spec.ts` (red → extract → green); `EditableTd.spec.ts` shrinks to
   "renders a `<td>` wrapping `Editable`". Add `EditableField.spec.ts` (label
   renders; edit → `onChange`).
2. **Store seam.** `component-helpers.ts` + `booksStoreWith`. First real
   store-backed render test: `BooksTableRow` renders a seeded book's title.
3. **Row: drop ISBN columns.** `BooksTable.spec.ts` — header has no "ISBN"
   text, has a disclosure column; `BooksTableRow.spec.ts` — no ISBN cell in the
   collapsed row. (Red first: assert absence against today's row → fails.)
4. **Row: disclosure + panel mount.** `BooksTableRow.spec.ts` — panel absent
   when collapsed; clicking `[▸]` mounts `BookDetail`; clicking again unmounts.
5. **`BookDetail` fields.** `BookDetail.spec.ts` — renders each field's value;
   editing `publicationDate` (and `pageCount`, `isbn13`, …) calls
   `booksStore.edit` with the new value / coercion; `readAt` toggle.
6. **`BookDetail` cover.** renders `<img>` with the medium URL + `?default=false`;
   `onerror` reveals the placeholder.
7. **AddBookModal reorder.** `AddBookModal.spec.ts` — field order is
   Title-first; ISBNs present under "Identifiers".
8. `pnpm check:js` green throughout.

## Critical files

- `src-ui/lib/components/BooksTable.svelte`, `BooksTableRow.svelte`
- `src-ui/lib/components/BookDetail.svelte` (new)
- `src-ui/lib/components/core/Editable.svelte` (new), `EditableTd.svelte`,
  `EditableField.svelte` (new)
- `src-ui/lib/components/AddBookModal.svelte`
- `src-ui/testing/component-helpers.ts` (new)
- `src-ui/lib/state/Books.svelte.ts` — only if `edit()` needs `pageCount`
  coercion; otherwise untouched
- specs alongside each component

## Verification

- `pnpm check:js` — format, typecheck, lint, full suite green.
- `pnpm tauri dev`:
  - catalogue shows no ISBN columns; each row has a disclosure control and a
    cover thumbnail (or placeholder).
  - expand a row → cover + all fields; edit publication date / pages / ISBN /
    subtitle inline, collapse, and the change survives a reload (round-trips
    through `booksStore.edit` → SQLite).
  - toggle read in the panel and in the row — both reflect.
  - a book with no cover shows the placeholder, not a broken image.
  - scan a known ISBN (`📖 Simulate ISBN`) → new row, expand shows the captured
    ISBN / pages / date.
  - "Add Book" modal lists Title first, ISBNs last.
