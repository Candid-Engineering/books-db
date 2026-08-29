import Papa from 'papaparse'
import type { Book } from '$lib/types/book'

export const CSV_FIELDS = [
  'title',
  'subtitle',
  'authors',
  'isbn10',
  'isbn13',
  'series',
  'pageCount',
  'publicationDate',
  'copyrightDate',
] as const

export function booksToCsv(books: Book[]): string {
  const data = books.map((book) => [
    book.title,
    book.subtitle ?? '',
    book.authors.map((bookAuthor) => bookAuthor.name).join('; '),
    book.isbn10 ?? '',
    book.isbn13 ?? '',
    book.series ?? '',
    book.pageCount?.toString() ?? '',
    book.publicationDate ?? '',
    book.copyrightDate ?? '',
  ])

  return Papa.unparse({ fields: [...CSV_FIELDS], data })
}
