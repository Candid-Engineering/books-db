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

`Book`/`BookTag` models: `include Discard::Model` (matches `User`'s existing pattern exactly), `belongs_to :user` / `belongs_to :book`, plus the `server_seq` assignment:

```ruby
before_save { self.server_seq = self.class.connection.select_value("SELECT nextval('books_server_seq')") }
```
(sequence name per table)

No `dependent: :destroy`/discard-cascade on the association — see scope decision above.

**Correctness issue caught in review, fixed via per-user locking (not a separate assignment process):** a bare `nextval()` has a real gap-visibility race under concurrency. Two concurrent push transactions (e.g. the same user's phone and laptop syncing at once) can call `nextval()` in one order but commit in the other — if the transaction that got the *lower* seq is still slower to commit, a pull that already advanced its cursor past the *higher* seq (from the transaction that committed first) will permanently skip the lower-seq row once it finally commits, since `server_seq > cursor` no longer includes it.

Fixed by serializing writes **per user** (not globally, and not via a separate background assignment process — both `server_seq` gapless-ness and pull filtering are already scoped per-`user_id`, so the race only matters *within* one user's own concurrent writes): `SyncController#push` takes a Postgres advisory transaction lock keyed on the user before writing, forcing at most one push transaction per user to be assigning/committing sequence numbers at a time — so assignment order is guaranteed to match commit order for that user's stream, which is exactly what pull's cursor correctness depends on. Cross-user writes are completely unaffected (different lock keys). Pull needs no corresponding change — Postgres's normal read-committed visibility already guarantees a pull only ever sees committed rows, and once writes are serialized per-user there's no longer a gap to be visible to.

**Deliberately not fully specified here**: the exact structure (where the lock is acquired relative to the transaction boundary, how the user is hashed into a lock key, how it's tested) is agreed as *approach only* — worth working through carefully together at implementation time rather than locking in a sketch now.

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

**`POST /sync/push`** — body `{ books: [...], book_tags: [...] }` (snake_case field names matching the DB columns above, e.g. `page_count`, `cover_images`, `discarded_at`). For each row: find by PK; if found under a different `user_id`, collect into `rejected` and skip; otherwise upsert all fields (`user_id` set only on create) — plain overwrite, no comparison, matching "last write to server wins." Saving bumps `updated_at` and `server_seq` automatically. Response: `{ rejected: [{ type: "book", id: }, { type: "book_tag", book_id:, name: }] }`, status 200 (this is a batch — per-item rejection isn't a request-level failure).

**`GET /sync/pull?books_since=0&tags_since=0`** — `Book.where(user_id: current_user.id).where("server_seq > ?", books_since).order(:server_seq)`, similarly for `BookTag.joins(:book).where(books: { user_id: current_user.id }).where("book_tags.server_seq > ?", tags_since)`. Response: `{ books: [...], book_tags: [...], books_cursor:, tags_cursor: }` where the cursors are the max `server_seq` seen (or the incoming `since` value unchanged if nothing new). Tombstoned rows are included (not filtered out) — the client needs them to apply the delete locally.

### Rails tests

`spec/requests/sync_spec.rb`, matching `tokens_spec.rb`'s style (FactoryBot, `describe "POST /sync/push"` / `describe "GET /sync/pull"`, `aggregate_failures`). New factories `spec/factories/books.rb`, `spec/factories/book_tags.rb`. Covers: unauthenticated request rejected; new book/tag accepted; re-push overwrites (last-write-wins, no error); tombstoned row accepted and stored as discarded; cross-user id collision rejected and reported, not applied; pull respects `since` cursor and per-user scoping; pull includes tombstoned rows; empty `since=0` returns everything. Authentication itself is exercised through these specs rather than a separate concern-only test, consistent with this repo's "test through public interfaces" convention.

### Tauri client: cursor storage (new)

New singleton table (same pattern as `local_user`):
```ts
export const syncState = sqliteTable('sync_state', {
  singleton: integer().primaryKey().default(1),
  booksSince: integer().notNull().default(0),
  tagsSince: integer().notNull().default(0),
})
```
New migration via `pnpm gen:migration`.

### Tauri client: `sync-api.ts` (new)

Mirrors `auth-api.ts`'s `postJson` pattern, but authenticated (`Authorization: Bearer <token>` from `authStore.getAuthToken()`) and adds a `getJson` for the pull's query-string GET. Owns the snake_case↔camelCase field translation (`discarded_at`⟷`deletedAt`, `page_count`⟷`pageCount`, `publication_date`⟷`publicationDate`, `copyright_date`⟷`copyrightDate`, `cover_images`⟷`coverImages`, `read_at`⟷`readAt`, `updated_at`⟷`updatedAt`, `book_id`⟷`bookId`) — same kind of boundary translation `auth-api.ts` already does for its own fields.

```ts
export async function pushBooks(books: LocalBookRow[], tags: LocalTagRow[]): Promise<{ rejected: Rejection[] }>
export async function pullBooks(booksSince: number, tagsSince: number): Promise<{ books: RemoteBookRow[]; bookTags: RemoteTagRow[]; booksCursor: number; tagsCursor: number }>
```

### Tauri client: `SyncEngine` (new, `src-ui/lib/sync/sync-engine.ts`)

Takes `db` (same constructor-injection pattern as `BooksStore`, for `testDb` in tests) and a `BooksStore` instance (to trigger `reload()` after applying pulled rows — keeps pull-application logic out of `BooksStore`'s public API, which stays focused on user-driven mutations).

- `push()`: select `books`/`bookTags` rows where `syncedAt IS NULL`, call `sync-api.pushBooks`, mark everything **not** in the response's `rejected` list as `syncedAt = now()`. Rejected rows stay pending (visible signal something's wrong) rather than being silently dropped.
- `pull()`: read the stored cursor from `sync_state`, call `sync-api.pullBooks`, upsert each returned row into local `books`/`book_tags` via `insert...onConflictDoUpdate` on the PK — setting **all** fields from the server payload including `syncedAt = now()` (this is the one place a mutation intentionally does *not* clear `syncedAt`, since the row is already known-synced) — then advance `sync_state`'s cursor to the response's `booksCursor`/`tagsCursor`, and only after the whole batch applies successfully. Calls `booksStore.reload()` at the end so reactive UI picks up the change.
- `sync()`: `push()` then `pull()` — push first so any of this device's own edits are already reflected server-side before pulling (see the earlier design conversation's reasoning: avoids waiting a full extra cycle to see your own accepted state).

### Tauri client: wiring (`hooks.client.ts`)

After `await authStore.initialize()`: if `authStore.state.isAuthenticated`, call `syncEngine.sync()` once immediately, then `setInterval(() => { if (authStore.state.isAuthenticated) void syncEngine.sync() }, 60_000)`. Not unit-tested — matches this file's existing convention (verified manually, same as `authStore.initialize()` wiring was).

## Commit discipline & TDD

Archive this plan as `books-db/llm_plans/2026-08-23-sync-engine-mvp.md` first, standalone commit (this file).

**`books-db-rails`** (small commits, request-spec-first where there's real behavior):
1. Migration + `Book`/`BookTag` models + factories. No behavior yet to test-first beyond "table/model exists" — light model specs only if a real validation is added (e.g. `title` presence).
2. `Authenticatable` concern — written alongside step 3 since it has no independent public interface to test against yet (see "test through public interfaces" note above).
3. `POST /sync/push` — request-spec-first (new row, overwrite, tombstone, cross-user rejection, unauthenticated), then implement `SyncController#push` + route. Per-user advisory locking is part of this step, but its exact structure and how to test it (a true concurrent-write race is hard to assert deterministically in a request spec) is intentionally left to be worked out carefully during implementation, not pre-decided here — don't skip discussing it when this step comes up.
4. `GET /sync/pull` — request-spec-first (cursor filtering, per-user scoping, tombstones included, empty-cursor full sync), then implement `SyncController#pull`.

**`books-db`** (small commits, TDD):
5. `sync_state` schema + migration.
6. `sync-api.ts` — test-first (MSW-mocked, mirroring `auth-api.test.ts`): request shape, auth header, field-name translation both directions.
7. `SyncEngine#push` — test-first (`testDb` + MSW): only pending rows sent, synced rows marked, rejected rows stay pending.
8. `SyncEngine#pull` — test-first: rows applied and marked synced without re-marking pending, cursor advances only after full batch applies, re-pull is idempotent (no duplicate rows, no re-application side effects).
9. `SyncEngine#sync` — test-first: push-then-pull ordering.
10. `hooks.client.ts` wiring — verified manually, not unit tested.

## Critical files

- `books-db-rails/db/migrate/*_create_books_and_book_tags.rb`, `app/models/book.rb`, `app/models/book_tag.rb`, `spec/factories/books.rb`, `spec/factories/book_tags.rb`
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
