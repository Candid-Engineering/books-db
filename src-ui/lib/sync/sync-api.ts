import * as schema from '$lib/db/schema'

export type LocalBook = typeof schema.books.$inferSelect
export type LocalBookTag = typeof schema.bookTags.$inferSelect
export type LocalBookAuthor = typeof schema.bookAuthors.$inferSelect
export type LocalBookSeries = typeof schema.bookSeries.$inferSelect

export interface RemoteBook {
  id: string
  isbn10: string | null
  isbn13: string | null
  title: string
  subtitle: string | null
  pageCount: number | null
  publicationDate: string | null
  copyrightDate: string | null
  coverImages: { small?: string; medium?: string; large?: string } | null
  readAt: Date | null
  deletedAt: Date | null
  updatedAt: Date
}

export interface RemoteBookTag {
  bookId: string
  name: string
  deletedAt: Date | null
  updatedAt: Date
}

export interface RemoteBookAuthor {
  bookId: string
  name: string
  deletedAt: Date | null
  updatedAt: Date
}

export interface RemoteBookSeries {
  bookId: string
  name: string
  label: string | null
  sortKey: number | null
  deletedAt: Date | null
  updatedAt: Date
}

export type Rejection =
  | { type: 'books'; id: string }
  | { type: 'book_tags'; bookId: string; name: string }
  | { type: 'book_authors'; bookId: string; name: string }
  | { type: 'book_series'; bookId: string; name: string }

export interface PullCursors {
  books: number
  bookTags: number
  bookAuthors: number
  bookSeries: number
}

export class SyncApiError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SyncApiError'
  }
}

function getApiBaseUrl(): string {
  return import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000'
}

async function request(authToken: string, path: string, init: RequestInit): Promise<unknown> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 10000)

  let response: Response
  try {
    response = await fetch(`${getApiBaseUrl()}${path}`, {
      ...init,
      headers: { ...init.headers, Authorization: `Bearer ${authToken}` },
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timeoutId)
  }

  const body: unknown = await response.json()
  if (!response.ok) {
    throw new SyncApiError(extractErrorMessage(body, response.status))
  }
  return body
}

function extractErrorMessage(body: unknown, status: number): string {
  if (
    typeof body === 'object' &&
    body !== null &&
    Array.isArray((body as { errors?: unknown }).errors)
  ) {
    const [firstError] = (body as { errors: { message: string }[] }).errors
    if (firstError?.message) return firstError.message
  }
  // Body didn't match the shape we know how to parse - surface it verbatim
  // rather than a generic message, so a mismatch is diagnosable from the
  // error alone.
  return `Request failed with status ${status}: ${JSON.stringify(body)}`
}

function bookToWire(book: LocalBook): Record<string, unknown> {
  return {
    id: book.id,
    isbn10: book.isbn10,
    isbn13: book.isbn13,
    title: book.title,
    subtitle: book.subtitle,
    page_count: book.pageCount,
    publication_date: book.publicationDate,
    copyright_date: book.copyrightDate,
    cover_images: book.coverImages,
    read_at: book.readAt,
    discarded_at: book.deletedAt,
  }
}

function bookTagToWire(tag: LocalBookTag): Record<string, unknown> {
  return {
    book_id: tag.bookId,
    name: tag.name,
    discarded_at: tag.deletedAt,
  }
}

function bookAuthorToWire(author: LocalBookAuthor): Record<string, unknown> {
  return {
    book_id: author.bookId,
    name: author.name,
    discarded_at: author.deletedAt,
  }
}

function bookSeriesToWire(series: LocalBookSeries): Record<string, unknown> {
  return {
    book_id: series.bookId,
    name: series.name,
    label: series.label,
    sort_key: series.sortKey,
    discarded_at: series.deletedAt,
  }
}

interface WireBook {
  id: string
  isbn10: string | null
  isbn13: string | null
  title: string
  subtitle: string | null
  page_count: number | null
  publication_date: string | null
  copyright_date: string | null
  cover_images: { small?: string; medium?: string; large?: string } | null
  read_at: string | null
  discarded_at: string | null
  updated_at: string
}

interface WireBookTag {
  book_id: string
  name: string
  discarded_at: string | null
  updated_at: string
}

interface WireBookAuthor {
  book_id: string
  name: string
  discarded_at: string | null
  updated_at: string
}

interface WireBookSeries {
  book_id: string
  name: string
  label: string | null
  sort_key: number | null
  discarded_at: string | null
  updated_at: string
}

function bookFromWire(row: WireBook): RemoteBook {
  return {
    id: row.id,
    isbn10: row.isbn10,
    isbn13: row.isbn13,
    title: row.title,
    subtitle: row.subtitle,
    pageCount: row.page_count,
    publicationDate: row.publication_date,
    copyrightDate: row.copyright_date,
    coverImages: row.cover_images,
    readAt: row.read_at ? new Date(row.read_at) : null,
    deletedAt: row.discarded_at ? new Date(row.discarded_at) : null,
    updatedAt: new Date(row.updated_at),
  }
}

function bookTagFromWire(row: WireBookTag): RemoteBookTag {
  return {
    bookId: row.book_id,
    name: row.name,
    deletedAt: row.discarded_at ? new Date(row.discarded_at) : null,
    updatedAt: new Date(row.updated_at),
  }
}

function bookAuthorFromWire(row: WireBookAuthor): RemoteBookAuthor {
  return {
    bookId: row.book_id,
    name: row.name,
    deletedAt: row.discarded_at ? new Date(row.discarded_at) : null,
    updatedAt: new Date(row.updated_at),
  }
}

function bookSeriesFromWire(row: WireBookSeries): RemoteBookSeries {
  return {
    bookId: row.book_id,
    name: row.name,
    label: row.label,
    sortKey: row.sort_key,
    deletedAt: row.discarded_at ? new Date(row.discarded_at) : null,
    updatedAt: new Date(row.updated_at),
  }
}

function rejectionFromWire(row: {
  type: string
  id?: string
  book_id?: string
  name?: string
}): Rejection {
  if (row.type === 'books') {
    return { type: 'books', id: row.id as string }
  }
  if (row.type === 'book_authors') {
    return { type: 'book_authors', bookId: row.book_id as string, name: row.name as string }
  }
  if (row.type === 'book_series') {
    return { type: 'book_series', bookId: row.book_id as string, name: row.name as string }
  }
  return { type: 'book_tags', bookId: row.book_id as string, name: row.name as string }
}

export async function pushEntities(
  authToken: string,
  entities: {
    books: LocalBook[]
    bookTags: LocalBookTag[]
    bookAuthors: LocalBookAuthor[]
    bookSeries: LocalBookSeries[]
  }
): Promise<{ rejected: Rejection[] }> {
  const body = await request(authToken, '/sync/push', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      entities: {
        books: entities.books.map(bookToWire),
        book_tags: entities.bookTags.map(bookTagToWire),
        book_authors: entities.bookAuthors.map(bookAuthorToWire),
        book_series: entities.bookSeries.map(bookSeriesToWire),
      },
    }),
  })

  const { rejected } = body as {
    rejected: { type: string; id?: string; book_id?: string; name?: string }[]
  }
  return { rejected: rejected.map(rejectionFromWire) }
}

export async function pullEntities(
  authToken: string,
  since: PullCursors
): Promise<{
  entities: {
    books: RemoteBook[]
    bookTags: RemoteBookTag[]
    bookAuthors: RemoteBookAuthor[]
    bookSeries: RemoteBookSeries[]
  }
  cursors: PullCursors
}> {
  const query = new URLSearchParams()
  query.set('since[books]', String(since.books))
  query.set('since[book_tags]', String(since.bookTags))
  query.set('since[book_authors]', String(since.bookAuthors))
  query.set('since[book_series]', String(since.bookSeries))

  const body = await request(authToken, `/sync/pull?${query.toString()}`, { method: 'GET' })
  const { entities, cursors } = body as {
    entities: {
      books: WireBook[]
      book_tags: WireBookTag[]
      book_authors: WireBookAuthor[]
      book_series: WireBookSeries[]
    }
    cursors: { books: number; book_tags: number; book_authors: number; book_series: number }
  }

  return {
    entities: {
      books: entities.books.map(bookFromWire),
      bookTags: entities.book_tags.map(bookTagFromWire),
      bookAuthors: entities.book_authors.map(bookAuthorFromWire),
      bookSeries: entities.book_series.map(bookSeriesFromWire),
    },
    cursors: {
      books: cursors.books,
      bookTags: cursors.book_tags,
      bookAuthors: cursors.book_authors,
      bookSeries: cursors.book_series,
    },
  }
}
