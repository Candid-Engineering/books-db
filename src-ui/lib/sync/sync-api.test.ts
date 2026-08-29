import { describe, it, expect, afterEach, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { mockServer } from '../../testing/msw-setup'
import {
  SyncApiError,
  pushEntities,
  pullEntities,
  type LocalBook,
  type LocalBookTag,
  type LocalBookAuthor,
} from './sync-api'

const BASE_URL = 'http://localhost:3000'
const AUTH_TOKEN = 'auth-token-xyz'

afterEach(() => {
  vi.unstubAllEnvs()
})

function localBook(overrides: Partial<LocalBook> = {}): LocalBook {
  return {
    id: 'book-1',
    isbn10: null,
    isbn13: '9780441172719',
    title: 'Dune',
    subtitle: null,
    series: null,
    pageCount: null,
    publicationDate: null,
    copyrightDate: null,
    coverImages: null,
    readAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    deletedAt: null,
    syncedAt: null,
    ...overrides,
  }
}

function localBookTag(overrides: Partial<LocalBookTag> = {}): LocalBookTag {
  return {
    bookId: 'book-1',
    name: 'Science Fiction',
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    deletedAt: null,
    syncedAt: null,
    ...overrides,
  }
}

function localBookAuthor(overrides: Partial<LocalBookAuthor> = {}): LocalBookAuthor {
  return {
    bookId: 'book-1',
    name: 'Frank Herbert',
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    deletedAt: null,
    syncedAt: null,
    ...overrides,
  }
}

describe('pushEntities', () => {
  it('sends the wire-shaped, snake_case request body with the auth header', async () => {
    mockServer.use(
      http.post(`${BASE_URL}/sync/push`, async ({ request }) => {
        expect(request.headers.get('Authorization')).toBe(`Bearer ${AUTH_TOKEN}`)
        expect(await request.json()).toEqual({
          entities: {
            books: [
              {
                id: 'book-1',
                isbn10: null,
                isbn13: '9780441172719',
                title: 'Dune',
                subtitle: null,
                series: null,
                page_count: null,
                publication_date: null,
                copyright_date: null,
                cover_images: null,
                read_at: null,
                discarded_at: null,
              },
            ],
            book_tags: [{ book_id: 'book-1', name: 'Science Fiction', discarded_at: null }],
            book_authors: [{ book_id: 'book-1', name: 'Frank Herbert', discarded_at: null }],
          },
        })
        return HttpResponse.json({ rejected: [] }, { status: 200 })
      })
    )

    await expect(
      pushEntities(AUTH_TOKEN, {
        books: [localBook()],
        bookTags: [localBookTag()],
        bookAuthors: [localBookAuthor()],
      })
    ).resolves.toEqual({ rejected: [] })
  })

  it('maps a rejected response to camelCase', async () => {
    mockServer.use(
      http.post(`${BASE_URL}/sync/push`, () => {
        return HttpResponse.json(
          {
            rejected: [
              { type: 'books', id: 'book-1' },
              { type: 'book_tags', book_id: 'book-1', name: 'Mystery' },
              { type: 'book_authors', book_id: 'book-1', name: 'Someone Else' },
            ],
          },
          { status: 200 }
        )
      })
    )

    await expect(
      pushEntities(AUTH_TOKEN, { books: [], bookTags: [], bookAuthors: [] })
    ).resolves.toEqual({
      rejected: [
        { type: 'books', id: 'book-1' },
        { type: 'book_tags', bookId: 'book-1', name: 'Mystery' },
        { type: 'book_authors', bookId: 'book-1', name: 'Someone Else' },
      ],
    })
  })

  it('throws SyncApiError with the message from the errors array on failure', async () => {
    mockServer.use(
      http.post(`${BASE_URL}/sync/push`, () => {
        return HttpResponse.json(
          { errors: [{ code: 'token_expired', message: 'Token has expired' }] },
          { status: 401 }
        )
      })
    )

    const error = await pushEntities(AUTH_TOKEN, {
      books: [],
      bookTags: [],
      bookAuthors: [],
    }).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(SyncApiError)
    expect(error).toMatchObject({ message: 'Token has expired' })
  })
})

describe('pullEntities', () => {
  it('sends the cursor as a bracketed query string with the auth header', async () => {
    mockServer.use(
      http.get(`${BASE_URL}/sync/pull`, ({ request }) => {
        const url = new URL(request.url)
        expect(url.searchParams.get('since[books]')).toBe('5')
        expect(url.searchParams.get('since[book_tags]')).toBe('3')
        expect(url.searchParams.get('since[book_authors]')).toBe('2')
        expect(request.headers.get('Authorization')).toBe(`Bearer ${AUTH_TOKEN}`)
        return HttpResponse.json({
          entities: { books: [], book_tags: [], book_authors: [] },
          cursors: { books: 5, book_tags: 3, book_authors: 2 },
        })
      })
    )

    await pullEntities(AUTH_TOKEN, { books: 5, bookTags: 3, bookAuthors: 2 })
  })

  it('maps the wire response to camelCase local rows', async () => {
    mockServer.use(
      http.get(`${BASE_URL}/sync/pull`, () => {
        return HttpResponse.json({
          entities: {
            books: [
              {
                id: 'book-1',
                isbn10: null,
                isbn13: '9780441172719',
                title: 'Dune',
                subtitle: null,
                series: null,
                page_count: 412,
                publication_date: 'August 1965',
                copyright_date: null,
                cover_images: null,
                read_at: null,
                discarded_at: null,
                updated_at: '2026-01-02T00:00:00.000Z',
                server_seq: 5,
              },
            ],
            book_tags: [
              {
                book_id: 'book-1',
                name: 'Science Fiction',
                discarded_at: '2026-01-03T00:00:00.000Z',
                updated_at: '2026-01-03T00:00:00.000Z',
                server_seq: 3,
              },
            ],
            book_authors: [
              {
                book_id: 'book-1',
                name: 'Frank Herbert',
                discarded_at: null,
                updated_at: '2026-01-04T00:00:00.000Z',
                server_seq: 2,
              },
            ],
          },
          cursors: { books: 5, book_tags: 3, book_authors: 2 },
        })
      })
    )

    const result = await pullEntities(AUTH_TOKEN, { books: 0, bookTags: 0, bookAuthors: 0 })

    expect(result).toEqual({
      entities: {
        books: [
          {
            id: 'book-1',
            isbn10: null,
            isbn13: '9780441172719',
            title: 'Dune',
            subtitle: null,
            series: null,
            pageCount: 412,
            publicationDate: 'August 1965',
            copyrightDate: null,
            coverImages: null,
            readAt: null,
            deletedAt: null,
            updatedAt: new Date('2026-01-02T00:00:00.000Z'),
          },
        ],
        bookTags: [
          {
            bookId: 'book-1',
            name: 'Science Fiction',
            deletedAt: new Date('2026-01-03T00:00:00.000Z'),
            updatedAt: new Date('2026-01-03T00:00:00.000Z'),
          },
        ],
        bookAuthors: [
          {
            bookId: 'book-1',
            name: 'Frank Herbert',
            deletedAt: null,
            updatedAt: new Date('2026-01-04T00:00:00.000Z'),
          },
        ],
      },
      cursors: { books: 5, bookTags: 3, bookAuthors: 2 },
    })
  })
})

describe('base URL configuration', () => {
  it('should use VITE_API_BASE_URL when set', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.com')
    mockServer.use(
      http.get('https://api.example.com/sync/pull', () => {
        return HttpResponse.json({
          entities: { books: [], book_tags: [], book_authors: [] },
          cursors: { books: 0, book_tags: 0, book_authors: 0 },
        })
      })
    )

    await expect(
      pullEntities(AUTH_TOKEN, { books: 0, bookTags: 0, bookAuthors: 0 })
    ).resolves.toEqual({
      entities: { books: [], bookTags: [], bookAuthors: [] },
      cursors: { books: 0, bookTags: 0, bookAuthors: 0 },
    })
  })
})
