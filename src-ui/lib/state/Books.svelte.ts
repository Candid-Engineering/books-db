import { v4 as uuidv4 } from 'uuid'
import { type Book, type NewBook } from '$lib/types/book.js'
import realDb from '$lib/db/index.js'
import * as schema from '$lib/db/schema'
import type { SqliteRemoteDatabase } from 'drizzle-orm/sqlite-proxy'
import { eq } from 'drizzle-orm/sql/expressions/conditions'

class BooksStore {
  constructor(private db: SqliteRemoteDatabase<typeof schema>) {
    void this.reload().then(() => {
      this.#initialized = true
    })
  }

  static create(db: SqliteRemoteDatabase<typeof schema>) {
    return new BooksStore(db)
  }

  #initialized = $state(false)
  #value = $state<Book[]>([])

  get initialized(): boolean {
    return this.#initialized
  }

  get value(): Book[] {
    return this.#value
  }

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

let booksStore: BooksStore
export function getBooksStore(): BooksStore {
  if (booksStore === undefined) {
    booksStore = new BooksStore(realDb)
  }
  return booksStore
}

export function createTestBooksStore(testDb: SqliteRemoteDatabase<typeof schema>): BooksStore {
  return new BooksStore(testDb)
}
export type { BooksStore }
