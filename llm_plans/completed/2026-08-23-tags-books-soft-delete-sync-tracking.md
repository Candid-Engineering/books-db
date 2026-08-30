# Soft-deletes + synced-tracking for books/tags (sync POC, client-side only)

_Point-in-time plan, agreed 2026-08-23. Scoped-down first slice of the fuller design in `eventually/2026-08-23-sync-engine-design.md` — this covers only the local schema/store shape, no server round-trip yet._

## Context

Full sync-engine design (event sourcing, HLC, fractional indexing, server-authoritative conflict resolution) was worked through and archived as long-term direction, but assessed as over-design for what this app needs right now. This plan is the deliberately simple first slice: for data that doesn't need accumulation (tags, book fields), row-level tombstones plus a `synced` marker are enough to make future sync correct, without any op log or event machinery.

## Design

### Schema: `books` and `bookTags` each get three columns

```ts
updatedAt: integer({ mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
deletedAt: integer({ mode: 'timestamp' }), // tombstone; null = active
syncedAt: integer({ mode: 'timestamp' }),  // null = pending push to server
```

`books.id` stays as its existing UUID primary key — no change needed there, since book creation isn't idempotent/re-derivable the way tag creation is (see below), so there's no "recreate with the same identity" case to design around.

`bookTags`' primary key **stays exactly `(bookId, name)`** — deliberately not widened. That's what makes revive-on-conflict and idempotent concurrent-add merging work: there's only ever one row per (book, tag) pair no matter how many times it's added/removed/re-added, so a later op never has ambiguity about which row it targets, and two independent "add" ops for the same pair collapse into one row instead of duplicating. Trade-off accepted: this gives current-state-plus-one-tombstone, not full add/remove/re-add history — fine for tags, would need a real op log if that history ever mattered.

### Store behavior changes (`Books.svelte.ts`)

- **`reload()`**: filter to `deletedAt IS NULL` at both the book level and the nested tags level (drizzle relational `where` on the top-level query and inside the `tags` `with` clause).
- **`edit()`**: bump `updatedAt = now()`, reset `syncedAt = null`, alongside the existing field updates.
- **`remove()`**: becomes an `UPDATE ... SET deletedAt = now()`, not a `DELETE` — and also tombstones the book's still-active tags in the same call (the old `onDelete: 'cascade'` FK is dormant now that hard deletes no longer happen, so this is done explicitly instead). Implemented.
- **`addTag()`**: needs to become an upsert (`insert ... onConflictDoUpdate`) keyed on `(bookId, name)` — a plain insert would throw on a UNIQUE violation when reviving a previously-removed tag, since the tombstoned row still physically exists.
- **`removeTag()`**: becomes an `UPDATE ... SET deletedAt = now()` on the matching row, not a `DELETE`.
- **`reset()`**: left as a hard delete — this is an unused-in-app, dev-only wipe utility (no callers found in the codebase today), not part of the normal synced-mutation surface. Not in scope.

### Explicitly out of scope for this slice

- No Rails/Postgres changes, no push/pull endpoints, no actual network sync round-trip. This only produces the local shape a later sync loop would consume (`WHERE syncedAt IS NULL` as the push query).
- No periodic/triggered pull loop (see `eventually/` doc's "Open questions" — sync transport still needs its own concrete plan once the Rails side is designed).

## Commit discipline & TDD

1. Schema: add the three columns to `books` and `bookTags` in `tables.ts`, generate the migration (`pnpm gen:migration`). Existing test suite must stay green — no test-first step here since it's pure schema/DDL, verified via `pnpm check:js` passing against the current `Books.spec.ts` suite.
2. Test first, then implement: `BooksStore#remove` soft-deletes (row still exists in the underlying table with `deletedAt` set; disappears from `.value`).
3. Test first, then implement: `BooksStore#removeTag` soft-deletes a tag the same way.
4. Test first, then implement: re-adding a previously-removed tag (`updateTags` / `addTag`) revives the existing row (`deletedAt` cleared, no duplicate row, no thrown error) rather than erroring on the PK conflict.
5. Test first, then implement: `edit()` and `addTag()`/`removeTag()` reset `syncedAt` to `null` on every mutation (the property that actually matters for a future push query — more robust to assert than a wall-clock `updatedAt` diff).
6. Update `reload()`'s query to filter out soft-deleted rows at both levels — covered implicitly by steps 2-3's assertions on `.value`, but double-check a soft-deleted book's still-active tags don't leak through if queried directly (documents the known cascade gap rather than silently masking it).

## Critical files

- `src-ui/lib/db/tables.ts`
- `migrations/` (new generated migration + snapshot)
- `src-ui/lib/state/Books.svelte.ts`
- `src-ui/lib/state/Books.spec.ts`

## Verification

- `pnpm check:js` green throughout.
- Manual: `pnpm tauri dev`, add a book, add/remove/re-add a tag, delete a book — confirm the UI behaves identically to today (soft-delete is invisible at the UI layer), and spot-check via `window.db`/`window.orm` in devtools that removed rows still exist with `deletedAt` set rather than being gone.
