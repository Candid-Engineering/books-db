import type { SqliteRemoteDatabase } from 'drizzle-orm/sqlite-proxy'
import { and, eq, isNull } from 'drizzle-orm/sql/expressions/conditions'
import * as schema from '$lib/db/schema'
import type { BooksStore } from '$lib/state/Books.svelte'
import { pushEntities, pullEntities } from './sync-api'

export async function hasUnsyncedData(db: SqliteRemoteDatabase<typeof schema>): Promise<boolean> {
  const [pendingBook] = await db
    .select()
    .from(schema.books)
    .where(isNull(schema.books.syncedAt))
    .limit(1)
  if (pendingBook) return true

  const [pendingTag] = await db
    .select()
    .from(schema.bookTags)
    .where(isNull(schema.bookTags.syncedAt))
    .limit(1)
  if (pendingTag) return true

  const [pendingAuthor] = await db
    .select()
    .from(schema.bookAuthors)
    .where(isNull(schema.bookAuthors.syncedAt))
    .limit(1)
  if (pendingAuthor) return true

  const [pendingSeries] = await db
    .select()
    .from(schema.bookSeries)
    .where(isNull(schema.bookSeries.syncedAt))
    .limit(1)
  return !!pendingSeries
}

export class SyncEngine {
  constructor(
    private db: SqliteRemoteDatabase<typeof schema>,
    private booksStore: BooksStore,
    private getAuthToken: () => Promise<string | null>
  ) {}

  async push(knownAuthToken?: string): Promise<void> {
    const authToken = knownAuthToken ?? (await this.getAuthToken())
    if (!authToken) return

    const pendingBooks = await this.db
      .select()
      .from(schema.books)
      .where(isNull(schema.books.syncedAt))
    const pendingTags = await this.db
      .select()
      .from(schema.bookTags)
      .where(isNull(schema.bookTags.syncedAt))
    const pendingAuthors = await this.db
      .select()
      .from(schema.bookAuthors)
      .where(isNull(schema.bookAuthors.syncedAt))
    const pendingSeries = await this.db
      .select()
      .from(schema.bookSeries)
      .where(isNull(schema.bookSeries.syncedAt))

    if (
      pendingBooks.length === 0 &&
      pendingTags.length === 0 &&
      pendingAuthors.length === 0 &&
      pendingSeries.length === 0
    )
      return

    const { rejected } = await pushEntities(authToken, {
      books: pendingBooks,
      bookTags: pendingTags,
      bookAuthors: pendingAuthors,
      bookSeries: pendingSeries,
    })

    const rejectedBookIds = new Set(rejected.filter((r) => r.type === 'books').map((r) => r.id))
    const rejectedTagKeys = new Set(
      rejected.filter((r) => r.type === 'book_tags').map((r) => `${r.bookId}:${r.name}`)
    )
    const rejectedAuthorKeys = new Set(
      rejected.filter((r) => r.type === 'book_authors').map((r) => `${r.bookId}:${r.name}`)
    )
    const rejectedSeriesKeys = new Set(
      rejected.filter((r) => r.type === 'book_series').map((r) => `${r.bookId}:${r.name}`)
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

    for (const author of pendingAuthors) {
      if (rejectedAuthorKeys.has(`${author.bookId}:${author.name}`)) continue
      await this.db
        .update(schema.bookAuthors)
        .set({ syncedAt })
        .where(
          and(
            eq(schema.bookAuthors.bookId, author.bookId),
            eq(schema.bookAuthors.name, author.name)
          )
        )
    }

    for (const series of pendingSeries) {
      if (rejectedSeriesKeys.has(`${series.bookId}:${series.name}`)) continue
      await this.db
        .update(schema.bookSeries)
        .set({ syncedAt })
        .where(
          and(eq(schema.bookSeries.bookId, series.bookId), eq(schema.bookSeries.name, series.name))
        )
    }
  }

  async pull(knownAuthToken?: string): Promise<void> {
    const authToken = knownAuthToken ?? (await this.getAuthToken())
    if (!authToken) return

    const [state] = await this.db.select().from(schema.syncState)
    const since = {
      books: state?.booksSince ?? 0,
      bookTags: state?.bookTagsSince ?? 0,
      bookAuthors: state?.bookAuthorsSince ?? 0,
      bookSeries: state?.bookSeriesSince ?? 0,
    }

    const { entities, cursors } = await pullEntities(authToken, since)

    const syncedAt = new Date()

    for (const book of entities.books) {
      await this.db
        .insert(schema.books)
        .values({ ...book, syncedAt })
        .onConflictDoUpdate({ target: schema.books.id, set: { ...book, syncedAt } })
    }

    for (const tag of entities.bookTags) {
      await this.db
        .insert(schema.bookTags)
        .values({ ...tag, syncedAt })
        .onConflictDoUpdate({
          target: [schema.bookTags.bookId, schema.bookTags.name],
          set: { ...tag, syncedAt },
        })
    }

    for (const author of entities.bookAuthors) {
      await this.db
        .insert(schema.bookAuthors)
        .values({ ...author, syncedAt })
        .onConflictDoUpdate({
          target: [schema.bookAuthors.bookId, schema.bookAuthors.name],
          set: { ...author, syncedAt },
        })
    }

    for (const series of entities.bookSeries) {
      await this.db
        .insert(schema.bookSeries)
        .values({ ...series, syncedAt })
        .onConflictDoUpdate({
          target: [schema.bookSeries.bookId, schema.bookSeries.name],
          set: { ...series, syncedAt },
        })
    }

    await this.db
      .insert(schema.syncState)
      .values({
        singleton: 1,
        booksSince: cursors.books,
        bookTagsSince: cursors.bookTags,
        bookAuthorsSince: cursors.bookAuthors,
        bookSeriesSince: cursors.bookSeries,
      })
      .onConflictDoUpdate({
        target: schema.syncState.singleton,
        set: {
          booksSince: cursors.books,
          bookTagsSince: cursors.bookTags,
          bookAuthorsSince: cursors.bookAuthors,
          bookSeriesSince: cursors.bookSeries,
        },
      })

    await this.booksStore.reload()
  }

  async sync(): Promise<void> {
    const authToken = await this.getAuthToken()
    if (!authToken) return
    await this.push(authToken)
    await this.pull(authToken)
  }
}
