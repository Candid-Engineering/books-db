# Duplicate copies — Stage 1 (grouped catalogue row)

_Point-in-time plan, agreed 2026-08-30. Supersedes the Stage 1 section of
`2026-08-30-duplicate-copies.md`, which predated the expandable detail row
(#74/#76). Same goal, reconciled with the row that now always expands to
`BookDetail`._

## Context

Re-scanning a book you already own makes a second `books` row, so the
catalogue shows "Dune", "Dune", "Dune". Stage 1 collapses same-ISBN rows into
one row with an `×N` badge, expandable to manage the individual copies. No
schema change, no scan-flow change — purely a view over `booksStore.value`.

## Grouping

```
groupKey(book) = book.isbn13?.trim() || book.isbn10?.trim() || book.id
```

`BooksTable` groups `booksStore.value` into `Book[][]`, each group in the
position of its first-seen member; copies within a group ordered by
`createdAt` ascending (oldest = the "primary"). Pure function
`groupByEdition(books)` in `$lib/duplicates.ts`, unit-tested on its own.

`BooksTableRow` takes `books: Book[]` (length ≥ 1) instead of `book: Book`.

## Collapsed row (N > 1)

- `×N` badge beside the title.
- Each editable cell (title / authors / tags / series) checks **convergence** —
  do all copies share that field's value?
  - **converged** (or N = 1): inline-editable as today; the edit **fans out**
    to every copy.
  - **diverged**: rendered as greyed, non-editable text (the primary's value)
    with `title="Varies across copies — expand to edit"`. Editing that field
    happens per-copy in the expanded view.
- Cover: the primary's thumbnail.
- Read: aggregate checkbox — checked when all copies are read, `indeterminate`
  when mixed. Toggling sets every copy read (or every copy unread if all were
  read).
- Scanned: the primary's (earliest) `createdAt`.
- Delete: removes the **whole group** (unambiguous with the `×N` badge); the
  expanded view is where you remove one copy.

N = 1 groups render exactly as today — same flat row, same inline editing.

## Expanded view

`{#if expanded}` sub-row, `<td colspan>`:

- `BookDetail` for the primary — the shared bibliographic panel. Its edits also
  fan out across the group (converged fields) via the same store method.
- Below it, **Copies (N)** — a `BookCopiesList` component: one line per copy
  with its `createdAt`, a read toggle, and a delete-this-copy button.

N = 1: just `BookDetail`, as today (no "Copies" section).

## Store

`Books.svelte.ts` gains group operations, each a fan-out over the existing
per-book methods with a single `reload()` at the end:

- `editGroup(books: Book[], patch: Partial<Book>)` — scalar fields (title,
  subtitle, dates, page count, ISBNs, `readAt`).
- `updateGroupAuthors(books, names)` / `updateGroupTags` / `updateGroupSeries`
  — reuse `updateAuthors` etc. per copy.
- `removeGroup(books)` — `remove` per copy.

Per-copy actions in the expanded list use the existing `edit` / `remove`.

## Convergence helpers (`$lib/duplicates.ts`)

- `groupByEdition(books): Book[][]`
- `converges(books, selector)` — `books.every(b => selector(b) === selector(books[0]))`,
  with an array-aware variant for authors/tags/series (compare sorted name lists).
- `readState(books): 'all' | 'none' | 'some'`

All pure, all unit-tested.

## Out of scope (later stages, unchanged)

- `workKey` grouping across editions (Stage 2)
- scan speedbump + per-copy `notes` (Stage 3)
- sync-brought-duplicate review + `reviewedAt` (Stage 4)

## Commit discipline & TDD

1. `$lib/duplicates.ts` + `duplicates.spec.ts` — grouping, convergence, read
   state. Pure, fast, first.
2. Store group methods + `Books.spec.ts` cases (fan-out hits every copy; one
   reload).
3. `BooksTable` groups and passes `Book[]` to the row; `BooksTable.spec.ts` —
   three same-ISBN books render one row with `×N`; different ISBNs stay
   separate; N = 1 unchanged.
4. `BooksTableRow` collapsed grouped behaviour — `BooksTableRow.spec.ts`:
   converged field editable + fans out; diverged field greyed + not a textbox;
   aggregate read toggle; group delete.
5. `BookCopiesList` + spec — per-copy date / read / delete.
6. Wire `BookCopiesList` into the expanded sub-row; `BooksTableRow.spec.ts` —
   expanding a group shows `BookDetail` + N copy lines.
7. `pnpm check:js` green throughout.

## Critical files

- `src-ui/lib/duplicates.ts` (new) + spec
- `src-ui/lib/components/BooksTable.svelte`, `BooksTableRow.svelte`
- `src-ui/lib/components/BookCopiesList.svelte` (new) + spec
- `src-ui/lib/state/Books.svelte.ts` + `Books.spec.ts`
- `src-ui/lib/components/BookDetail.svelte` — accept a fan-out edit path

## Verification

- `pnpm check:js` green.
- `pnpm tauri dev`: scan the same ISBN 3× → one row, `×3`; expand → shared
  panel + 3 copy lines; delete one copy → `×2`; edit the title on the grouped
  row → all copies change; give two copies different tags in the panel → the
  Tags cell greys out on the collapsed row.
