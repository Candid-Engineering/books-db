import { expect, describe, it, beforeEach, afterEach } from 'vitest'
import { books } from './Books.svelte.js'
import { type Book, type BookWithoutId } from '../types/book.js'

const duneMessiah: BookWithoutId = {
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

const princessAndGrilledCheese: BookWithoutId = {
  isbn13: '9780316538725',
  title: 'Princess and the Grilled Cheese Sandwich (a Graphic Novel)',
  authors: ['Deya Muniz'],
}

describe('books', () => {
  afterEach(() => {
    books.reset()
  })

  it('should be initialized to an empty array', () => {
    expect(books.value).toStrictEqual([])
  })

  describe('#add', () => {
    it('should add a book with a unique ID', () => {
      books.add(duneMessiah)
      const addedBook = books.value[0]

      expect(addedBook.title).toBe(duneMessiah.title)
      expect(addedBook.id).toBeDefined()
      expect(addedBook.isbn10).toBe(duneMessiah.isbn10)
    })
  })

  describe('with several books preloaded', () => {
    let duneMessiahWithId: Book
    let princessAndGrilledCheeseWithId: Book
    beforeEach(() => {
      books.add(duneMessiah)
      books.add(princessAndGrilledCheese)
      duneMessiahWithId = books.value[0]
      princessAndGrilledCheeseWithId = books.value[1]
    })

    it('should contain two books after adding', () => {
      expect(books.value.length).toBe(2)
    })
    describe('#edit', () => {
      it('should edit a book title', () => {
        const updatedBook = {
          ...duneMessiahWithId,
          title: 'Dune Messiah: Revised Edition',
        }
        books.edit(updatedBook)
        const editedBook = books.value.find((book) => book.id === duneMessiahWithId.id)
        expect(editedBook?.title).toBe('Dune Messiah: Revised Edition')
      })

      it('should edit a book subtitle', () => {
        const updatedBook = {
          ...duneMessiahWithId,
          subtitle: 'Revised Subtitle',
        }
        books.edit(updatedBook)
        const editedBook = books.value.find((book) => book.id === duneMessiahWithId.id)
        expect(editedBook?.subtitle).toBe('Revised Subtitle')
      })

      it('should edit the authors of a book', () => {
        const updatedBook = {
          ...duneMessiahWithId,
          authors: ['Frank Herbert', 'New Co-Author'],
        }
        books.edit(updatedBook)
        const editedBook = books.value.find((book) => book.id === duneMessiahWithId.id)
        expect(editedBook?.authors).toContain('New Co-Author')
      })

      it('should edit the publication date', () => {
        const updatedBook = {
          ...duneMessiahWithId,
          publicationDate: 'August 1, 1990',
        }
        books.edit(updatedBook)
        const editedBook = books.value.find((book) => book.id === duneMessiahWithId.id)
        expect(editedBook?.publicationDate).toBe('August 1, 1990')
      })

      it('should edit the cover images', () => {
        const updatedBook = {
          ...duneMessiahWithId,
          coverImages: {
            large: 'https://some-new-link.com/new_large.jpg',
            medium: 'https://some-new-link.com/new_medium.jpg',
            small: 'https://some-new-link.com/new_small.jpg',
          },
        }
        books.edit(updatedBook)
        const editedBook = books.value.find((book) => book.id === duneMessiahWithId.id)
        expect(editedBook?.coverImages?.large).toBe('https://some-new-link.com/new_large.jpg')
        expect(editedBook?.coverImages?.medium).toBe('https://some-new-link.com/new_medium.jpg')
        expect(editedBook?.coverImages?.small).toBe('https://some-new-link.com/new_small.jpg')
      })

      it('should edit the tags of a book', () => {
        const updatedBook = {
          ...duneMessiahWithId,
          tags: ['Science Fiction', 'Classic'],
        }
        books.edit(updatedBook)
        const editedBook = books.value.find((book) => book.id === duneMessiahWithId.id)
        expect(editedBook?.tags).toContain('Science Fiction')
      })

      it('should edit the page count of a book', () => {
        const updatedBook = {
          ...duneMessiahWithId,
          pageCount: 500,
        }
        books.edit(updatedBook)
        const editedBook = books.value.find((book) => book.id === duneMessiahWithId.id)
        expect(editedBook?.pageCount).toBe(500)
      })

      it('should edit the series of a book', () => {
        const updatedBook = {
          ...duneMessiahWithId,
          series: 'Dune Chronicles (Revised)',
        }
        books.edit(updatedBook)
        const editedBook = books.value.find((book) => book.id === duneMessiahWithId.id)
        expect(editedBook?.series).toBe('Dune Chronicles (Revised)')
      })
    })

    describe('#remove', () => {
      it('should remove a book by ID', () => {
        books.remove(duneMessiahWithId.id)
        expect(books.value.length).toBe(1)
        expect(books.value[0].title).toBe(princessAndGrilledCheese.title)
      })
    })
  })
})
