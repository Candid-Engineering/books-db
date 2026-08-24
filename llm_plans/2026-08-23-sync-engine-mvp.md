# Sync engine MVP: books + tags, push/pull over REST

_Point-in-time plan, agreed 2026-08-23. Scoped-down, implementation-ready first slice of the fuller design in `eventually/2026-08-23-sync-engine-design.md`. Spans both `books-db` and `books-db-rails`._

## Context

`books-db` (Tauri/Svelte, SQLite/Drizzle) and `books-db-rails` (Rails/Postgres) are sibling repos. The client already has the local groundwork for sync (landed earlier this session): `books`/`book_tags` carry `updatedAt`/`deletedAt`(tombstone)/`syncedAt`(pending-push marker) columns, mutations go through soft-delete/upsert-revive logic, `remove()` cascades the tombstone to a book's tags. None of that has ever talked to a server — this plan builds the actual client↔server sync round-trip.

The long-term sync design (event sourcing, HLC, fractional indexing, compaction) is intentionally **not** what's being built here — that's archived as aspirational direction in `eventually/2026-08-23-sync-engine-design.md`, assessed as over-design for what this app needs today. This plan is the deliberately simple MVP explicitly agreed in conversation: whole-row push/pull, **last write to the server wins** (plain overwrite, no client-clock comparison), server-assigned sequence numbers purely as a pull cursor.

Confirmed via research (`books-db-rails`): no `Book`/`BookTag`/sync model exists yet, and **no request-authentication mechanism exists yet either** (`ApplicationController` is bare — token *issuance* exists via `Token::Auth`, but nothing today reads an `Authorization` header and resolves `current_user`). Both are new infrastructure this plan adds.

## Design

### Scope decisions (named simplifications, consistent with the rest of this project's sync work)

- **Whole-row overwrite, not field-level patches.** Push sends a full row; the server persists it as-is. No JSON-Patch, no per-field LWW — that's `eventually/`'s design, deliberately not used here since this app has no accumulating fields that need it.
- **"Last write to server wins," not clock-based LWW.** No client `updated_at` is compared for conflict resolution — whichever push reaches the server last simply overwrites. This avoids any dependency on client clocks/HLC (out of scope), at the accepted cost that two racing offline edits are resolved by network arrival order, not true causal order. Matches what was explicitly agreed earlier in this project's design conversation.
- **`updated_at` becomes server-managed, not client-original-edit-time.** Rails' own `updated_at` (bumped on every push-driven save) is what round-trips back down on pull and overwrites the client's local `updatedAt`. This means `updatedAt` now reads as "last synced," not "last actually edited by a human" — a real, deliberate semantic shift, acceptable since nothing else in this app currently displays or depends on true edit-time precision.
- **`server_seq` exists purely as a pull cursor**, not a general event-ordering mechanism. One monotonically-increasing integer per table (`books.server_seq`, `book_tags.server_seq`), assigned via an `ActiveRecord` `before_save` callback pulling from a Postgres sequence (`nextval`) — plain Ruby, not a DB trigger, since this app has no existing trigger precedent and nothing writes to these tables outside Rails today.
- **No ActionCable / push-triggered sync.** Periodic (`setInterval`) + on-boot pull only, per this project's earlier agreed design ("pull is the correctness-guaranteeing baseline; push is a latency optimization" — not needed yet). `solid_cable` is present in the Rails Gemfile but nothing is wired to it; not touched by this plan.
- **Delete-cascade is entirely client-decided.** The client already cascades a book's tombstone to its tags before push (landed earlier this session); the server just persists whatever `deleted_at` state each row arrives with — no server-side cascade logic needed.
- **Ownership is per-row-checked, not all-or-nothing.** A pushed row whose `id` already exists under a different `user_id` is skipped and reported back as `rejected`, not silently applied and not failing the whole batch. Unlikely to matter for a single/personal-multi-device user, but wrong data landing under someone else's account is the one failure mode worth guarding explicitly rather than trusting client-supplied IDs blindly.

### Rails: `Book` / `BookTag` models

New tables, UUID PKs (matches this app's existing convention — `gen_random_uuid()` default, though pushed rows always arrive with a client-generated UUID already set, matching client `uuidv4()` book IDs 1:1, no ID-mapping needed):

```ruby
create_table :books, id: :uuid do |t|
  t.references :user, null: false, foreign_key: true, type: :uuid
  t.string :isbn10
  t.string :isbn13
  t.string :title, null: false
  t.string :subtitle
  t.jsonb :authors, null: false, default: []
  t.string :series
  t.integer :page_count
  t.string :publication_date   # free text on purpose, matches client (e.g. "October 1996") — not a real date column
  t.string :copyright_date     # same
  t.jsonb :cover_images
  t.datetime :read_at
  t.datetime :discarded_at     # tombstone, via the `discard` gem already used by User
  t.bigint :server_seq
  t.timestamps
end
add_index :books, :server_seq, unique: true
add_index :books, [:user_id, :server_seq]

create_table :book_tags, primary_key: [:book_id, :name] do |t|  # composite PK, Rails 8 supports this — mirrors the client's (bookId, name) PK, same reason: row identity must survive add/remove/re-add so revive-on-conflict works
  t.references :book, null: false, foreign_key: true, type: :uuid
  t.string :name, null: false
  t.datetime :discarded_at
  t.bigint :server_seq
  t.timestamps
end
add_index :book_tags, :server_seq, unique: true
```

`Book`/`BookTag` models: `include Discard::Model` (matches `User`'s existing pattern exactly), `belongs_to :user` / `belongs_to :book`.

**Implemented** (superseding the original `nextval()`/advisory-lock sketch below, which turned out to be wrong): a bare Postgres `SEQUENCE` created via raw `execute` in a migration is invisible to `schema.rb` — it dumps tables/columns/indexes, not freestanding sequences, so the sequence silently vanished on the next `db:schema:load` (caught immediately via `db:test:prepare` failing). Fixed with a plain `sync_counters(table_name, user_id, value)` table instead — fully `schema.rb`-visible — and `SyncCounter.next_value(table_name, user_id)` does a single atomic upsert (`INSERT ... ON CONFLICT (table_name, user_id) DO UPDATE SET value = value + 1 RETURNING value`). `Book#assign_server_seq`/`BookTag#assign_server_seq` (a `before_save`) call this.

Keying the counter **per user** turned out to fully replace the planned advisory lock, not just avoid the schema.rb problem: the upsert's row lock on that user's counter row is held for the transaction, so a second concurrent push for the *same* user blocks on that row until the first commits — exactly the serialization the advisory lock was for, as a side effect of assigning the value, with no second mechanism needed. Cross-user writes are unaffected (different rows). This is why the original gap-visibility bug (two concurrent push transactions assigning seqs in one order but committing in another, permanently skipping a row past an already-advanced pull cursor) is fixed: assignment order now can't diverge from commit order for a given user's stream.

`Book.has_many :book_tags, dependent: :destroy` / `User.has_many :books, dependent: :destroy` were added (see the CCPA hard-delete addition below) — these only fire on a real `.destroy`, never on `.discard` (a plain `save`), so they don't affect the sync-tombstone path at all.

### Added mid-implementation, not in the original design: `User#erase!`

Raised during implementation: users need a real hard-delete path for CCPA/GDPR-style erasure requests, distinct from the normal `.discard` soft-delete. The `discard` gem doesn't provide one (unlike `paranoia`, which has `really_destroy!` — checked the installed gem source directly rather than assuming); plain `.destroy!` already is a full hard delete once `Discard::Model` is involved, so `User#erase!` is a thin, clearly-named wrapper (`destroy!`) so intent is unambiguous at call sites. Cascades via the `dependent: :destroy` associations above. No controller/API endpoint for this yet — deliberately out of scope here, this is the underlying capability only.

### Rails: authentication concern (new)

`app/controllers/concerns/authenticatable.rb`, reusing `Token::Auth` exactly as `TokensController#auth` already does internally — no new token/crypto logic, just wiring the existing verification into a `before_action`:

```ruby
module Authenticatable
  extend ActiveSupport::Concern
  included { before_action :authenticate! }

  private

  def authenticate!
    raw = request.headers["Authorization"]&.split(" ")&.last
    token = Token::Auth.new(raw.to_s)
    if token.valid?
      @current_user = token.to_user
    else
      render json: { errors: [{ code: token.error, message: token.error_message }] }, status: :unauthorized
    end
  end

  def current_user = @current_user
end
```

Matches the existing `{ errors: [{code:, message:}] }` shape used elsewhere (`tokens_controller.rb`) rather than inventing a new error format.

### Rails: `SyncController` (new)

Routes (flat, explicit-path style — matches `/tokens/*`, not `resources`, since these aren't CRUD-shaped):
```ruby
post "/sync/push", to: "sync#push"
get  "/sync/pull", to: "sync#pull"
```

**Wire shape, revised during implementation**: rather than hardcoded top-level fields per entity type, both endpoints key on a type name so a future entity (e.g. `authors`) is just another map key, not a new top-level field/param name to invent (a genuine wire-breaking change, worth generalizing slightly now while no client exists against it yet — see below for the boundary this stopped short of).

**`POST /sync/push`** — body `{ entities: { books: [...], book_tags: [...] } }` (snake_case field names matching the DB columns above, e.g. `page_count`, `cover_images`, `discarded_at`). For each row: find by PK; if found under a different `user_id`, collect into `rejected` and skip; otherwise upsert all fields (`user_id` set only on create) — plain overwrite, no comparison, matching "last write to server wins." Saving bumps `updated_at` and `server_seq` automatically. Response: `{ rejected: [{ type: "books", id: }, { type: "book_tags", book_id:, name: }] }` (`type` matches the entities map key), status 200 (this is a batch — per-item rejection isn't a request-level failure).

**`GET /sync/pull?since[books]=0&since[book_tags]=0`** — `Book.where(user_id: current_user.id).where("server_seq > ?", since).order(:server_seq)`, and (after the server_seq fix below made `user_id` a direct column on `book_tags`) the equivalent query directly on `BookTag`, no join needed. Response: `{ entities: { books: [...], book_tags: [...] }, cursors: { books:, book_tags: } }` where the cursors are the max `server_seq` seen (or the incoming cursor unchanged if nothing new). Tombstoned rows are included (not filtered out) — the client needs them to apply the delete locally.

**Explicitly not generalized further**: the per-type *server-side handling* (ownership check, model lookup, upsert) stays as plain repeated code per type, not a registry/dispatcher keyed off the entity map. With only two concrete types, building that abstraction now would mean guessing its shape rather than seeing it — the same reasoning `eventually/` already applies to bigger deferred mechanisms. Revisit once a third real type shows up.

**Bug caught by the pull tests, fixed as its own commit**: `server_seq` is only unique within a user's own stream (`SyncCounter` is keyed per `(table_name, user_id)`), not globally — the original migration indexed it as globally unique, so two different users' first book (both `server_seq = 1`) collided. Fixed with a follow-up migration scoping both unique indexes to `(user_id, server_seq)`, denormalizing `user_id` onto `book_tags` (safe — a tag's owning book never changes user) so that index is expressible there directly.

### Rails tests

`spec/requests/sync_spec.rb`, matching `tokens_spec.rb`'s style (FactoryBot, `describe "POST /sync/push"` / `describe "GET /sync/pull"`, `aggregate_failures`). New factories `spec/factories/books.rb`, `spec/factories/book_tags.rb`. Covers: unauthenticated request rejected; new book/tag accepted; re-push overwrites (last-write-wins, no error); tombstoned row accepted and stored as discarded; cross-user id collision rejected and reported, not applied; pull respects `since` cursor and per-user scoping; pull includes tombstoned rows; empty `since=0` returns everything. Authentication itself is exercised through these specs rather than a separate concern-only test, consistent with this repo's "test through public interfaces" convention.

### Tauri client: cursor storage (new)

New singleton table (same pattern as `local_user`):
```ts
export const syncState = sqliteTable('sync_state', {
  singleton: integer().primaryKey().default(1),
  booksSince: integer().notNull().default(0),
  bookTagsSince: integer().notNull().default(0),
})
```
New migration via `pnpm gen:migration`.

### Tauri client: `sync-api.ts` (new)

Mirrors `auth-api.ts`'s `postJson` pattern, but authenticated (`Authorization: Bearer <token>` from `authStore.getAuthToken()`) and adds a `getJson` for the pull's query-string GET. Owns the snake_case↔camelCase field translation (`discarded_at`⟷`deletedAt`, `page_count`⟷`pageCount`, `publication_date`⟷`publicationDate`, `copyright_date`⟷`copyrightDate`, `cover_images`⟷`coverImages`, `read_at`⟷`readAt`, `updated_at`⟷`updatedAt`, `book_id`⟷`bookId`) — same kind of boundary translation `auth-api.ts` already does for its own fields.

Request/response shapes match the revised Rails contract (a keyed entities map, see above) rather than hardcoded fields per type:
```ts
export async function pushEntities(entities: { books: LocalBookRow[]; bookTags: LocalTagRow[] }): Promise<{ rejected: Rejection[] }>
export async function pullEntities(since: { books: number; bookTags: number }): Promise<{
  entities: { books: RemoteBookRow[]; bookTags: RemoteTagRow[] }
  cursors: { books: number; bookTags: number }
}>
```

### Tauri client: `SyncEngine` (new, `src-ui/lib/sync/sync-engine.ts`)

Takes `db` (same constructor-injection pattern as `BooksStore`, for `testDb` in tests) and a `BooksStore` instance (to trigger `reload()` after applying pulled rows — keeps pull-application logic out of `BooksStore`'s public API, which stays focused on user-driven mutations).

- `push()`: select `books`/`bookTags` rows where `syncedAt IS NULL`, call `sync-api.pushEntities`, mark everything **not** in the response's `rejected` list as `syncedAt = now()`. Rejected rows stay pending (visible signal something's wrong) rather than being silently dropped.
- `pull()`: read the stored cursor from `sync_state`, call `sync-api.pullEntities`, upsert each returned row into local `books`/`book_tags` via `insert...onConflictDoUpdate` on the PK — setting **all** fields from the server payload including `syncedAt = now()` (this is the one place a mutation intentionally does *not* clear `syncedAt`, since the row is already known-synced) — then advance `sync_state`'s cursor to the response's `cursors.books`/`cursors.bookTags`, and only after the whole batch applies successfully. Calls `booksStore.reload()` at the end so reactive UI picks up the change.
- `sync()`: `push()` then `pull()` — push first so any of this device's own edits are already reflected server-side before pulling (see the earlier design conversation's reasoning: avoids waiting a full extra cycle to see your own accepted state).

### Tauri client: wiring (`hooks.client.ts`)

After `await authStore.initialize()`: if `authStore.state.isAuthenticated`, call `syncEngine.sync()` once immediately, then `setInterval(() => { if (authStore.state.isAuthenticated) void syncEngine.sync() }, 60_000)`. Not unit-tested — matches this file's existing convention (verified manually, same as `authStore.initialize()` wiring was).

## Commit discipline & TDD

Archive this plan as `books-db/llm_plans/2026-08-23-sync-engine-mvp.md` first, standalone commit (this file).

**`books-db-rails`** (small commits, request-spec-first where there's real behavior):
1. Migration + `Book`/`BookTag` models + factories. No behavior yet to test-first beyond "table/model exists" — light model specs only if a real validation is added (e.g. `title` presence).
2. `Authenticatable` concern — written alongside step 3 since it has no independent public interface to test against yet (see "test through public interfaces" note above).
3. `POST /sync/push` — request-spec-first (new row, overwrite, tombstone, cross-user rejection, unauthenticated), then implement `SyncController#push` + route. Per-user write serialization is already handled by `SyncCounter`'s row-locked upsert (see above) — no separate lock needed in the controller itself.
4. `GET /sync/pull` — request-spec-first (cursor filtering, per-user scoping, tombstones included, empty-cursor full sync), then implement `SyncController#pull`.

**`books-db`** (small commits, TDD):
5. `sync_state` schema + migration.
6. `sync-api.ts` — test-first (MSW-mocked, mirroring `auth-api.test.ts`): request shape, auth header, field-name translation both directions.
7. `SyncEngine#push` — test-first (`testDb` + MSW): only pending rows sent, synced rows marked, rejected rows stay pending.
8. `SyncEngine#pull` — test-first: rows applied and marked synced without re-marking pending, cursor advances only after full batch applies, re-pull is idempotent (no duplicate rows, no re-application side effects).
9. `SyncEngine#sync` — test-first: push-then-pull ordering.
10. `hooks.client.ts` wiring — verified manually, not unit tested.

## Critical files

- `books-db-rails/db/migrate/*_create_books_and_book_tags.rb`, `app/models/book.rb`, `app/models/book_tag.rb`, `app/models/sync_counter.rb`, `spec/factories/books.rb`, `spec/factories/book_tags.rb`
- `books-db-rails/app/models/user.rb` (`#erase!`, `has_many :books, dependent: :destroy`), `spec/models/user_spec.rb`
- `books-db-rails/app/controllers/concerns/authenticatable.rb`
- `books-db-rails/app/controllers/sync_controller.rb`, `spec/requests/sync_spec.rb`, `config/routes.rb`
- `books-db/src-ui/lib/db/tables.ts` (new `syncState` table), `migrations/`
- `books-db/src-ui/lib/sync/sync-api.ts` (new), `sync-api.test.ts` (new)
- `books-db/src-ui/lib/sync/sync-engine.ts` (new), `sync-engine.test.ts` (new)
- `books-db/src-ui/hooks.client.ts`

## Verification

- `bundle exec rspec` green in `books-db-rails` after each Rails step.
- `pnpm check:js` green in `books-db` after each client step.
- Manual, end to end: run both dev servers (`rails server`, `pnpm tauri dev`). Sign in, add a book with a tag, confirm it appears in Postgres (`rails dbconsole` or `Book.last`) with the correct `user_id` shortly after (interval or app restart triggers pull/push). Edit the title, confirm the update round-trips. Remove the book, confirm it and its tag show `discarded_at` set on the server rather than being gone. Wipe the local SQLite file and relaunch the app signed in as the same user — confirm the catalog rehydrates from a pull.
