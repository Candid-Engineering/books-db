import { type Book } from '../../../lib/types/book.js'

type BooksStore = {
  value: Book[]
  add: (book: Book) => void
  remove: (isbn: string) => void
  reset: () => void
}

// NOTE(rkofman): it's possible to make this a class with a singleton
// constructor (instead of a type consisting of two functions with a data
// closure).  This may ease future testability.
function createBooks(): BooksStore {
  let val = $state<Book[]>([])

  return {
    get value(): Book[] {
      return val
    },
    set value(newVal: Book[]) {
      val = newVal
    },
    add: (book: Book): void => {
      val = [...val, book]
    },
    remove: (isbn: string): void => {
      val = val.filter((book) => book.isbn10 != isbn && book.isbn13 != isbn)
    },
    reset: (): void => {
      val = []
    }
  }
}

export const books = createBooks()
