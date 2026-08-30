# Preserve entry order for tags / authors / series

_Point-in-time plan, agreed 2026-08-30._

## Context

`book_tags`, `book_authors`, `book_series` have the composite PK `(book_id,
name)` and the catalogue query (`BooksStore.reload`, Rails `sync_controller`)
has no `ORDER BY`, so SQLite/Postgres return the rows in PK order — alphabetical
by name. The order the user typed is lost. This is wrong for authors
(first-author-first is meaningful) and unwanted for tags and series.

Fix: a `position` column on all three child tables, written from the incoming
list order, ordered by in every read.

## Design

### Column

`position integer` on `book_tags`, `book_authors`, `book_series`.

- **Client** (SQLite): nullable (`ALTER TABLE ... ADD COLUMN` against a table
  with rows can't take a non-constant default). Reads order by
  `(position, name)` so any null sorts deterministically.
- **Rails** (Postgres): `integer, null: false, default: 0`; backfill existing
  rows `position = row_number() over (partition by book_id order by name) - 1`
  (i.e. today's alphabetical order becomes the initial positions — least
  surprising).

`book_series.sort_key` stays — it's a different axis (a book's position
*within* a series, for the future browse view). `position` is the order of a
book's series memberships in *its own* list.

### Writing it

The store's `#applyTags` / `#applyAuthors` / `#applySeries` already take the
full ordered list. Extend them: for each `(name, i)` in the incoming list,
upsert with `position: i` — but skip the write when the row already exists at
that position (mirrors what `#applySeries` does for label/sortKey today), so a
no-op edit doesn't churn `syncedAt`.

`addTag` / `addAuthor` / `upsertSeries` gain a `position` parameter, set in both
the `values` and the `onConflictDoUpdate` `set`.

### Reading it

- `BooksStore.reload`: add `orderBy` to each `with` clause —
  `orderBy: (t, { asc }) => asc(t.position)`.
- Rails `sync_controller#pull`: the child queries already `.order(:server_seq)`;
  that's the sync cursor order and must stay. Ordering for *display* is the
  client's job (it just did), so no Rails read-order change — but `position`
  must be in `BOOK_TAG_FIELDS` / `BOOK_AUTHOR_FIELDS` / `BOOK_SERIES_FIELDS` so
  it's serialised.

### Sync

- Client `sync-api.ts`: `position` into `bookTagToWire` / `bookAuthorToWire` /
  `bookSeriesToWire` and the `Wire*` / `Remote*` interfaces and `*FromWire`.
- Client `sync-engine.ts` pull: already spreads `{ ...tag }` into the upsert,
  so `position` flows through once it's on the wire type.
- Rails `entities_params`: permit `:position` on all three.
- Rails push: `assign_attributes(...except(:book_id, :name))` already applies it.

## Stages / PRs

1. **Rails** (`books-db-rails`) — migration + FIELDS + strong params + specs.
   Merge first (the client integration spec needs it).
2. **Client** (stacked on #77, since it just refactored `#applyTags` etc.) —
   schema column + migration + `#apply*` position writes + `reload` orderBy +
   wire mapping + tests.

## Commit discipline & TDD

Client:
1. Schema: add `position` to the three tables in `tables.ts`; `pnpm
   gen:migration`. Existing suite stays green.
2. Test-first: `updateTags(book, ['b', 'a'])` then reload → `book.tags` is
   `['b', 'a']`, not `['a', 'b']`. Same for authors, series.
3. Test-first: re-ordering an existing list (`['a','b']` → `['b','a']`) updates
   positions and marks those rows pending sync; an unchanged list writes
   nothing.
4. Test-first (`sync-api.test.ts`): `position` round-trips through
   `*ToWire` / `*FromWire`.
5. `pnpm check:js` green.

Rails: mirror — request specs for `position` on push and pull, migration
reversibility, schema.rb reproducibility (existing CI check).

## Critical files

- `books-db-rails`: `db/migrate/*_add_position_to_book_children.rb`,
  `app/controllers/authenticated/sync_controller.rb`, `spec/requests/sync_spec.rb`
- client: `src-ui/lib/db/tables.ts`, `migrations/`,
  `src-ui/lib/state/Books.svelte.ts` + `Books.spec.ts`,
  `src-ui/lib/sync/sync-api.ts` + `sync-api.test.ts`

## Verification

- `pnpm check:js` + `bundle exec rspec` green.
- Manual: add tags `zebra, apple` to a book → they stay `zebra, apple` in the
  row and the panel, across a reload and a sync round-trip.
