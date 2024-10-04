import { expect, describe, it, beforeEach, afterEach } from 'vitest'
import { books } from './Books.svelte.js'
import { type BookWithoutId } from '../types/book.js'

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
    beforeEach(() => {
      books.add(duneMessiah)
      books.add(princessAndGrilledCheese)
    })

    it('should contain two books after adding', () => {
      expect(books.value.length).toBe(2)
    })

    describe('#remove', () => {
      it('should remove a book by ISBN-10', () => {
        books.remove(duneMessiah.isbn10 as string)
        expect(books.value.length).toBe(1)
        expect(books.value[0].title).toBe(princessAndGrilledCheese.title)
      })

      it('should remove a book by ISBN-13', () => {
        books.remove(princessAndGrilledCheese.isbn13 as string)
        expect(books.value.length).toBe(1)
        expect(books.value[0].title).toBe('Dune Messiah')
      })
    })
  })
})
