import { http, HttpResponse } from 'msw'
import { expect, describe, it, beforeEach } from 'vitest'
import { createTestBooksStore, type BooksStore } from './Books.svelte.js'
import { type Book, type NewBook } from '$lib/types/book.js'
import { mockServer } from '../../testing/msw-setup.js'
import { testDb } from '../../testing/db-setup.js'
import * as schema from '$lib/db/schema'
import { and, eq } from 'drizzle-orm/sql/expressions/conditions'

const duneMessiah: NewBook = {
  isbn10: '0441172695',
  isbn13: '9780441172696',
  title: 'Dune Messiah',
  subtitle: 'Dune Chronicles, Book 2',
  series: 'Dune (2)', // or 'Dune Chronicles, Book 2'
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
}

let booksStore: BooksStore

describe('booksStore', () => {
  beforeEach(() => {
    booksStore = createTestBooksStore(testDb.drizzle)
    mockServer.use(
      http.get('https://openlibrary.org/isbn/9780441004225.json', () => {
        return HttpResponse.json({
          identifiers: {
            goodreads: ['64396'],
            librarything: ['52023'],
          },
          title: 'Adventures of the Stainless Steel Rat',
          authors: [
            {
              key: '/authors/OL27278A',
            },
          ],
          publish_date: 'October 1996',
          publishers: ['Ace Books'],
          covers: [283622],
          languages: [
            {
              key: '/languages/eng',
            },
          ],
          type: {
            key: '/type/edition',
          },
          local_id: ['urn:bwbsku:T2-AQV-123', 'urn:bwbsku:086-BAC-919'],
          source_records: [
            'promise:bwb_daily_pallets_2021-07-15:T2-AQV-123',
            'bwb:9780441004225',
            'promise:bwb_daily_pallets_2021-05-14:086-BAC-919',
          ],
          key: '/books/OL7524009M',
          works: [
            {
              key: '/works/OL467275W',
            },
          ],
          classifications: {},
          series: ['The Stainless Steel Rat'],
          ocaid: 'adventuresofstai00harr_0',
          isbn_10: ['0441004229'],
          isbn_13: ['9780441004225'],
          oclc_numbers: ['20230277'],
          number_of_pages: 402,
          latest_revision: 21,
          revision: 21,
          created: {
            type: '/type/datetime',
            value: '2008-04-29T13:35:46.876380',
          },
          last_modified: {
            type: '/type/datetime',
            value: '2024-05-29T21:37:41.873318',
          },
        })
      }),
      http.get('https://openlibrary.org/books/OL7524009M.json', () => {
        return HttpResponse.json({
          identifiers: {
            goodreads: ['64396'],
            librarything: ['52023'],
          },
          title: 'Adventures of the Stainless Steel Rat',
          authors: [
            {
              key: '/authors/OL27278A',
            },
          ],
          publish_date: 'October 1996',
          publishers: ['Ace Books'],
          covers: [283622],
          languages: [
            {
              key: '/languages/eng',
            },
          ],
          type: {
            key: '/type/edition',
          },
          local_id: ['urn:bwbsku:T2-AQV-123', 'urn:bwbsku:086-BAC-919'],
          source_records: [
            'promise:bwb_daily_pallets_2021-07-15:T2-AQV-123',
            'bwb:9780441004225',
            'promise:bwb_daily_pallets_2021-05-14:086-BAC-919',
          ],
          key: '/books/OL7524009M',
          works: [
            {
              key: '/works/OL467275W',
            },
          ],
          classifications: {},
          series: ['The Stainless Steel Rat'],
          ocaid: 'adventuresofstai00harr_0',
          isbn_10: ['0441004229'],
          isbn_13: ['9780441004225'],
          oclc_numbers: ['20230277'],
          number_of_pages: 402,
          latest_revision: 21,
          revision: 21,
          created: {
            type: '/type/datetime',
            value: '2008-04-29T13:35:46.876380',
          },
          last_modified: {
            type: '/type/datetime',
            value: '2024-05-29T21:37:41.873318',
          },
        })
      })
    )
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

    describe('#updateTags', () => {
      it('should update the tags of a book', async () => {
        await booksStore.updateTags(duneMessiahWithId, ['Science Fiction', 'Classic'])
        const editedBook = booksStore.value.find((book) => book.id === duneMessiahWithId.id)
        expect(editedBook?.tags.map((t) => t.name)).toContain('Science Fiction')
      })
    })

    describe('#updateAuthors', () => {
      it('should update the authors of a book', async () => {
        await booksStore.updateAuthors(duneMessiahWithId, ['Frank Herbert', 'Brian Herbert'])
        const editedBook = booksStore.value.find((book) => book.id === duneMessiahWithId.id)
        expect(editedBook?.authors.map((a) => a.name)).toContain('Frank Herbert')
      })
    })

    describe('#remove', () => {
      it('should remove a book by ID', async () => {
        await booksStore.remove(duneMessiahWithId.id)
        expect(booksStore.value.length).toBe(1)
        expect(booksStore.value[0].title).toBe(princessAndGrilledCheese.title)
      })

      it('should soft-delete rather than removing the row', async () => {
        await booksStore.remove(duneMessiahWithId.id)
        const [rawRow] = await testDb.drizzle
          .select()
          .from(schema.books)
          .where(eq(schema.books.id, duneMessiahWithId.id))
        expect(rawRow).toBeDefined()
        expect(rawRow.deletedAt).not.toBeNull()
      })

      it('should mark the book as pending sync', async () => {
        await booksStore.remove(duneMessiahWithId.id)
        const [rawRow] = await testDb.drizzle
          .select()
          .from(schema.books)
          .where(eq(schema.books.id, duneMessiahWithId.id))
        expect(rawRow.syncedAt).toBeNull()
      })

      it("should tombstone the book's active tags too", async () => {
        await booksStore.updateTags(duneMessiahWithId, ['Science Fiction'])
        await booksStore.remove(duneMessiahWithId.id)

        const [rawTagRow] = await testDb.drizzle
          .select()
          .from(schema.bookTags)
          .where(
            and(
              eq(schema.bookTags.bookId, duneMessiahWithId.id),
              eq(schema.bookTags.name, 'Science Fiction')
            )
          )
        expect(rawTagRow.deletedAt).not.toBeNull()
        expect(rawTagRow.syncedAt).toBeNull()
      })

      it("should tombstone the book's active authors too", async () => {
        await booksStore.updateAuthors(duneMessiahWithId, ['Frank Herbert'])
        await booksStore.remove(duneMessiahWithId.id)

        const [rawAuthorRow] = await testDb.drizzle
          .select()
          .from(schema.bookAuthors)
          .where(
            and(
              eq(schema.bookAuthors.bookId, duneMessiahWithId.id),
              eq(schema.bookAuthors.name, 'Frank Herbert')
            )
          )
        expect(rawAuthorRow.deletedAt).not.toBeNull()
        expect(rawAuthorRow.syncedAt).toBeNull()
      })
    })

    describe('tag lifecycle', () => {
      it('should mark a removed tag as pending sync rather than deleting the row', async () => {
        await booksStore.updateTags(duneMessiahWithId, ['Science Fiction'])
        const withTagAdded = booksStore.value.find((book) => book.id === duneMessiahWithId.id)!
        await booksStore.updateTags(withTagAdded, [])

        const rawTagRows = await testDb.drizzle
          .select()
          .from(schema.bookTags)
          .where(
            and(
              eq(schema.bookTags.bookId, duneMessiahWithId.id),
              eq(schema.bookTags.name, 'Science Fiction')
            )
          )

        expect(rawTagRows).toHaveLength(1)
        expect(rawTagRows[0].deletedAt).not.toBeNull()
        expect(rawTagRows[0].syncedAt).toBeNull()

        const editedBook = booksStore.value.find((book) => book.id === duneMessiahWithId.id)
        expect(editedBook?.tags.map((t) => t.name)).not.toContain('Science Fiction')
      })

      it('should revive a previously-removed tag on re-add instead of erroring or duplicating', async () => {
        await booksStore.updateTags(duneMessiahWithId, ['Science Fiction'])
        const withTagAdded = booksStore.value.find((book) => book.id === duneMessiahWithId.id)!
        await booksStore.updateTags(withTagAdded, [])
        const withTagRemoved = booksStore.value.find((book) => book.id === duneMessiahWithId.id)!
        await booksStore.updateTags(withTagRemoved, ['Science Fiction'])

        const rawTagRows = await testDb.drizzle
          .select()
          .from(schema.bookTags)
          .where(
            and(
              eq(schema.bookTags.bookId, duneMessiahWithId.id),
              eq(schema.bookTags.name, 'Science Fiction')
            )
          )

        expect(rawTagRows).toHaveLength(1)
        expect(rawTagRows[0].deletedAt).toBeNull()
        expect(rawTagRows[0].syncedAt).toBeNull()

        const editedBook = booksStore.value.find((book) => book.id === duneMessiahWithId.id)
        expect(editedBook?.tags.map((t) => t.name)).toContain('Science Fiction')
      })
    })

    describe('author lifecycle', () => {
      it('should mark a removed author as pending sync rather than deleting the row', async () => {
        await booksStore.updateAuthors(duneMessiahWithId, ['Frank Herbert'])
        const withAuthorAdded = booksStore.value.find((book) => book.id === duneMessiahWithId.id)!
        await booksStore.updateAuthors(withAuthorAdded, [])

        const rawAuthorRows = await testDb.drizzle
          .select()
          .from(schema.bookAuthors)
          .where(
            and(
              eq(schema.bookAuthors.bookId, duneMessiahWithId.id),
              eq(schema.bookAuthors.name, 'Frank Herbert')
            )
          )

        expect(rawAuthorRows).toHaveLength(1)
        expect(rawAuthorRows[0].deletedAt).not.toBeNull()
        expect(rawAuthorRows[0].syncedAt).toBeNull()

        const editedBook = booksStore.value.find((book) => book.id === duneMessiahWithId.id)
        expect(editedBook?.authors.map((a) => a.name)).not.toContain('Frank Herbert')
      })

      it('should revive a previously-removed author on re-add instead of erroring or duplicating', async () => {
        await booksStore.updateAuthors(duneMessiahWithId, ['Frank Herbert'])
        const withAuthorAdded = booksStore.value.find((book) => book.id === duneMessiahWithId.id)!
        await booksStore.updateAuthors(withAuthorAdded, [])
        const withAuthorRemoved = booksStore.value.find((book) => book.id === duneMessiahWithId.id)!
        await booksStore.updateAuthors(withAuthorRemoved, ['Frank Herbert'])

        const rawAuthorRows = await testDb.drizzle
          .select()
          .from(schema.bookAuthors)
          .where(
            and(
              eq(schema.bookAuthors.bookId, duneMessiahWithId.id),
              eq(schema.bookAuthors.name, 'Frank Herbert')
            )
          )

        expect(rawAuthorRows).toHaveLength(1)
        expect(rawAuthorRows[0].deletedAt).toBeNull()
        expect(rawAuthorRows[0].syncedAt).toBeNull()

        const editedBook = booksStore.value.find((book) => book.id === duneMessiahWithId.id)
        expect(editedBook?.authors.map((a) => a.name)).toContain('Frank Herbert')
      })
    })

    describe('sync tracking', () => {
      it('should mark a book as pending sync after editing', async () => {
        await booksStore.edit({ ...duneMessiahWithId, title: 'Dune Messiah: Revised Edition' })
        const [rawRow] = await testDb.drizzle
          .select()
          .from(schema.books)
          .where(eq(schema.books.id, duneMessiahWithId.id))
        expect(rawRow.syncedAt).toBeNull()
      })
    })
  })
})
