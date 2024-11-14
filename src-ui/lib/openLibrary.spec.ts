import { describe, it, expect, vi } from 'vitest'
import { getByISBN } from './openLibrary'

describe('book', () => {
  describe('#getByISBN', () => {
    const isbn = '9780441004225'
    it('should be able to retrieve The Stainless Steel Rat (9780441004225)', async () => {
      const book = await getByISBN(isbn)
      const expected = {
        authors: ['Harry Harrison'],
        // copyrightDate: undefined,
        coverImages: {
          large: 'https://covers.openlibrary.org/b/olid/OL7524009M-L.jpg',
          medium: 'https://covers.openlibrary.org/b/olid/OL7524009M-M.jpg',
          small: 'https://covers.openlibrary.org/b/olid/OL7524009M-S.jpg',
        },
        isbn10: '0441004229',
        isbn13: '9780441004225',
        pageCount: 402,
        publicationDate: 'October 1996',
        series: 'The Stainless Steel Rat',
        // subtitle: undefined,
        tags: [],
        title: 'Adventures of the Stainless Steel Rat',
      }
      expect(book).toEqual(expected)
    })
    it('should throw a timeout error when Open Library is down and request times out', async () => {
      global.fetch = vi.fn(
        (_: Request, { signal }: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            // Simulate the request being aborted
            signal?.addEventListener('abort', () => {
              reject(new DOMException('Aborted', 'AbortError'))
            })
          })
      )
      await getByISBN(isbn)
        .then(() => {
          throw new Error('Test failed: Expected a timeout error')
        })
        .catch((error: Error) => {
          expect(error.message).toBe('Fetch request timed out')
        })
    })

    it.skip("should be able to retrieve The Stainless Steel Rat's Revenge (9781857984996)", async () => {})
    it.skip("should be able to retrieve another edition of The Stainless Steel Rat's Revenge (9780575115408)", async () => {})
    it.skip('should be able to retrieve The Dragons of Heaven (9780857664334)', async () => {})
    it.skip('should be able to retrieve The Princess and the Grilled Cheese Sandwich (9780316538725)', async () => {})
  })
})
