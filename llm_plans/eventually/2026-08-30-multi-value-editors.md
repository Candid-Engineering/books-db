# Multi-value editors for tags / authors / series

_Point-in-time note, filed 2026-08-30. Not implementation-ready — captures a
direction raised while adding `position` to the child tables
(`2026-08-30-child-row-position.md`)._

## The problem

Tags, authors and series are edited today as a single comma-joined string in an
`Editable` cell. On blur the whole string is re-parsed and the store diffs it
against the current list (`BooksStore.#applyTags` etc.) — remove the missing,
add the new, now also renumber `position`.

This works but it's coarse:

- every edit is a full-list replace; there's no "add one tag" or "remove this
  one" operation
- reordering means retyping
- parsing is naive (a comma inside a tag name breaks it)
- the diff has to reconstruct intent that a proper widget would know directly
- fan-out across a copy group (`updateGroup*`) re-diffs per copy

## The direction

A real chip / token editor per field: existing values as removable pills, a
typeahead to add, drag-or-arrow to reorder. It emits **operations**
(`add(name, atIndex)`, `remove(name)`, `move(from, to)`) rather than a new full
list, so the store gets:

- `addTag(book, name, position)` / `removeTag(book, name)` / `moveTag(book,
  name, position)` as first-class store methods
- clean group fan-out (apply the same op to each copy)
- `position` maintained incrementally, not recomputed
- typeahead backed by the set of names already used across the catalogue

## Why later

The string editor is fine for a personal catalogue's typical 1–3
tags/authors. The chip widget is a chunk of UI work (keyboard a11y, dnd,
typeahead) and the store-method refactor. `2026-08-30-child-row-position.md`
deliberately keeps the full-list `#apply*` path and just adds `position` on top
— so this can replace it cleanly when it's worth building.
