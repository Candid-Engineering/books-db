import { type Book } from '../types/book.js'
import { v4 as uuidv4 } from 'uuid'

type BooksStore = {
  value: Book[]
  add: (book: Book | Partial<Book>) => void
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
    add: (book: Book | Partial<Book>): void => {
      // NOTE (isummit): we're using this instead of window.crypto because window.crypto.randomUUID is
      // not available for older versions of mac os, which some of our users may be on.
      book.id = uuidv4()
      val = [...val, book as Book]
    },
    remove: (isbn: string): void => {
      val = val.filter((book) => book.isbn10 != isbn && book.isbn13 != isbn)
    },
    reset: (): void => {
      val = []
    },
  }
}

export const books = createBooks()
