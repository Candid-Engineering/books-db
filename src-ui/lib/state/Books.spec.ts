import { expect, describe, it, beforeEach, afterEach } from 'vitest'
import { createTestBooksStore, type BooksStore } from './Books.svelte.js'
import { type Book, type NewBook } from '$lib/types/book.js'
import { createTestDB } from '$lib/db/test_helpers.js'
import type { Database } from 'sql.js'

const duneMessiah: NewBook = {
  isbn10: '0441172695',
  isbn13: '9780441172696',
  title: 'Dune Messiah',
  subtitle: 'Dune Chronicles, Book 2',
  tags: [],
  series: 'Dune (2)', // or 'Dune Chronicles, Book 2'
  authors: ['Frank Herbert'],
  copyrightDate: '1969',
  publicationDate: 'July 15, 1987',
  coverImages: {
    large: 'https://covers.openlibrary.org/b/olid/OL7525229M-L.jpg',
    medium: 'https://covers.openlibrary.org/b/olid/OL7525229M-M.jpg',
    small: 'https://covers.openlibrary.org/b/olid/OL7525229M-S.jpg',
  },
  pageCount: 329,
}

const princessAndGrilledCheese: NewBook = {
  isbn13: '9780316538725',
  title: 'Princess and the Grilled Cheese Sandwich (a Graphic Novel)',
  authors: ['Deya Muniz'],
}

let booksStore: BooksStore
let db: Database

describe('booksStore', () => {
  beforeEach(async () => {
    const { drizzle, sqlite } = createTestDB()
    db = sqlite
    booksStore = await createTestBooksStore(drizzle)
  })

  afterEach(() => {
    db.close()
  })

  it('should be initialized to an empty array', () => {
    expect(booksStore.value).toStrictEqual([])
  })

  describe('#add', () => {
    it('should add a book with a unique ID', async () => {
      const duneMessiahId = await booksStore.add(duneMessiah)
      const addedBook = booksStore.value[0]

      expect(addedBook.title).toBe(duneMessiah.title)
      expect(addedBook.id).toBeDefined()
      expect(addedBook.id).toBe(duneMessiahId)
      expect(addedBook.isbn10).toBe(duneMessiah.isbn10)
    })
  })

  describe('with several books preloaded', () => {
    let duneMessiahWithId: Book
    beforeEach(async () => {
      await booksStore.add(duneMessiah)
      duneMessiahWithId = booksStore.value[0]
      await booksStore.add(princessAndGrilledCheese)
    })

    it('should contain two books after adding', () => {
      expect(booksStore.value.length).toBe(2)
    })
    describe('#edit', () => {
      it('should edit a book title', async () => {
        const updatedBook = {
          ...duneMessiahWithId,
          title: 'Dune Messiah: Revised Edition',
        }
        await booksStore.edit(updatedBook)
        const editedBook = booksStore.value.find((book) => book.id === duneMessiahWithId.id)
        expect(editedBook?.title).toBe('Dune Messiah: Revised Edition')
      })

      it('should edit a book subtitle', async () => {
        const updatedBook = {
          ...duneMessiahWithId,
          subtitle: 'Revised Subtitle',
        }
        await booksStore.edit(updatedBook)
        const editedBook = booksStore.value.find((book) => book.id === duneMessiahWithId.id)
        expect(editedBook?.subtitle).toBe('Revised Subtitle')
      })

      it('should edit the authors of a book', async () => {
        const updatedBook = {
          ...duneMessiahWithId,
          authors: ['Frank Herbert', 'New Co-Author'],
        }
        await booksStore.edit(updatedBook)
        const editedBook = booksStore.value.find((book) => book.id === duneMessiahWithId.id)
        expect(editedBook?.authors).toContain('New Co-Author')
      })

      it('should edit the publication date', async () => {
        const updatedBook = {
          ...duneMessiahWithId,
          publicationDate: 'August 1, 1990',
        }
        await booksStore.edit(updatedBook)
        const editedBook = booksStore.value.find((book) => book.id === duneMessiahWithId.id)
        expect(editedBook?.publicationDate).toBe('August 1, 1990')
      })

      it('should edit the cover images', async () => {
        const updatedBook = {
          ...duneMessiahWithId,
          coverImages: {
            large: 'https://some-new-link.com/new_large.jpg',
            medium: 'https://some-new-link.com/new_medium.jpg',
            small: 'https://some-new-link.com/new_small.jpg',
          },
        }
        await booksStore.edit(updatedBook)
        const editedBook = booksStore.value.find((book) => book.id === duneMessiahWithId.id)
        expect(editedBook?.coverImages?.large).toBe('https://some-new-link.com/new_large.jpg')
        expect(editedBook?.coverImages?.medium).toBe('https://some-new-link.com/new_medium.jpg')
        expect(editedBook?.coverImages?.small).toBe('https://some-new-link.com/new_small.jpg')
      })

      it('should edit the tags of a book', async () => {
        const updatedBook = {
          ...duneMessiahWithId,
          tags: ['Science Fiction', 'Classic'],
        }
        await booksStore.edit(updatedBook)
        const editedBook = booksStore.value.find((book) => book.id === duneMessiahWithId.id)
        expect(editedBook?.tags).toContain('Science Fiction')
      })

      it('should edit the page count of a book', async () => {
        const updatedBook = {
          ...duneMessiahWithId,
          pageCount: 500,
        }
        await booksStore.edit(updatedBook)
        const editedBook = booksStore.value.find((book) => book.id === duneMessiahWithId.id)
        expect(editedBook?.pageCount).toBe(500)
      })

      it('should edit the series of a book', async () => {
        const updatedBook = {
          ...duneMessiahWithId,
          series: 'Dune Chronicles (Revised)',
        }
        await booksStore.edit(updatedBook)
        const editedBook = booksStore.value.find((book) => book.id === duneMessiahWithId.id)
        expect(editedBook?.series).toBe('Dune Chronicles (Revised)')
      })
    })

    describe('#remove', () => {
      it('should remove a book by ID', async () => {
        await booksStore.remove(duneMessiahWithId.id)
        expect(booksStore.value.length).toBe(1)
        expect(booksStore.value[0].title).toBe(princessAndGrilledCheese.title)
      })
    })
  })
})
