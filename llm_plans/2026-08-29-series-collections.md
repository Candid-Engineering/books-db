# Book series & collections

_Point-in-time plan, agreed 2026-08-29. Preserved as-approved; the actual
implementation may have evolved since — check current code for present state._

## Goal

Represent the fact that books belong to series / collections — *The Lord of
the Rings*, the *Dear America* diaries, *Discworld*, *Foundation* — and sync
that representation with the same fidelity as everything else in the catalogue.
Series is the metadata field most likely to be wrong or missing from the data
source, so **manual editing is a first-class path, not a fallback**.

## How other systems model this (survey)

| System | Series identity | Position | Multi-series per book | Join key |
|---|---|---|---|---|
| **Amazon / KDP** | a name string per title | single integer; blank ⇒ random order | no | exact name-string match across titles |
| **Goodreads** | first-class `Series` entity (own id); Book → Work → Series | decimal string: `#1`, `#1.5` (novella), `#1-3` (omnibus) | yes — `(Series A, #1; Series B, #4)` | work id |
| **LibraryThing** | first-class wiki-curated Series objects | free-text order label + separate sort key; supports *unnumbered* members | yes — sub-series (Discworld → "City Watch"), and multiple orderings of one set (Narnia publication vs chronological) as separate series | work id |
| **Google Books API** | `seriesInfo.volumeSeries[]` with series id | splits `bookDisplayNumber` (string, display only) from `orderNumber` (int, sort) + `seriesBookType` | yes | series id |
| **Libraries / MARC** | `830` = authorized/controlled series heading (grouping) | `v.` volume designation | yes | authority record |
| **Open Library** (our source) | `series`: free-text `string[]`, mostly on the Edition, sometimes Work; no id, no structured position | none — number is jammed into the string (`"The Lord of the Rings, Part 1"`, `"Dear America"`) | multiple array entries, rarely | none |

### Lessons carried into our design

1. Separate three things: series *identity* (a name), *membership* (this book is
   in it), and *position*. Within position, separate the **display label**
   (`"1.5"`, `"Book Three"`, `"1–3"`) from a sortable **sort key**.
2. Name-string joins are fragile (Amazon's most-common linking complaint). We
   accept the fragility — same trade-off already made for tags/authors — and
   mitigate with a cheap "rename this series everywhere" store method.
3. Membership is a property of the *work*, not the edition. OL conflates them;
   we land on work-level (parse-on-scan pulls from the edition, falls back to the
   linked work — mirrors the author fallback in `openLibrary.ts`).
4. Unnumbered series are normal (Dear America, most Goosebumps). The model must
   not force a number — fall back to publication date.
5. Multiple orderings and sub-series are real but rare — mature systems handle
   them by making *more series*, not by adding structure. We do the same
   ("naming convention": `"Discworld: City Watch"`, `"Narnia (chronological)"`).

## Data model decision

Three options were on the table:

- **Model-A — denormalised string column.** `books.series` (exists today) + a
  sort key. No join. One series per book. Smallest change, but can't express
  meta-series / sub-series / alternate orderings, and renames fragment the group.
- **Model-B — first-class `Series` entity (uuid) + `book_series` join.** Two new
  synced entities. The uuid identity buys: two distinct series with the same
  display name; single-row renames; shared/curated identity across users. It
  costs an ongoing **merge-tooling** problem — two offline devices each scanning
  a *Foundation* book mint different-uuid `series` rows that then need
  reconciling. None of what it buys applies to a personal catalogue.
- **Model-C (chosen) — name-keyed membership table + name-keyed metadata
  sidecar.** Mirrors the `book_tags` / `book_authors` pattern exactly.

Why a book can be in more than one series (justifies not putting a UNIQUE
constraint on `book_series.bookId`): meta-series (*The Way of Kings* is
Stormlight Archive #1 **and** Cosmere #x), omnibus editions, publisher-imprint
re-issues, and — via the naming convention — sub-series and alternate orderings.
Supporting multiple rows costs nothing extra once the key is `(bookId, name)`.

### Schema

```
book_series            -- membership; ships in PR 1
  bookId    text     ─┐ PK
  name      text     ─┘   the series name — the identity, same as a tag/author name
  label     text          display position: "1", "1.5", "1–3", "Book Three"; nullable
  sortKey   real          ordering within the series; nullable → fall back to publicationDate, then title
  updatedAt integer
  deletedAt integer       tombstone (null = active)
  syncedAt  integer       null = pending push
  FK bookId → books.id ON DELETE CASCADE
  -- Rails side additionally: user_id (denorm from owning book), server_seq

series                 -- metadata sidecar; ships in PR 2, only when a view reads it
  name        text  PK
  description text
  coverImages text (json)
  totalCount  integer     canonical volume count, for "you have 3 of 7"; nullable
  updatedAt / deletedAt / syncedAt  (+ server_seq on Rails)
```

`label` **and** `sortKey` both earn their place: LOTR is `label "1" / sortKey 1`;
*The Foundation Trilogy* omnibus is `label "1–3" / sortKey 1` (sorts at the
front); *Prelude to Foundation* is `label "0.1" / sortKey 0.1`; a *Dear America*
diary is `label null / sortKey null` and sorts by `publicationDate`.

### Trade-offs accepted

- No two series can share an exact display name (disambiguate the name instead).
- A rename touches N rows (tombstone the old name + write the new, across
  `book_series` and later `series`) instead of 1. Bounded, one store method.
- Both are the same trade-off the codebase already made for tags and authors.

### This becomes the reusable pattern

Authors already have the membership half (`book_authors`, keyed by name). When
authors need a photo/bio, add an `authors` sidecar keyed by name — same move, no
disruption to what exists.

## PR 1 — membership, sync, migration, edit, lookup

Scope agreed: `book_series` table + sync parity both repos + migration from the
existing `books.series` string + editable Series column in the catalogue +
Open Library parse-on-scan. **No `series` sidecar** — but name the pieces so
adding the sidecar later is purely additive.

Templates to follow line-by-line:
- Rails migration: `db/migrate/20260827160000_create_book_authors.rb`
- Client migration: `migrations/20260827051046_add_book_authors_table.sql`
- Store method: `BooksStore.updateAuthors` (diff-and-apply)
- Sync wiring: every `bookAuthors` / `book_authors` reference added in PR #62

### Commit discipline & TDD

Small, separate commits per logical unit. The two repos are separate commits
regardless; don't batch pieces within a repo either. **Red before green** on
every step — write and run the failing test first, even where the code mirrors
an already-tested pattern.

**Step 0:** commit this plan document into `llm_plans/` (done alongside PR #63).

### Client (`books-db`) build order

1. `book_series` in `tables.ts` + relation in `relations.ts`; `bookSeriesSince`
   on `sync_state`; `Book` type gains `series: BookSeries[]`.
2. Drizzle migration: create table, add cursor column, backfill from
   `books.series` (parse `"Name (1)"` / `"Name #1"` → row), drop `books.series`.
3. `openLibrary.ts`: `parseSeries(raw: string) → { name, label, sortKey } | null`
   (strip trailing `", Part N"` / `" #N"` / `" vol. N"` / `" (N)"` / `" Book N"`),
   wired into `normalizeOpenLibraryBook`; edition first, fall back to the linked
   work. `OpenLibraryBookData` returns `series` instead of `book.series`.
4. `BooksStore.updateSeries(book, entries[])` — diff-and-apply mirroring
   `updateAuthors`; `reload()` includes `series`; `remove()` tombstones series
   rows.
5. `add-book-by-isbn.ts` applies the parsed series.
6. `sync-api.ts`: `bookSeriesToWire` / `bookSeriesFromWire`, `Rejection` variant,
   `PullCursors.bookSeries`, push/pull wiring.
7. `sync-engine.ts`: include `bookSeries` in push (null `syncedAt`) and
   pull/apply.
8. `BooksTableRow.svelte`: editable Series column — freeform
   `Name #label, Other #3` → parse → `updateSeries`.
9. `csv-import.ts` / `csv-export.ts`: `series` column ⇄ rows (`Name #1`,
   `;`-separated for multiple).

### Server (`books-db-rails`) build order

10. Migration, `create_book_authors`-style: `book_series` PK `(book_id, name)`,
    `user_id`, `server_seq`, backfill from `books.series` with per-user counter
    increments, `remove_column :books, :series`.
11. `BookSeries` model (Discard, denorm `user_id`, `assign_server_seq`);
    `Book has_many :book_series`.
12. `sync_controller.rb`: `BOOK_SERIES_FIELDS`, push branch, pull query + cursor,
    strong params.
13. Request specs for `/sync/push` + `/sync/pull` parity.

## PR 2 — series metadata + browse view

- `series` sidecar table (schema above) + sync parity.
- Series detail / browse view: group `book_series` rows by `name`, order by
  `sortKey` then `publicationDate` then `title`; show `totalCount` progress
  ("3 of 7") when the sidecar has it.
- Future, not scheduled: Google Books `seriesInfo.orderNumber` as a better
  secondary source for position; missing-volume gap detection.

## Open items

- Working tree had an uncommitted `openLibrary.ts` change (work→author
  fallback) — landed separately as PR #63 before PR 1 starts.
- CSV position format: `Name #1` chosen over the current `Name (1)`; the
  migration parser accepts both.
