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

function wireBook(overrides: Record<string, unknown> = {}) {
  return {
    id: 'book-1',
    isbn10: null,
    isbn13: null,
    title: 'Dune',
    subtitle: null,
    authors: [ 'Frank Herbert' ],
    series: null,
    page_count: null,
    publication_date: null,
    copyright_date: null,
    cover_images: null,
    read_at: null,
    discarded_at: null,
    updated_at: '2026-01-02T00:00:00.000Z',
    server_seq: 1,
    ...overrides,
  }
}

describe('SyncEngine#pull', () => {
  it('applies pulled books into the local db, marked as already synced', async () => {
    mockServer.use(
      http.get(`${BASE_URL}/sync/pull`, () =>
        HttpResponse.json({
          entities: { books: [ wireBook() ], book_tags: [] },
          cursors: { books: 1, book_tags: 0 },
        })
      )
    )

    await createSyncEngine().pull()

    const [ book ] = await testDb.drizzle.select().from(schema.books).where(eq(schema.books.id, 'book-1'))
    expect(book).toBeDefined()
    expect(book.title).toBe('Dune')
    expect(book.syncedAt).not.toBeNull()
  })

  it('applies pulled tags into the local db, marked as already synced', async () => {
    await testDb.drizzle.insert(schema.books).values({ id: 'book-1', title: 'Dune', authors: [ 'Frank Herbert' ] })
    mockServer.use(
      http.get(`${BASE_URL}/sync/pull`, () =>
        HttpResponse.json({
          entities: {
            books: [],
            book_tags: [
              { book_id: 'book-1', name: 'Science Fiction', discarded_at: null, updated_at: '2026-01-02T00:00:00.000Z', server_seq: 1 },
            ],
          },
          cursors: { books: 0, book_tags: 1 },
        })
      )
    )

    await createSyncEngine().pull()

    const [ tag ] = await testDb.drizzle
      .select()
      .from(schema.bookTags)
      .where(and(eq(schema.bookTags.bookId, 'book-1'), eq(schema.bookTags.name, 'Science Fiction')))
    expect(tag).toBeDefined()
    expect(tag.syncedAt).not.toBeNull()
  })

  it('stores a tombstoned pulled row as deleted', async () => {
    mockServer.use(
      http.get(`${BASE_URL}/sync/pull`, () =>
        HttpResponse.json({
          entities: { books: [ wireBook({ discarded_at: '2026-01-03T00:00:00.000Z' }) ], book_tags: [] },
          cursors: { books: 1, book_tags: 0 },
        })
      )
    )

    await createSyncEngine().pull()

    const [ book ] = await testDb.drizzle.select().from(schema.books).where(eq(schema.books.id, 'book-1'))
    expect(book.deletedAt).not.toBeNull()
  })

  it('advances the stored cursor and sends it on the next pull', async () => {
    let secondRequestQuery: URLSearchParams | undefined
    let callCount = 0
    mockServer.use(
      http.get(`${BASE_URL}/sync/pull`, ({ request }) => {
        callCount += 1
        if (callCount === 1) {
          return HttpResponse.json({
            entities: { books: [ wireBook({ server_seq: 7 }) ], book_tags: [] },
            cursors: { books: 7, book_tags: 0 },
          })
        }
        secondRequestQuery = new URL(request.url).searchParams
        return HttpResponse.json({ entities: { books: [], book_tags: [] }, cursors: { books: 7, book_tags: 0 } })
      })
    )

    const engine = createSyncEngine()
    await engine.pull()
    await engine.pull()

    expect(secondRequestQuery?.get('since[books]')).toBe('7')
  })

  it('is idempotent: pulling the same row twice does not duplicate it', async () => {
    mockServer.use(
      http.get(`${BASE_URL}/sync/pull`, () =>
        HttpResponse.json({
          entities: { books: [ wireBook() ], book_tags: [] },
          cursors: { books: 1, book_tags: 0 },
        })
      )
    )

    const engine = createSyncEngine()
    await engine.pull()
    await engine.pull()

    const rows = await testDb.drizzle.select().from(schema.books).where(eq(schema.books.id, 'book-1'))
    expect(rows).toHaveLength(1)
  })

  it("reloads the books store so reactive UI picks up the change", async () => {
    mockServer.use(
      http.get(`${BASE_URL}/sync/pull`, () =>
        HttpResponse.json({
          entities: { books: [ wireBook() ], book_tags: [] },
          cursors: { books: 1, book_tags: 0 },
        })
      )
    )
    const booksStore = createTestBooksStore(testDb.drizzle)
    const engine = new SyncEngine(testDb.drizzle, booksStore, () => Promise.resolve(AUTH_TOKEN))

    await engine.pull()

    expect(booksStore.value.map((b) => b.id)).toContain('book-1')
  })

  it('does nothing when there is no auth token', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch')

    await createSyncEngine(() => Promise.resolve(null)).pull()

    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
