import { v4 as uuidv4 } from 'uuid'
import { type Book, type BookWithoutId } from '../types/book.js'

type BooksStore = {
  value: Book[]
  add: (book: BookWithoutId) => string
  remove: (id: string) => void
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
    add: (book: BookWithoutId): string => {
      // NOTE (isummit): we're using this instead of window.crypto because window.crypto.randomUUID is
      // not available for older versions of mac os, which some of our users may be on (v11.1)
      const id = uuidv4()
      val = [...val, { ...book, id } as Book]
      return id
    },
    remove: (id: string): void => {
      val = val.filter((book) => book.id != id)
    },
    reset: (): void => {
      val = []
    },
  }
}

export const books = createBooks()
