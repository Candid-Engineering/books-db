import { describe, it, expect } from 'vitest'
import type { Book } from '$lib/types/book.js'
import { groupByEdition, converges, namesOf, readState } from './duplicates'

let n = 0
const makeBook = (over: Partial<Book> = {}): Book => ({
  id: `id-${++n}`,
  isbn10: null,
  isbn13: null,
  title: 'Untitled',
  subtitle: null,
  pageCount: null,
  publicationDate: null,
  copyrightDate: null,
  coverImages: null,
  readAt: null,
  createdAt: new Date('2026-01-01'),
  updatedAt: null,
  deletedAt: null,
  syncedAt: null,
  tags: [],
  authors: [],
  series: [],
  ...over,
})

describe('groupByEdition', () => {
  it('groups copies that share an ISBN-13', () => {
    const groups = groupByEdition([
      makeBook({ isbn13: '9780441172719', title: 'Dune' }),
      makeBook({ isbn13: '9780441172719', title: 'Dune' }),
      makeBook({ isbn13: '9780553293357', title: 'Foundation' }),
    ])

    expect(groups.map((g) => g.length)).toEqual([2, 1])
  })

  it('falls back to ISBN-10, then to the row id', () => {
    const groups = groupByEdition([
      makeBook({ isbn10: '0441172717' }),
      makeBook({ isbn10: '0441172717' }),
      makeBook({}), // no ISBN at all -> its own group
    ])

    expect(groups.map((g) => g.length)).toEqual([2, 1])
  })

  it('prefers ISBN-13 over ISBN-10 as the key', () => {
    const groups = groupByEdition([
      makeBook({ isbn13: 'same-13', isbn10: 'a' }),
      makeBook({ isbn13: 'same-13', isbn10: 'b' }),
    ])

    expect(groups).toHaveLength(1)
  })

  it('treats a blank ISBN as absent', () => {
    const groups = groupByEdition([makeBook({ isbn13: '  ' }), makeBook({ isbn13: '' })])

    expect(groups).toHaveLength(2)
  })

  it('orders each group oldest copy first', () => {
    const groups = groupByEdition([
      makeBook({ isbn13: 'x', title: 'newer', createdAt: new Date('2026-03-01') }),
      makeBook({ isbn13: 'x', title: 'older', createdAt: new Date('2026-01-01') }),
    ])

    expect(groups[0].map((b) => b.title)).toEqual(['older', 'newer'])
  })

  it('keeps groups in first-seen order', () => {
    const groups = groupByEdition([
      makeBook({ isbn13: 'b', title: 'B' }),
      makeBook({ isbn13: 'a', title: 'A' }),
      makeBook({ isbn13: 'b', title: 'B' }),
    ])

    expect(groups.map((g) => g[0].title)).toEqual(['B', 'A'])
  })
})

describe('converges', () => {
  it('is true for a single copy', () => {
    expect(converges([makeBook({ title: 'Dune' })], (b) => b.title)).toBe(true)
  })

  it('is true when every copy agrees', () => {
    const books = [makeBook({ title: 'Dune' }), makeBook({ title: 'Dune' })]
    expect(converges(books, (b) => b.title)).toBe(true)
  })

  it('is false when a copy differs', () => {
    const books = [makeBook({ title: 'Dune' }), makeBook({ title: 'Dune (Movie Tie-In)' })]
    expect(converges(books, (b) => b.title)).toBe(false)
  })

  it('compares child collections by name, order-insensitively', () => {
    const a = makeBook({ tags: [{ bookId: 'a', name: 'sci-fi' } as Book['tags'][number]] })
    const b = makeBook({ tags: [{ bookId: 'b', name: 'sci-fi' } as Book['tags'][number]] })
    expect(converges([a, b], (book) => namesOf(book.tags))).toBe(true)
  })
})

describe('readState', () => {
  const read = () => makeBook({ readAt: new Date() })
  const unread = () => makeBook()

  it('is "all" when every copy is read', () => {
    expect(readState([read(), read()])).toBe('all')
  })

  it('is "none" when no copy is read', () => {
    expect(readState([unread(), unread()])).toBe('none')
  })

  it('is "some" when copies are mixed', () => {
    expect(readState([read(), unread()])).toBe('some')
  })
})
