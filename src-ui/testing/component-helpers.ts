import { createTestBooksStore, type BooksStore } from '$lib/state/Books.svelte'
import type { NewBook } from '$lib/types/book.js'
import { testDb } from './db-setup.js'

/**
 * A BooksStore backed by the per-test database (see db-setup.ts), seeded with
 * `books` and loaded, ready to hand to a component under test as its
 * `booksStore` prop.
 */
export async function booksStoreWith(books: NewBook[] = []): Promise<BooksStore> {
  const store = createTestBooksStore(testDb.drizzle)
  await store.ready
  for (const book of books) await store.add(book)
  return store
}
