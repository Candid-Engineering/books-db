import { describe, it, expect } from 'vitest'
import Papa from 'papaparse'
import { booksToCsv } from './csv-export'
import type { Book, BookAuthor, BookSeries } from '$lib/types/book'

function bookAuthor(name: string): BookAuthor {
  return { bookId: 'book-1', name, updatedAt: null, deletedAt: null, syncedAt: null }
}

function bookSeries(name: string, label: string | null = null): BookSeries {
  return {
    bookId: 'book-1',
    name,
    label,
    sortKey: label ? Number.parseFloat(label) : null,
    updatedAt: null,
    deletedAt: null,
    syncedAt: null,
  }
}

function book(overrides: Partial<Book> = {}): Book {
  return {
    id: 'book-1',
    isbn10: null,
    isbn13: null,
    title: 'Dune',
    subtitle: null,
    authors: [bookAuthor('Frank Herbert')],
    series: [],
    pageCount: null,
    publicationDate: null,
    copyrightDate: null,
    coverImages: null,
    readAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: null,
    deletedAt: null,
    syncedAt: null,
    tags: [],
    ...overrides,
  }
}

function parseRows(csv: string): Record<string, string>[] {
  return Papa.parse(csv, { header: true }).data as Record<string, string>[]
}

describe('booksToCsv', () => {
  it('produces the expected header', () => {
    const csv = booksToCsv([])
    const [headerLine] = csv.trim().split('\n')
    expect(headerLine).toBe(
      'title,subtitle,authors,isbn10,isbn13,series,pageCount,publicationDate,copyrightDate'
    )
  })

  it('writes a full row', () => {
    const csv = booksToCsv([
      book({
        title: 'Dune',
        subtitle: 'Dune Chronicles, Book 1',
        authors: [bookAuthor('Frank Herbert')],
        isbn10: '0441172717',
        isbn13: '9780441172719',
        series: [bookSeries('Dune', '1')],
        pageCount: 412,
        publicationDate: 'August 1965',
        copyrightDate: '1965',
      }),
    ])

    const [row] = parseRows(csv)
    expect(row).toEqual({
      title: 'Dune',
      subtitle: 'Dune Chronicles, Book 1',
      authors: 'Frank Herbert',
      isbn10: '0441172717',
      isbn13: '9780441172719',
      series: 'Dune #1',
      pageCount: '412',
      publicationDate: 'August 1965',
      copyrightDate: '1965',
    })
  })

  it('joins multiple authors with a semicolon', () => {
    const csv = booksToCsv([
      book({ authors: [bookAuthor('Frank Herbert'), bookAuthor('Bill Herbert')] }),
    ])
    const [row] = parseRows(csv)
    expect(row.authors).toBe('Frank Herbert; Bill Herbert')
  })

  it('joins multiple series memberships with a semicolon', () => {
    const csv = booksToCsv([
      book({ series: [bookSeries('Dune', '1'), bookSeries('Hugo Award Winners')] }),
    ])
    const [row] = parseRows(csv)
    expect(row.series).toBe('Dune #1; Hugo Award Winners')
  })

  it('writes null fields as empty cells', () => {
    const csv = booksToCsv([book({ subtitle: null, isbn10: null, pageCount: null })])
    const [row] = parseRows(csv)
    expect(row.subtitle).toBe('')
    expect(row.isbn10).toBe('')
    expect(row.pageCount).toBe('')
  })

  it('preserves a leading zero in an ISBN', () => {
    const csv = booksToCsv([book({ isbn10: '0441172717' })])
    const [row] = parseRows(csv)
    expect(row.isbn10).toBe('0441172717')
  })

  it('correctly quotes a title containing a comma', () => {
    const csv = booksToCsv([book({ title: 'Foundation, Book 1' })])
    const [row] = parseRows(csv)
    expect(row.title).toBe('Foundation, Book 1')
  })

  it('writes multiple rows in order', () => {
    const csv = booksToCsv([book({ title: 'Dune' }), book({ title: 'Dune Messiah' })])
    const rows = parseRows(csv)
    expect(rows.map((r) => r.title)).toEqual(['Dune', 'Dune Messiah'])
  })
})
