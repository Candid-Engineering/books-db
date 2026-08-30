# Duplicate books & multiple copies

_Point-in-time plan, drafted 2026-08-30. Design agreed in conversation;
implementation not started. Preserved as-approved - check current code for
present state._

## Goal

Treat this as a **physical inventory**, not a reading list. Owning two copies
of a book is a valid state (a spare, a loaner, hardback + paperback, one
signed). The app should:

- not silently pile up rows when the same book is scanned twice by accident
- let the user say "yes, this is a second copy" - with its own note
  ("signed by the author", "water-damaged", "lent to Sam")
- show "how many copies of X do I own" without N identical rows cluttering
  the catalogue
- never make the user think about "editions" vs "works" - scanning just
  works, a one-copy book looks like a flat row

## How others treat it

| App | Model | Duplicate handling |
|---|---|---|
| **LibraryThing** | work → edition → copy | dup copies fully supported; per-copy condition / location; a manual "find duplicates" tool; catalogue groups by work |
| **Goodreads** | reading list | "already on your shelves" warning; won't add the same edition twice; shows "other editions" |
| **Libib** | one record + quantity | scan match → "already in library, add anyway?" |
| **Delicious Library** | one record + quantity | quantity field |
| **Library ILS** | full FRBR (work / edition / item) | every physical item has its own barcode record |

### Lessons

1. Inventory tools allow duplicate copies; list tools block them. We're the
   former.
2. The expected interaction is **warn-on-scan with a choice**, not silent
   dedup and not silent duplication.
3. A **quantity integer** loses per-copy data **and** breaks under this app's
   last-write-wins sync (two devices `1 → 2` resolve to `2`, not `3`). So a
   copy is a **row**, never a counter.
4. "How many X do I own" is a **work-level** question (hardback + paperback =
   2 copies of 1 work). Group by work in the view.
5. Automatic grouping needs a real identifier. Fuzzy title/author matching is
   a *suggest-only* tool, never a silent key.

## Data model

**One `books` table. A row is one physical copy** - exactly as today, every
scan makes a row. No `editions` / `copies` split: the work↔edition↔copy
hierarchy is expressed by *grouping in the view*, not by tables. The cost -
bibliographic fields (and tags/authors/series) are denormalised across a
group's copies, and an edit from the grouped row fans out - is accepted;
splitting into tables was considered and rejected as too much migration for a
personal library.

Columns added, across the stages below:

| column | added in | purpose |
|---|---|---|
| `workKey` text, nullable | stage 2 | OL work key (`/works/OL46390W`), captured at scan; the cross-edition grouping key |
| `notes` text, nullable | stage 3 | per-copy: "signed by the author", condition, location |
| `reviewedAt` integer, nullable | stage 4 | null until a human acknowledges this row in a duplicate context; drives the review list |

`readAt` stays on the row (a copy) - "I read the paperback" is expressible;
the grouped view aggregates for "have I read *Dune*".

## Grouping - "all my Dunes"

```
groupKey = COALESCE(NULLIF(workKey,''), NULLIF(isbn13,''), NULLIF(isbn10,''), id)
```

- Same ISBN (re-scanned copies) → one group. **Covers the common pain with
  zero new schema** - this is stage 1.
- Different ISBNs sharing an OL **work key** → one group (hc + pb) - stage 2.
- No ISBN, no work key → the row is its own group.
- **Title is never a grouping key.** "Dune" / "Dune: 40th Anniversary Edition"
  / "Dune (Movie Tie-In)" / "Der Wüstenplanet" all vary. A wrong work-key
  group is rare and traceable to bad OL data; a wrong title group is
  systematic and silent, and in a personal catalogue silent-wrong is worse
  than ungrouped.

## Stages

Each stage ships independently. Rough order; 2 and 3 can swap, 4 is last.

### Stage 1 — grouped catalogue view

No schema change, no scan-flow change. `BooksTable` groups `booksStore.value`
by `COALESCE(NULLIF(isbn13,''), NULLIF(isbn10,''), id)`.

- Collapsed row: cover / title / authors / series / tags from the group's
  first row, an `×N` badge when N > 1, an aggregate read indicator.
- Expand affordance only when N > 1. Expanded: a sub-row per copy - read
  toggle, acquired date (`createdAt`), delete-this-copy.
- Single-copy groups render as a normal flat row, indistinguishable from
  today.

Ships the "I re-scanned Dune and now have 3 rows" fix on its own: the 3 rows
collapse to "*Dune* ×3", expand to delete the extras.

### Stage 2 — `workKey` capture

`ALTER TABLE books ADD workKey text` (both repos; nullable, no backfill).
`getByISBN` already fetches `/works/{id}` for the author/series fallback -
capture `works[0].key` into `workKey`. Grouping key gains the `workKey` term.
Now different editions of one work group together.

### Stage 3 — scan speedbump

`ALTER TABLE books ADD notes text`. `addBookByIsbn`, on a scanned ISBN that
matches an existing **active** row, shows a dialog with the matched book
(cover, title, current copy count) and:

| Action | Effect |
|---|---|
| **Add another copy** | new row, bibliographic fields + `workKey` copied from the match |
| **Add a copy with a note…** | same, then focus a note field on the new copy |
| **Not a new copy** | discard the scan; scroll to / highlight the existing group |

First scan of an ISBN (no match) → no dialog, silent, as today. A
different-ISBN scan that lands in an existing work-key group is **not**
prompted for v1 - it joins silently.

Store: `addCopy(book, { notes? })`, `removeCopy(id)` (= `remove` of one row),
and bibliographic edits from the grouped row become an `editGroup(groupKey,
patch)` that fans out across the group's rows - including their
`book_tags` / `book_authors` / `book_series`.

### Stage 4 — duplicates review (sync-brought duplicates)

A local scan gets the stage-3 speedbump. **Sync can't** - a row pulled from
another device just lands. Two devices scanning the same book offline → two
rows, same ISBN.

No sync-path logic handles this. Instead, `reviewedAt` (nullable, **synced**):

- **null by default** - a plain scan with no local match leaves it null and
  that's fine; the row just sits there.
- set to `now` **only when a human acknowledges the row in a duplicate
  context**: the stage-3 dialog, or the review screen's "keep separate".
- **Review list is a pure query**: active rows where `reviewedAt IS NULL`
  **and** the row shares an ISBN (later: `workKey`, fuzzy title+author) with a
  sibling. No insert hook, no collision check on sync.

Walk it:
- A scans Dune → `rA`, `reviewedAt = null`. Alone → not listed.
- B scans Dune → `rB`, `reviewedAt = null`.
- Sync. Both devices have rA + rB, both null, same ISBN → the query surfaces
  the pair on **both** devices.
- Anyone resolves it → **Merge** (reparent the loser's copies /
  tags / authors / series onto the survivor, tombstone the loser) or **Keep
  separate** (`reviewedAt = now` on the group) or **Delete** → syncs → drops
  off the list everywhere.
- Late-joining device C pulls both already-`now` rows → query never shows
  them.
- A 3rd copy arriving later via sync → born null → group reappears until
  confirmed.

Migration grandfathers existing rows (`reviewedAt = createdAt`) so nobody's
whole catalogue lights up on first load. Single-copy books keep `reviewedAt =
null` forever and never appear - the query needs a sibling.

## Sync

`workKey` / `notes` / `reviewedAt` are plain nullable fields, synced like
every other book column. "Add another copy" mints a new UUID row → two
offline devices each adding a copy merge to two copies. No new sync entity, no
CRDT, no counters.

## CSV

Stage 3+: a `notes` column holding a `;`-separated list, one entry per copy
(empty entry = a bare copy), e.g. `;signed by the author` = 2 copies, one
plain, one signed. `readAt` per copy is over-fine for CSV - export a single
flag, import sets it on copy 1.

## Deferred

- `editions` + `copies` as real tables, if bibliographic/tag/author/series
  drift across a group's copies becomes painful in practice.
- Structured per-copy fields (condition enum, location, lent-to / lent-at)
  beyond free-text `notes`.
- Work-level read state and work-level metadata (ties into the series
  sidecar - series membership is work-level too).
- Prompting on a different-ISBN scan that joins an existing work group.

## Open questions

- `×N` badge: total copies across the group, or "2 editions, 3 copies"?
  (Leaning: total copies.)
- Does "Not a new copy" touch anything (bump the existing row's
  `updatedAt`?), or purely no-op + highlight?
- ISBN reuse (recycled pre-2007 ISBNs, bad POD data) can group two genuinely
  different books. Rare; ignore, or add a "these aren't the same" split later
  (which is just `reviewedAt = now` + a marker to suppress the group).
