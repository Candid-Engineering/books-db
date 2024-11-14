import type { components, paths } from 'open-library-api'
import createClient from 'openapi-fetch'
import { type NewBook } from './types/book.js'

const client = createClient<paths>({
  baseUrl: 'https://openlibrary.org/',
  fetch: (request: Request) => fetch(request, { signal: AbortSignal.timeout(3000) }),
})

export async function getByISBN(isbn: string): Promise<NewBook> {
  const { data, error } = await client.GET('/isbn/{isbn}.json', {
    params: { path: { isbn } },
  })
  if (error) {
    throw new Error('Error handling not implemented yet for Open Library API')
  }
  if (!data) {
    throw new Error('expected book data from open library API')
  }
  return await normalizeOpenLibraryBook(data)
}

async function normalizeOpenLibraryBook(data: components['schemas']['Edition']): Promise<NewBook> {
  const id = data.key.split('/').pop()
  const authorIds = data.authors?.map((v) => v.key.split('/').pop() || '').filter(Boolean) || []
  return {
    isbn10: data.isbn_10?.[0],
    isbn13: data.isbn_13?.[0],
    title: data.title,
    subtitle: data.subtitle,
    authors: await Promise.all(authorIds?.map(getAuthorName)),
    tags: data.subjects ?? [],
    series: data.series?.[0],
    pageCount: normalizePages(data.number_of_pages),
    publicationDate: data.publish_date, // 1883 or October 1996 or Apr 15, 2019
    copyrightDate: data.copyright_date, // YYYY-MM-DD
    coverImages: {
      small: `https://covers.openlibrary.org/b/olid/${id}-S.jpg`,
      medium: `https://covers.openlibrary.org/b/olid/${id}-M.jpg`,
      large: `https://covers.openlibrary.org/b/olid/${id}-L.jpg`,
    },
  }
}

function normalizePages(originalCount: number | undefined): number | undefined {
  // `0` or `1` are sometimes used as placeholders for unknown page counts.
  if (!originalCount || originalCount <= 1) return undefined
  return originalCount
}

async function getAuthorName(id: string): Promise<string> {
  const { data, error } = await client.GET('/authors/{id}.json', { params: { path: { id: id } } })
  if (error) {
    throw new Error('Error handling not implemented yet for Open Library API')
  }
  return data.name
}
