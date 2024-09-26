export type Book = {
  isbn10?: string
  isbn13?: string
  title: string
  subtitle?: string
  authors: string[]
  tags?: string[]
  series?: string
  pageCount?: number
  publicationDate?: string
  copyrightDate?: string
  coverImages?: { small?: string; medium?: string; large?: string }
  hasRead?: boolean
}
