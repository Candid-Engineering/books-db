import { describe, it, expect, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { mockServer } from '../../testing/msw-setup'
import { testDb } from '../../testing/db-setup'
import { createTestBooksStore } from '$lib/state/Books.svelte'
import { SyncEngine } from './sync-engine'
import * as schema from '$lib/db/schema'
import { eq, and } from 'drizzle-orm/sql/expressions/conditions'

const BASE_URL = 'http://localhost:3000'
const AUTH_TOKEN = 'auth-token-xyz'

function createSyncEngine(getAuthToken: () => Promise<string | null> = () => Promise.resolve(AUTH_TOKEN)) {
  const booksStore = createTestBooksStore(testDb.drizzle)
  return new SyncEngine(testDb.drizzle, booksStore, getAuthToken)
}

describe('SyncEngine#push', () => {
  it('sends only rows pending sync (syncedAt IS NULL)', async () => {
    await testDb.drizzle.insert(schema.books).values([
      { id: 'pending-book', title: 'Dune', authors: [ 'Frank Herbert' ] },
      { id: 'synced-book', title: 'Dune Messiah', authors: [ 'Frank Herbert' ], syncedAt: new Date() },
    ])

    let pushedIds: string[] = []
    mockServer.use(
      http.post(`${BASE_URL}/sync/push`, async ({ request }) => {
        const body = (await request.json()) as { entities: { books: { id: string }[] } }
        pushedIds = body.entities.books.map((b) => b.id)
        return HttpResponse.json({ rejected: [] })
      })
    )

    await createSyncEngine().push()

    expect(pushedIds).toEqual([ 'pending-book' ])
  })

  it('marks pushed rows as synced on success', async () => {
    await testDb.drizzle.insert(schema.books).values({ id: 'book-1', title: 'Dune', authors: [ 'Frank Herbert' ] })
    mockServer.use(http.post(`${BASE_URL}/sync/push`, () => HttpResponse.json({ rejected: [] })))

    await createSyncEngine().push()

    const [ book ] = await testDb.drizzle.select().from(schema.books).where(eq(schema.books.id, 'book-1'))
    expect(book.syncedAt).not.toBeNull()
  })

  it('leaves rejected rows pending rather than marking them synced', async () => {
    await testDb.drizzle.insert(schema.books).values([
      { id: 'accepted-book', title: 'Dune', authors: [ 'Frank Herbert' ] },
      { id: 'rejected-book', title: 'Hijacked', authors: [ 'Someone Else' ] },
    ])
    mockServer.use(
      http.post(`${BASE_URL}/sync/push`, () =>
        HttpResponse.json({ rejected: [ { type: 'books', id: 'rejected-book' } ] })
      )
    )

    await createSyncEngine().push()

    const rows = await testDb.drizzle.select().from(schema.books)
    const accepted = rows.find((b) => b.id === 'accepted-book')
    const rejected = rows.find((b) => b.id === 'rejected-book')
    expect(accepted?.syncedAt).not.toBeNull()
    expect(rejected?.syncedAt).toBeNull()
  })

  it('marks pushed tags as synced by (bookId, name), not just books', async () => {
    await testDb.drizzle.insert(schema.books).values({ id: 'book-1', title: 'Dune', authors: [ 'Frank Herbert' ] })
    await testDb.drizzle.insert(schema.bookTags).values([
      { bookId: 'book-1', name: 'Science Fiction' },
      { bookId: 'book-1', name: 'Classic' },
    ])
    mockServer.use(
      http.post(`${BASE_URL}/sync/push`, () =>
        HttpResponse.json({ rejected: [ { type: 'book_tags', book_id: 'book-1', name: 'Classic' } ] })
      )
    )

    await createSyncEngine().push()

    const [ acceptedTag ] = await testDb.drizzle
      .select()
      .from(schema.bookTags)
      .where(and(eq(schema.bookTags.bookId, 'book-1'), eq(schema.bookTags.name, 'Science Fiction')))
    const [ rejectedTag ] = await testDb.drizzle
      .select()
      .from(schema.bookTags)
      .where(and(eq(schema.bookTags.bookId, 'book-1'), eq(schema.bookTags.name, 'Classic')))
    expect(acceptedTag.syncedAt).not.toBeNull()
    expect(rejectedTag.syncedAt).toBeNull()
  })

  it('does nothing when there is no auth token', async () => {
    await testDb.drizzle.insert(schema.books).values({ id: 'book-1', title: 'Dune', authors: [ 'Frank Herbert' ] })
    const fetchSpy = vi.spyOn(global, 'fetch')

    await createSyncEngine(() => Promise.resolve(null)).push()

    expect(fetchSpy).not.toHaveBeenCalled()
    const [ book ] = await testDb.drizzle.select().from(schema.books).where(eq(schema.books.id, 'book-1'))
    expect(book.syncedAt).toBeNull()
  })

  it('does not call the API when nothing is pending', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch')

    await createSyncEngine().push()

    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
