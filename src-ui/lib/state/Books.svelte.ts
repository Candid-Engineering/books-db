import { v4 as uuidv4 } from 'uuid'
import { type Book, type NewBook } from '$lib/types/book.js'
import realDb from '$lib/db/index.js'
import * as schema from '$lib/db/schema'
import type { SqliteRemoteDatabase } from 'drizzle-orm/sqlite-proxy'
import { eq } from 'drizzle-orm/sql/expressions/conditions'

class BooksStore {
  private constructor(private db: SqliteRemoteDatabase<typeof schema>) {}
  static async create(db: SqliteRemoteDatabase<typeof schema>) {
    const store = new BooksStore(db)
    await store.reload()
    return store
  }

  #value = $state<Book[]>([])

  get value(): Book[] {
    return this.#value
  }
  // TODO(rkofman): set was removed because it doesn't make sense w/ a DB backed store.
  // but it implies I will need to rewrite some tests -- which is needed anyway, because
  // making them be unit-tests would be hard here.

  async add(book: NewBook): Promise<string> {
    // NOTE (isummit): we're using a library instead of window.crypto because window.crypto.randomUUID is
    // not available for older versions of macOs webviews, which some of our users may be on (macOs v11.1)
    const id = uuidv4()
    const book_with_id: Book = { ...book, id } as Book

    await this.db.insert(schema.books).values({ ...book_with_id })
    await this.reload()
    return id
  }

  async edit(updatedBook: Book): Promise<void> {
    await this.db.update(schema.books).set(updatedBook).where(eq(schema.books.id, updatedBook.id))
    await this.reload()
  }
  async remove(id: string): Promise<void> {
    await this.db.delete(schema.books).where(eq(schema.books.id, id))
    await this.reload()
  }

  async reset(): Promise<void> {
    await this.db.delete(schema.books)
    await this.reload()
  }

  async reload(): Promise<BooksStore> {
    this.#value = await this.db.select().from(schema.books)
    return this
  }
}

let booksStorePromise: Promise<BooksStore>
export async function createBooksStore(): Promise<BooksStore> {
  if (booksStorePromise === undefined) {
    booksStorePromise = BooksStore.create(realDb)
  }
  return booksStorePromise
}

export async function createTestBooksStore(
  testDb: SqliteRemoteDatabase<typeof schema>
): Promise<BooksStore> {
  return BooksStore.create(testDb)
}
export type { BooksStore }
