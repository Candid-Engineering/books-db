import type { SqliteRemoteDatabase } from 'drizzle-orm/sqlite-proxy'
import { and, eq, isNull } from 'drizzle-orm/sql/expressions/conditions'
import * as schema from '$lib/db/schema'
import type { BooksStore } from '$lib/state/Books.svelte'
import { pushEntities } from './sync-api'

export class SyncEngine {
  constructor(
    private db: SqliteRemoteDatabase<typeof schema>,
    private booksStore: BooksStore,
    private getAuthToken: () => Promise<string | null>
  ) {}

  async push(): Promise<void> {
    const authToken = await this.getAuthToken()
    if (!authToken) return

    const pendingBooks = await this.db.select().from(schema.books).where(isNull(schema.books.syncedAt))
    const pendingTags = await this.db.select().from(schema.bookTags).where(isNull(schema.bookTags.syncedAt))

    if (pendingBooks.length === 0 && pendingTags.length === 0) return

    const { rejected } = await pushEntities(authToken, { books: pendingBooks, bookTags: pendingTags })

    const rejectedBookIds = new Set(rejected.filter((r) => r.type === 'books').map((r) => r.id))
    const rejectedTagKeys = new Set(
      rejected.filter((r) => r.type === 'book_tags').map((r) => `${r.bookId}:${r.name}`)
    )

    const syncedAt = new Date()

    for (const book of pendingBooks) {
      if (rejectedBookIds.has(book.id)) continue
      await this.db.update(schema.books).set({ syncedAt }).where(eq(schema.books.id, book.id))
    }

    for (const tag of pendingTags) {
      if (rejectedTagKeys.has(`${tag.bookId}:${tag.name}`)) continue
      await this.db
        .update(schema.bookTags)
        .set({ syncedAt })
        .where(and(eq(schema.bookTags.bookId, tag.bookId), eq(schema.bookTags.name, tag.name)))
    }
  }
}
