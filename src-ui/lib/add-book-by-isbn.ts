import { getByISBN } from './openLibrary.js'
import type { BooksStore } from './state/Books.svelte.js'

export async function addBookByIsbn(isbn: string, booksStore: BooksStore): Promise<void> {
  const { book, tags, authors } = await getByISBN(isbn)
  const bookId = await booksStore.add(book)
  if (tags.length > 0 || authors.length > 0) {
    const fullBook = booksStore.value.find((b) => b.id === bookId)!
    if (tags.length > 0) await booksStore.updateTags(fullBook, tags)
    if (authors.length > 0) await booksStore.updateAuthors(fullBook, authors)
  }
}
