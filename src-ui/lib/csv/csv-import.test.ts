import { describe, it, expect } from 'vitest'
import { csvToBooks } from './csv-import'

const HEADER = 'title,subtitle,authors,isbn10,isbn13,series,pageCount,publicationDate,copyrightDate'

describe('csvToBooks', () => {
  it('parses a valid file into books', () => {
    const csv = [
      HEADER,
      'Dune,Dune Chronicles Book 1,Frank Herbert,0441172717,9780441172719,Dune (1),412,August 1965,1965',
    ].join('\n')

    const result = csvToBooks(csv)

    expect(result).toEqual({
      success: true,
      books: [
        {
          book: {
            title: 'Dune',
            subtitle: 'Dune Chronicles Book 1',
            isbn10: '0441172717',
            isbn13: '9780441172719',
            pageCount: 412,
            publicationDate: 'August 1965',
            copyrightDate: '1965',
          },
          authors: ['Frank Herbert'],
          series: [{ name: 'Dune', label: '1', sortKey: 1 }],
        },
      ],
    })
  })

  it('splits multiple semicolon-joined authors', () => {
    const csv = [HEADER, 'Dune,,Frank Herbert; Bill Herbert,,,,,,'].join('\n')

    const result = csvToBooks(csv)

    expect(result.success).toBe(true)
    expect(result.success && result.books[0].authors).toEqual(['Frank Herbert', 'Bill Herbert'])
  })

  it('splits multiple semicolon-joined series and parses each position', () => {
    const csv = [HEADER, 'Dune,,,,,Dune #1; Hugo Award Winners,,,'].join('\n')

    const result = csvToBooks(csv)

    expect(result.success).toBe(true)
    expect(result.success && result.books[0].series).toEqual([
      { name: 'Dune', label: '1', sortKey: 1 },
      { name: 'Hugo Award Winners', label: null, sortKey: null },
    ])
  })

  it('treats empty authors as valid, defaulting to an empty array', () => {
    const csv = [HEADER, 'Dune,,,,,,,,'].join('\n')

    const result = csvToBooks(csv)

    expect(result.success).toBe(true)
    expect(result.success && result.books[0].authors).toEqual([])
  })

  it('treats empty series as an empty array', () => {
    const csv = [HEADER, 'Dune,,,,,,,,'].join('\n')

    const result = csvToBooks(csv)

    expect(result.success).toBe(true)
    expect(result.success && result.books[0].series).toEqual([])
  })

  it('preserves a leading zero in an ISBN', () => {
    const csv = [HEADER, 'Dune,,,0441172717,,,,,'].join('\n')

    const result = csvToBooks(csv)

    expect(result.success).toBe(true)
    expect(result.success && result.books[0].book.isbn10).toBe('0441172717')
  })

  it('treats empty optional cells as null', () => {
    const csv = [HEADER, 'Dune,,,,,,,,'].join('\n')

    const result = csvToBooks(csv)

    expect(result).toEqual({
      success: true,
      books: [
        {
          book: {
            title: 'Dune',
            subtitle: null,
            isbn10: null,
            isbn13: null,
            pageCount: null,
            publicationDate: null,
            copyrightDate: null,
          },
          authors: [],
          series: [],
        },
      ],
    })
  })

  it('rejects a row missing a title', () => {
    const csv = [HEADER, ',,Frank Herbert,,,,,,'].join('\n')

    const result = csvToBooks(csv)

    expect(result).toEqual({ success: false, errors: ['Row 2: title is required'] })
  })

  it('collects errors from every bad row in one pass, not just the first', () => {
    const csv = [
      HEADER,
      ',,Frank Herbert,,,,,,',
      'Dune Messiah,,Frank Herbert,,,,,,',
      ',,,,,,,,',
    ].join('\n')

    const result = csvToBooks(csv)

    expect(result).toEqual({
      success: false,
      errors: ['Row 2: title is required', 'Row 4: title is required'],
    })
  })

  it('imports nothing when any row is invalid', () => {
    const csv = [HEADER, 'Dune,,Frank Herbert,,,,,,', ',,,,,,,,'].join('\n')

    const result = csvToBooks(csv)

    expect(result.success).toBe(false)
  })
})
