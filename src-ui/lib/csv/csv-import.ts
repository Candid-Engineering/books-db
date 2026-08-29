import Papa from 'papaparse'
import type { NewBook } from '$lib/types/book'
import { parseSeries, type ParsedSeries } from '$lib/series'

export type CsvImportResult =
  | { success: true; books: { book: NewBook; authors: string[]; series: ParsedSeries[] }[] }
  | { success: false; errors: string[] }

type CsvRow = Record<string, string>

export function csvToBooks(csvContent: string): CsvImportResult {
  const { data: rows } = Papa.parse<CsvRow>(csvContent, { header: true, skipEmptyLines: true })

  const errors: string[] = []
  const books: { book: NewBook; authors: string[]; series: ParsedSeries[] }[] = []

  rows.forEach((row, index) => {
    // +2: the header occupies line 1, and `index` is 0-based, so the first
    // data row is line 2 - matching what a user sees in a text editor.
    const rowNumber = index + 2
    const title = row.title?.trim()

    if (!title) {
      errors.push(`Row ${rowNumber}: title is required`)
      return
    }

    const authors = row.authors
      ? row.authors
          .split(';')
          .map((author) => author.trim())
          .filter(Boolean)
      : []

    const series = row.series
      ? row.series
          .split(';')
          .map((entry) => parseSeries(entry))
          .filter((entry): entry is ParsedSeries => entry !== null)
      : []

    books.push({
      book: {
        title,
        subtitle: row.subtitle || null,
        isbn10: row.isbn10 || null,
        isbn13: row.isbn13 || null,
        pageCount: row.pageCount ? parseInt(row.pageCount, 10) : null,
        publicationDate: row.publicationDate || null,
        copyrightDate: row.copyrightDate || null,
      },
      authors,
      series,
    })
  })

  if (errors.length > 0) {
    return { success: false, errors }
  }
  return { success: true, books }
}
