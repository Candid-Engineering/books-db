import type { components, paths } from 'open-library-api'
import createClient from 'openapi-fetch'
import { type NewBook } from './types/book.js'
import { parseSeries, type ParsedSeries } from './series.js'
import { reportError } from './error-reporting.js'

export type OpenLibraryBookData = {
  book: NewBook
  tags: string[]
  authors: string[]
  series: ParsedSeries[]
}

const fetchWithTimeout = async (request: Request | string, timeout = 3000): Promise<Response> => {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => {
    controller.abort()
  }, timeout)

  return await fetch(request, { signal: controller.signal })
    .then((response) => {
      clearTimeout(timeoutId)
      return response
    })
    .catch((error: Error) => {
      clearTimeout(timeoutId)
      if (error.name === 'AbortError') {
        throw new Error('Fetch request timed out')
      }
      throw error
    })
}

const client = createClient<paths>({
  baseUrl: 'https://openlibrary.org/',
  fetch: (request: Request) => fetchWithTimeout(request),
})

export async function getByISBN(isbn: string): Promise<OpenLibraryBookData> {
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

async function normalizeOpenLibraryBook(
  data: components['schemas']['Edition']
): Promise<OpenLibraryBookData> {
  const id = data.key.split('/').pop()
  const authorIds = await resolveAuthorIds(data)
  return {
    book: {
      isbn10: data.isbn_10?.[0],
      isbn13: data.isbn_13?.[0],
      title: data.title,
      subtitle: data.subtitle,
      pageCount: normalizePages(data.number_of_pages),
      publicationDate: data.publish_date, // 1883 or October 1996 or Apr 15, 2019
      copyrightDate: data.copyright_date, // YYYY-MM-DD
      coverImages: {
        small: `https://covers.openlibrary.org/b/olid/${id}-S.jpg`,
        medium: `https://covers.openlibrary.org/b/olid/${id}-M.jpg`,
        large: `https://covers.openlibrary.org/b/olid/${id}-L.jpg`,
      },
    },
    tags: data.subjects ?? [],
    authors: await Promise.all(authorIds?.map(getAuthorName)),
    series: await resolveSeries(data),
  }
}

// Falls back to the linked work's authors when the edition has none of its own.
async function resolveAuthorIds(data: components['schemas']['Edition']): Promise<string[]> {
  const editionAuthorIds =
    data.authors?.map((v) => v.key.split('/').pop() || '').filter(Boolean) || []
  if (editionAuthorIds.length > 0) return editionAuthorIds

  const work = await fetchLinkedWork(data)
  return (work?.authors ?? []).map((a) => a.author.key.split('/').pop() || '').filter(Boolean)
}

// Open Library carries series in two shapes: legacy free text on the edition
// ("The Lord of the Rings, Part 1"), and a newer structured object on the
// work ({ series: { key }, position }) whose name lives behind another fetch.
// Anything else is reported and treated as "no series" - the user can add it
// by hand. Never throws on a data-shape surprise.
async function resolveSeries(data: components['schemas']['Edition']): Promise<ParsedSeries[]> {
  const entry: unknown =
    data.series?.[0] ??
    ((await fetchLinkedWork(data)) as { series?: unknown[] } | undefined)?.series?.[0]
  if (entry == null) return []

  if (typeof entry === 'string') {
    const parsed = parseSeries(entry)
    return parsed ? [parsed] : []
  }

  if (typeof entry === 'object') {
    const { series, position } = entry as { series?: { key?: string }; position?: unknown }
    const seriesId = series?.key?.split('/').pop()
    const name = seriesId ? await fetchSeriesName(seriesId) : undefined
    if (!name) return []
    const label = typeof position === 'string' && position ? position : null
    const sortKey = label ? Number.parseFloat(label) : NaN
    return [{ name, label, sortKey: Number.isNaN(sortKey) ? null : sortKey }]
  }

  reportError(
    new Error(`unrecognized Open Library series shape: ${JSON.stringify(entry)}`),
    'openLibrary-series'
  )
  return []
}

async function fetchSeriesName(id: string): Promise<string | undefined> {
  const res = await fetchWithTimeout(`https://openlibrary.org/series/${id}.json`)
  if (!res.ok) return undefined
  const body = (await res.json()) as { name?: unknown }
  return typeof body.name === 'string' ? body.name : undefined
}

async function fetchLinkedWork(
  data: components['schemas']['Edition']
): Promise<components['schemas']['Work'] | undefined> {
  const workId = data.works?.[0]?.key.split('/').pop()
  if (!workId) return undefined

  const { data: work, error } = await client.GET('/works/{id}.json', {
    params: { path: { id: workId } },
  })
  if (error) {
    throw new Error('Error handling not implemented yet for Open Library API')
  }
  return work
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
