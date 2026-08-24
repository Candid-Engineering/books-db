# Sync engine design: operation-based, server-authoritative

_Point-in-time design doc, agreed 2026-08-23. This is a conceptual design captured from a brainstorming session — not an implementation-ready plan, not broken into commit steps, no code exists for this yet. Filed under `eventually/` deliberately: this is the long-term shape, not what's being built next. See `2026-08-23-tags-poc.md` (once it exists) for the scoped-down first slice actually being implemented._

## Context

Books-db is explicitly being used as practice for a future point-of-sale / catalog-editing system. The immediate question was "how should client (Tauri/SQLite) and server (Rails/Postgres) stay in sync," but the answer needed to hold up under POS-shaped requirements that don't exist in the current toy app yet: real backend domain logic (reporting, true stock counts, payment/refund processing, customer accounts), multi-device use (phone + register + back office), offline-capable clients, and no data loss even when events arrive out of order.

## Core principle

**Model mutations as operations, not whole-row upserts.** `addTag`/`removeTag`, not `tags: [...]`. This one idea is what the rest of the design falls out of — commutative operations merge correctly across concurrent, offline, out-of-order clients without needing to detect or resolve most conflicts at all.

## Decisions made

### Server is authoritative; client is optimistic

Two logic engines, deliberately: the **client** applies operations to its local state immediately on creation (instant UI, fully usable offline, only validates what it can know locally — well-formed input, not global truth). The **server** is where truth-dependent domain logic lives (real stock levels, payment authorization, reporting) and is the final authority when optimism and reality diverge.

When the server needs to correct an optimistic client operation (oversold stock, a declined payment), it never rewrites or deletes history — it appends a new compensating operation (e.g. `Oversold`, `PaymentDeclined`) that flows back down through the normal sync channel like any other op, and the client applies it the same way it applies anything else. History is append-only on both sides, always.

### Set-like relations: join tables, not arrays

Many-to-many data (tags on a book) is modeled as a join table (`book_tags: book_id, tag_id`). `addTag` = insert-if-not-exists, `removeTag` = delete. Both are naturally idempotent (unique constraint on the pair) and naturally commutative — union/difference of sets doesn't care what order concurrent adds/removes arrive in, so no ordering or conflict-resolution machinery is needed for the common case.

The one real conflict is two devices concurrently add-ing and remov-ing the *same* tag on the same book while both offline. That's resolved with a plain `updated_at` timestamp on the row — last write wins for that specific pair. This is a narrow, well-understood conflict between two known operations on one row, not a general causal-ordering problem.

### Scalar fields: JSON-Patch-shaped ops, last-write-wins

Ordinary field edits (title, price, description) are synced as patch-style operations against a single value, with the later `updated_at` winning on conflict. JSON Patch (RFC 6902) is a reasonable, standard format for this — and since the log is kept (see Undo/redo below), replaying patches up to any point gives rewind close to free.

**Explicitly not** used for array-shaped data (tag lists, ordered lists) — a generic JSON Patch array op like `{op: "add", path: "/tags/-", value: ...}` reintroduces exactly the clobbering problem the join-table design avoids (concurrent appends can duplicate or index-conflict). JSON Patch is scoped to scalar/whole-value fields only.

### Ordered lists: fractional indexing, not integer indices or array patches

List position is its own independent, mergeable field per item — a string-valued order key (Figma's technique; reference implementation is the `fractional-indexing` npm package, from a Figma engineer), not an array index. Inserting between two items generates a new key that sorts strictly between its neighbors' keys; strings are used instead of floats specifically because strings can always be subdivided further, floats run out of mantissa precision.

This gives list reordering the same commutative-by-construction property as tags: `moveItem(id, newOrderKey)` is just another scalar-field op (LWW per item), and concurrent inserts near the same position never require renumbering or touching any other item's row.

**Collision handling**: two devices can concurrently generate the identical order key (inserting between the same two neighbors while both offline). Resolved at the server, synchronously, on write — the server is the single point all writes flow through, so it can detect an exact-duplicate key at ingestion and regenerate one of the two before it's ever persisted or broadcast. The fix flows back to the originating client as an ordinary correction op, same pattern as the stock-oversell case above. No background collision-repair sweep needed, and no duplicate key is ever actually committed. (A defensive secondary sort tiebreak of `(order_key, updated_at, id)` is cheap to keep for display purposes regardless, but write-time server resolution is what actually prevents the "can't insert precisely between two collided items" gap from opening up.)

Unbounded key-length growth (many inserts repeatedly at the same boundary over time) is a separate, lower-priority concern — housekeeping/bloat, not correctness — and can be handled by an occasional background rebalance pass, distinct from collision handling.

### Deletes: soft, always

Deletes are tombstones (`deleted_at`), never row removal. This is necessary (not sufficient) for correct sync: it stops a delete from being destructive in a way a stale/out-of-order sync could resurrect, and makes undelete trivial. It does **not** by itself provide rewind to prior states — that requires keeping the operation history, a separate mechanism (see below).

### Undo/redo

Falls out of keeping the operation log, with one rule: undo is itself a new forward operation appended to the log (an inverse op, or a `Reverted{op_id}` marker) — never a deletion or rewind of the log itself. This keeps sync sound: other devices just see one more ordinary op arrive, not a mutated past.

Undo depth is bounded by how much history is retained before compaction — see below. That coupling is a deliberate design lever (decide the retention window on purpose), not an accident to discover later.

### Compaction

Two categories of operation, compacted differently:
- **State-replacing** (`TitleChanged`, `moveItem`) — trivially compactable. Only the latest value matters; older ones can be dropped once nothing still needs them.
- **Accumulating** (a future `Sold`/`StockAdjusted`, if/when this app or its POS successor has real counters) — can't be dropped, only *folded* into a snapshot (`StockSnapshot{count: 42, as_of: op#500}`) that becomes the new baseline future ops apply on top of.

Critically, the **compaction watermark must be based on sync/delivery progress** (a server-assigned monotonic sequence number, plus each client's last-acknowledged cursor into it — "safe to compact past N means every client we still care about has synced past N"), **not on operation age**. Age/timestamp-based cutoffs risk discarding data a long-offline straggler device still needs, since a client-generated timestamp says nothing about whether the operation has actually been delivered anywhere yet.

## Deliberately not built (considered and rejected/deferred)

- **Whole-database sync on an interval** — simplest possible option, rejected outright: wasteful bandwidth, gets worse as the catalog grows, no real conflict handling.
- **Hand-mirrored schemas on both sides (Rails/Postgres models ⟷ Drizzle/SQLite tables)** — works, but two independently-evolving schemas drift; the operation-based design sidesteps this because the actual cross-language contract is the (much smaller, more stable) *operation/event shape*, not full table parity. Each side is free to store data however suits it internally.
- **Server as a generic jsonb blob store** (`records: id, table_name, row_id, data jsonb, updated_at, deleted_at`) — seriously considered as a way to kill schema duplication when the server had no real logic of its own. Rejected once the POS-practice framing surfaced real backend responsibilities (reporting, true stock, payments, refunds) that a dumb blob store can't own — the server needs real, typed domain state for that.
- **Cross-language schema codegen** (Postgres introspection → generated Drizzle/SQLite schema, or vice versa) — no existing tooling targets this pairing well; Postgres→SQLite type mapping is lossy enough (jsonb, arrays, enums, timestamptz have no SQLite equivalent) that most non-trivial columns would need hand-annotation anyway, undermining the point. Not worth building bespoke infra for ~2-3 tables.
- **Move the client to embedded Postgres** (PGlite / ElectricSQL-style "Postgres everywhere") — a legitimate, real answer that eliminates the schema-parity problem entirely by using the identical dialect (and potentially identical migrations) on both sides. Not chosen here because it's a foundational rewrite of the existing Drizzle/SQLite client data layer, not a sync-layer decision — bigger than "practice building a sync engine" calls for. Worth revisiting if the goal ever shifts to "practice the full stack a real POS would ship" rather than "practice the sync engine specifically."
- **General-purpose HLC-ordered event log with vector-clock-style causal ordering** — the mechanism was worked through in detail (client-generated Hybrid Logical Clocks — wall time + logical counter + device-id tiebreak — for causally-correct out-of-order application) and is sound, but assessed as over-design for what this app actually needs right now: it doesn't yet have accumulating/aggregate fields whose correctness depends on general causal ordering. The narrower mechanisms above (per-field LWW timestamps, join-table set ops, fractional indexing, server-arbitrated write-time collision resolution) cover the real requirements without it. Revisit if/when true accumulating fields (running counts, balances) enter the picture — the POS successor project almost certainly will need this.
- **Random postfix on every fractional-index insert** (the common defense against key collisions) — rejected in favor of server-side write-time resolution: paying key-length cost on every single insert forever to guard against a rare race is worse than fixing the race the one time it actually happens, especially since the collision-repair logic (server-authoritative correction-as-op) was needed anyway for other reasons.

## Open questions (not yet decided)

- Concrete operation/aggregate taxonomy for this app specifically (what operations actually exist beyond the tags/title examples used to think this through).
- Concrete retention window / compaction cadence, and therefore the practical undo-depth guarantee.
- Concrete sync transport: push/pull endpoint shapes, cursor field names, batching — the conceptual protocol (client pushes pending ops, pulls anything past its last-seen server cursor, both directions run through the same idempotent apply function) was agreed but not spec'd.
- Whether to eventually reconsider the embedded-Postgres approach instead of this bespoke design (see above) — an open fork depending on which practice goal takes priority.
