export type Book = {
  id: string
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

export type BookWithoutId = Partial<Omit<Book, 'id'>>
