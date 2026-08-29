import { v4 as uuidv4 } from 'uuid'
import { type Book, type NewBook } from '$lib/types/book.js'
import { type ParsedSeries } from '$lib/series.js'
import realDb from '$lib/db/index.js'
import * as schema from '$lib/db/schema'
import type { SqliteRemoteDatabase } from 'drizzle-orm/sqlite-proxy'
import { and, eq, isNull } from 'drizzle-orm/sql/expressions/conditions'
import _ from 'lodash'

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

    await this.db.insert(schema.books).values({ ...book_with_id, updatedAt: new Date() })
    await this.reload()
    return id
  }

  async edit(updatedBook: Book): Promise<void> {
    await this.db
      .update(schema.books)
      .set({ ...updatedBook, updatedAt: new Date(), syncedAt: null })
      .where(eq(schema.books.id, updatedBook.id))
    await this.reload()
  }

  async updateTags(book: Book, tags: string[]): Promise<void> {
    const existingTags = book.tags.map((bookTag) => bookTag.name)
    for (const tagToRemove of _.difference(existingTags, tags)) {
      await this.removeTag(book, tagToRemove)
    }
    for (const tagToAdd of _.difference(tags, existingTags)) {
      await this.addTag(book, tagToAdd)
    }
    await this.reload()
  }

  private async addTag(book: Book, tagName: string): Promise<void> {
    await this.db
      .insert(schema.bookTags)
      .values({ bookId: book.id, name: tagName })
      .onConflictDoUpdate({
        target: [schema.bookTags.bookId, schema.bookTags.name],
        set: { deletedAt: null, updatedAt: new Date(), syncedAt: null },
      })
  }

  private async removeTag(book: Book, tag: string): Promise<void> {
    await this.db
      .update(schema.bookTags)
      .set({ deletedAt: new Date(), updatedAt: new Date(), syncedAt: null })
      .where(and(eq(schema.bookTags.bookId, book.id), eq(schema.bookTags.name, tag)))
  }

  async updateAuthors(book: Book, authors: string[]): Promise<void> {
    const existingAuthors = book.authors.map((bookAuthor) => bookAuthor.name)
    for (const authorToRemove of _.difference(existingAuthors, authors)) {
      await this.removeAuthor(book, authorToRemove)
    }
    for (const authorToAdd of _.difference(authors, existingAuthors)) {
      await this.addAuthor(book, authorToAdd)
    }
    await this.reload()
  }

  private async addAuthor(book: Book, authorName: string): Promise<void> {
    await this.db
      .insert(schema.bookAuthors)
      .values({ bookId: book.id, name: authorName })
      .onConflictDoUpdate({
        target: [schema.bookAuthors.bookId, schema.bookAuthors.name],
        set: { deletedAt: null, updatedAt: new Date(), syncedAt: null },
      })
  }

  private async removeAuthor(book: Book, author: string): Promise<void> {
    await this.db
      .update(schema.bookAuthors)
      .set({ deletedAt: new Date(), updatedAt: new Date(), syncedAt: null })
      .where(and(eq(schema.bookAuthors.bookId, book.id), eq(schema.bookAuthors.name, author)))
  }

  async updateSeries(book: Book, entries: ParsedSeries[]): Promise<void> {
    const incoming = entries.map((entry) => entry.name)
    for (const nameToRemove of _.difference(
      book.series.map((s) => s.name),
      incoming
    )) {
      await this.removeSeries(book, nameToRemove)
    }
    for (const entry of entries) {
      const current = book.series.find((s) => s.name === entry.name && !s.deletedAt)
      if (current && current.label === entry.label && current.sortKey === entry.sortKey) continue
      await this.upsertSeries(book, entry)
    }
    await this.reload()
  }

  private async upsertSeries(book: Book, entry: ParsedSeries): Promise<void> {
    await this.db
      .insert(schema.bookSeries)
      .values({ bookId: book.id, name: entry.name, label: entry.label, sortKey: entry.sortKey })
      .onConflictDoUpdate({
        target: [schema.bookSeries.bookId, schema.bookSeries.name],
        set: {
          label: entry.label,
          sortKey: entry.sortKey,
          deletedAt: null,
          updatedAt: new Date(),
          syncedAt: null,
        },
      })
  }

  private async removeSeries(book: Book, name: string): Promise<void> {
    await this.db
      .update(schema.bookSeries)
      .set({ deletedAt: new Date(), updatedAt: new Date(), syncedAt: null })
      .where(and(eq(schema.bookSeries.bookId, book.id), eq(schema.bookSeries.name, name)))
  }

  async remove(id: string): Promise<void> {
    const now = new Date()
    await this.db
      .update(schema.books)
      .set({ deletedAt: now, updatedAt: now, syncedAt: null })
      .where(eq(schema.books.id, id))
    await this.db
      .update(schema.bookTags)
      .set({ deletedAt: now, updatedAt: now, syncedAt: null })
      .where(and(eq(schema.bookTags.bookId, id), isNull(schema.bookTags.deletedAt)))
    await this.db
      .update(schema.bookAuthors)
      .set({ deletedAt: now, updatedAt: now, syncedAt: null })
      .where(and(eq(schema.bookAuthors.bookId, id), isNull(schema.bookAuthors.deletedAt)))
    await this.db
      .update(schema.bookSeries)
      .set({ deletedAt: now, updatedAt: now, syncedAt: null })
      .where(and(eq(schema.bookSeries.bookId, id), isNull(schema.bookSeries.deletedAt)))
    await this.reload()
  }

  async reset(): Promise<void> {
    await this.db.delete(schema.books)
    await this.reload()
  }

  async reload(): Promise<BooksStore> {
    this.#value = await this.db.query.books.findMany({
      where: isNull(schema.books.deletedAt),
      with: {
        tags: { where: isNull(schema.bookTags.deletedAt) },
        authors: { where: isNull(schema.bookAuthors.deletedAt) },
        series: { where: isNull(schema.bookSeries.deletedAt) },
      },
    })
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
