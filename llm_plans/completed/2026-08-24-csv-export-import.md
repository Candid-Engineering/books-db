# CSV export/import + minimal Settings page

_Point-in-time plan, agreed 2026-08-24._

## Context

Playtesting requires a way to move a catalog between machines before real server-backed sync exists, and a way for a new user to bootstrap from data they've already been tracking elsewhere. This is that: a fixed CSV interchange format, plus a Settings page to host it (and, later, other data-management actions).

Scoped deliberately small: book fields only (no tags, no cover images), a fixed CSV template rather than flexible column-mapping, all-or-nothing import validation.

No CSV library is present in the repo. Hand-rolling correct CSV quoting/escaping is a real, easy-to-get-wrong problem — titles and subtitles can legitimately contain commas, and naive split-on-comma parsing/writing silently corrupts them. This adds `papaparse` (parse + unparse, handles quoting correctly) rather than reinventing that.

No `@tauri-apps/plugin-dialog` is installed. Needed for native save/open file pickers. Adding it (JS + Rust crate) alongside expanded `fs` capabilities for arbitrary user-chosen paths — the existing `fs:allow-resource-read-recursive` permission only covers bundled resources (e.g. migrations), nothing for a path the user picks via a dialog. Tauri's capability requirements for a given plugin/API combination are often under-documented relative to what actually gets denied at runtime, so the exact capability strings needed here should be verified empirically (get a trivial save/open round-trip working manually) rather than assumed from the docs alone.

## Design

### CSV template (book fields only)

Header: `title,subtitle,authors,isbn10,isbn13,series,pageCount,publicationDate,copyrightDate`

- `authors`: semicolon-joined in one cell (`Frank Herbert; Bill Herbert`) — a common convention for multi-value CSV fields, low collision risk for author names.
- `isbn10`/`isbn13` are parsed and written as plain strings, never through numeric auto-typing — leading zeros are meaningful in ISBNs and numeric coercion would silently corrupt them. papaparse's `dynamicTyping` stays off; `pageCount` is the one field manually coerced to a number after parsing.
- Excluded from v1: tags, `coverImages`, `readAt`, and all internal bookkeeping (`id`, `createdAt`/`updatedAt`/`deletedAt`/`syncedAt`) — not meaningful as a portable interchange format, and keeps the template small enough to hand-fill.
- Export produces exactly this template, so export → import round-trips losslessly for book fields.

### Pure, fully-tested logic (no Tauri APIs, no UI)

`src-ui/lib/csv/csv-export.ts`:
```ts
export function booksToCsv(books: Book[]): string
```

`src-ui/lib/csv/csv-import.ts`:
```ts
export type CsvImportResult =
  | { success: true; books: NewBook[] }
  | { success: false; errors: string[] } // e.g. "Row 7: title is required"

export function csvToBooks(csvContent: string): CsvImportResult
```

Import is all-or-nothing: `csvToBooks` validates every row and collects every problem across the whole file in one pass, rather than stopping at the first bad row — a more useful error report for someone fixing a hand-edited spreadsheet, and a clean invariant (nothing is imported unless the whole file is valid). Only `title` is actually required, matching the database's real `NOT NULL` constraint; everything else, including `authors`, is optional — an empty authors array is valid.

These being plain, Tauri-free functions means they're unit-tested the normal way (`csv-export.test.ts`, `csv-import.test.ts`) — no component-test infrastructure needed, consistent with how business logic lives in plain `.ts`/`.svelte.ts` elsewhere in this codebase while `.svelte` templates stay thin and manually verified.

### Settings page (new)

`src-ui/routes/settings/+page.svelte` — a plain route, same pattern as the existing `about/+page.svelte`. Two buttons for now (Export CSV, Import CSV). Deliberately minimal: a future data-reset ("nuke all local data") feature will extend this page rather than building it here.

- Export: `booksToCsv(booksStore.value)` → `@tauri-apps/plugin-dialog`'s `save()` for a destination path → `@tauri-apps/plugin-fs`'s `writeTextFile()`.
- Import: `plugin-dialog`'s `open()` (filtered to `.csv`) → `plugin-fs`'s `readTextFile()` → `csvToBooks()`. On `success: false`, show the collected errors and import nothing. On success, loop `await booksStore.add(book)` for each row — reuses the existing, already-tested insert path rather than adding a new bulk-insert method.

Adds a `Settings` link to `NavBar`'s existing `navbar-start` slot (`+layout.svelte`), next to `Home`/`About`.

### Not built in this pass

- Flexible/smart column mapping for arbitrary spreadsheet exports — fixed template only.
- Tag export/import.
- Partial-success import — explicitly rejected in favor of all-or-nothing.

## Commit discipline & TDD

1. Add `papaparse` + `@tauri-apps/plugin-dialog`/`tauri-plugin-dialog` as dependencies; grant the new Tauri capabilities (dialog + scoped fs read/write) — verified by getting a trivial save/open round-trip working manually before building real logic on top.
2. `csv-export.ts` — test-first, then implement.
3. `csv-import.ts` — test-first (valid file, missing title on one row, multiple bad rows collected together, empty authors, ISBN leading-zero preservation), then implement.
4. `settings/+page.svelte` + `NavBar` link — wires the above to real dialog/fs calls. Not unit-tested (matches this repo's `.svelte` convention); verified manually.

## Critical files

- `src-ui/lib/csv/csv-export.ts` (new), `csv-export.test.ts` (new)
- `src-ui/lib/csv/csv-import.ts` (new), `csv-import.test.ts` (new)
- `src-ui/routes/settings/+page.svelte` (new)
- `src-ui/routes/+layout.svelte` (NavBar link)
- `src-tauri/capabilities/main.json`, `src-tauri/Cargo.toml`, `package.json`

## Verification

- `pnpm check:js` green after steps 2-3.
- Manual, in `pnpm tauri dev`: export the current catalog, inspect the CSV file directly, re-import it into a fresh/reset local DB, confirm the books round-trip correctly (including a title/subtitle containing a comma, and an ISBN with a leading zero). Try importing a file with a missing title and confirm nothing is imported and the error is shown.
