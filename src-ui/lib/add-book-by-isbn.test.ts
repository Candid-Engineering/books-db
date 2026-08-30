import { describe, it, expect, beforeEach } from 'vitest'
import { http, HttpResponse } from 'msw'
import { mockServer } from '../testing/msw-setup'
import { testDb } from '../testing/db-setup'
import { createTestBooksStore, type BooksStore } from '$lib/state/Books.svelte'
import { addBookByIsbn } from './add-book-by-isbn'

const ISBN = '9780441004225'

describe('addBookByIsbn', () => {
  let booksStore: BooksStore

  beforeEach(() => {
    booksStore = createTestBooksStore(testDb.drizzle)
    mockServer.use(
      http.get(`https://openlibrary.org/isbn/${ISBN}.json`, () => {
        return HttpResponse.json({
          title: 'Adventures of the Stainless Steel Rat',
          authors: [{ key: '/authors/OL27278A' }],
          publish_date: 'October 1996',
          key: '/books/OL7524009M',
          subjects: ['Science Fiction'],
          series: ['The Stainless Steel Rat #1'],
          isbn_10: ['0441004229'],
          isbn_13: ['9780441004225'],
        })
      }),
      http.get('https://openlibrary.org/authors/OL27278A.json', () => {
        return HttpResponse.json({ name: 'Harry Harrison', key: '/authors/OL27278A' })
      })
    )
  })

  it('adds the book with its title', async () => {
    await addBookByIsbn(ISBN, booksStore)
    expect(booksStore.value[0]?.title).toBe('Adventures of the Stainless Steel Rat')
  })

  it('fills in the authors', async () => {
    await addBookByIsbn(ISBN, booksStore)
    expect(booksStore.value[0]?.authors.map((a) => a.name)).toEqual(['Harry Harrison'])
  })

  it('fills in the tags', async () => {
    await addBookByIsbn(ISBN, booksStore)
    expect(booksStore.value[0]?.tags.map((t) => t.name)).toEqual(['Science Fiction'])
  })

  it('fills in the series with its parsed position', async () => {
    await addBookByIsbn(ISBN, booksStore)
    expect(booksStore.value[0]?.series).toEqual([
      expect.objectContaining({ name: 'The Stainless Steel Rat', label: '1', sortKey: 1 }),
    ])
  })
})
