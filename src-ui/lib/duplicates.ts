import type { Book } from '$lib/types/book.js'

/** The key that decides which physical copies are the same edition. */
function editionKey(book: Book): string {
  return book.isbn13?.trim() || book.isbn10?.trim() || book.id
}

/**
 * Collapse a flat book list into groups of copies of the same edition. Groups
 * keep first-seen order; copies within a group are ordered oldest-acquired
 * first (that copy is the group's "primary").
 */
export function groupByEdition(books: Book[]): Book[][] {
  const groups = new Map<string, Book[]>()
  for (const book of books) {
    const key = editionKey(book)
    const group = groups.get(key)
    if (group) group.push(book)
    else groups.set(key, [book])
  }
  return [...groups.values()].map((group) =>
    [...group].sort((a, b) => (a.createdAt?.getTime() ?? 0) - (b.createdAt?.getTime() ?? 0))
  )
}

/** The sorted names of a book's tags / authors / series rows. */
export function namesOf(rows: { name: string }[]): string[] {
  return rows.map((row) => row.name).sort()
}

/** Do all copies in the group share the value the selector picks out? */
export function converges<T>(books: Book[], selector: (book: Book) => T): boolean {
  if (books.length <= 1) return true
  const first = JSON.stringify(selector(books[0]))
  return books.every((book) => JSON.stringify(selector(book)) === first)
}

export type ReadState = 'all' | 'none' | 'some'

export function readState(books: Book[]): ReadState {
  const read = books.filter((book) => book.readAt != null).length
  if (read === 0) return 'none'
  if (read === books.length) return 'all'
  return 'some'
}
