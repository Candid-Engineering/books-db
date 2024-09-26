import { expect, describe, it, beforeEach, afterEach } from 'vitest'

import { books } from './Books.svelte.js'
import { type Book } from '../types/book.js'

const duneMessiah: Book = {
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
    small: 'https://covers.openlibrary.org/b/olid/OL7525229M-S.jpg'
  },
  pageCount: 329
}

const princessAndGrilledCheese: Book = {
  isbn13: '9780316538725',
  title: 'Princess and the Grilled Cheese Sandwich (a Graphic Novel)',
  authors: ['Deya Muniz']
}

describe('books', () => {
  afterEach(() => {
    books.reset()
  })
  it('should be initialized to an empty array', () => {
    expect(books.value).toStrictEqual([])
  })
  describe('#add', () => {
    it('should add a book', () => {
      books.add(duneMessiah)
      expect(books.value).toStrictEqual([duneMessiah])
    })
  })
  describe('with several books preloaded', () => {
    beforeEach(() => {
      books.value = [duneMessiah, princessAndGrilledCheese]
    })
    describe('#remove', () => {
      it('should remove the specified book', () => {
        const initialLength = books.value.length
        books.remove(duneMessiah.isbn10 as string)
        expect.soft(initialLength - books.value.length).toStrictEqual(1)
        expect(books.value).toStrictEqual([princessAndGrilledCheese])
      })
    })
  })
})
