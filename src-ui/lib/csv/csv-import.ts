import Papa from 'papaparse'
import type { NewBook } from '$lib/types/book'

export type CsvImportResult =
  | { success: true; books: NewBook[] }
  | { success: false; errors: string[] }

type CsvRow = Record<string, string>

export function csvToBooks(csvContent: string): CsvImportResult {
  const { data: rows } = Papa.parse<CsvRow>(csvContent, { header: true, skipEmptyLines: true })

  const errors: string[] = []
  const books: NewBook[] = []

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
      ? row.authors.split(';').map((author) => author.trim()).filter(Boolean)
      : []

    books.push({
      title,
      subtitle: row.subtitle || null,
      authors,
      isbn10: row.isbn10 || null,
      isbn13: row.isbn13 || null,
      series: row.series || null,
      pageCount: row.pageCount ? parseInt(row.pageCount, 10) : null,
      publicationDate: row.publicationDate || null,
      copyrightDate: row.copyrightDate || null,
    })
  })

  if (errors.length > 0) {
    return { success: false, errors }
  }
  return { success: true, books }
}
