import { writable, type Readable, type Writable } from 'svelte/store'
import { type Book } from '../../../lib/types/book.js'

type BooksStore = Readable<Book[]> & {
  add: (book: Book) => void
  remove: (isbn: string) => void
  set: (books: Book[]) => void
  reset: () => void
}

// NOTE(rkofman): it's possible to make this a class with a singleton
// constructor (instead of a type consisting of two functions with a data
// closure).  This may ease future testability.
function createBooks(): BooksStore {
  const { subscribe, update, set }: Writable<Book[]> = writable([])

  return {
    subscribe: subscribe,
    set: set,
    add: (book: Book): void => {
      console.log('Adding book: ', book)
      update((books: Book[]): Book[] => [...books, book])
    },
    remove: (isbn: string): void => {
      console.log('removing book: ', isbn)
      update((books: Book[]): Book[] =>
        books.filter((book) => book.isbn10 != isbn && book.isbn13 != isbn)
      )
    },
    reset: (): void => {
      console.log('resetting books')
      set([])
    }
  }
}

export const books = createBooks()
