import { describe, it, expect, vi, beforeEach } from 'vitest'
import { http, HttpResponse } from 'msw'
import { getByISBN } from './openLibrary'
import { mockServer } from '../testing/msw-setup'

describe('book', () => {
  beforeEach(() => {
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
      }),
      http.get('https://openlibrary.org/authors/OL27278A.json', () => {
        return HttpResponse.json({
          name: 'Harry Harrison',
          bio: 'Harry Max Harrison was born Henry Maxwell Dempsey in Stamford, Connecticut. He moved with his family to New York early in his childhood. On his 18th birthday, having graduated from high school, he was drafted into the U.S. Army Air Corps, and serves as an armourer, gunnery instructor, truck driver, and military police officer. When the war ended, he became an art student at both the Hunter College in New York City and the Cartoonists and Illustrators School. Upon graduation, he became a freelance graphic artist, providing illustrations for book covers, magazines, and comic books such as Weird Fantasy and Weird Science. He also began contributing articles to these magazines. In 1952, he moved into editing pulp magazines such as Amazing Stories and Fantastic. In 1954 he married, and their first child was born in 1955. In 1956 he became a full-time writer, and began working on his first book in addition to writing for other publications such as The Saint syndicated comic strips. Over the next decade he and his family moved to several places, including Mexico, England, Italy, back to New York for the birth of their second child in 1959, to Denmark for seven years, back to England in 1965, San Diego in 1967, and finally Ireland in 1975 where they settled. Harrison produced over 60 books, occasionally in collaboration with other well-known writers such as Gordon R. Dickson.',
          birth_date: '12 March 1925',
          wikipedia: 'http://en.wikipedia.org/wiki/Harry_Harrison',
          type: {
            key: '/type/author',
          },
          source_records: ['amazon:0722143443', 'amazon:0722143559'],
          alternate_names: ['Hank Dempsey'],
          remote_ids: {
            isni: '0000000368644868',
            viaf: '80169724',
            wikidata: 'Q489193',
          },
          title: 'pseud. van Henry Maxwell Dempsey',
          death_date: '15 August 2012',
          personal_name: 'Harry Harrison',
          location: 'Dublin, Ireland',
          photos: [14595114, 5539267],
          links: [
            {
              title: 'Website',
              url: 'http://www.harryharrison.com/',
              type: {
                key: '/type/link',
              },
            },
          ],
          key: '/authors/OL27278A',
          latest_revision: 15,
          revision: 15,
          created: {
            type: '/type/datetime',
            value: '2008-04-01T03:28:50.625462',
          },
          last_modified: {
            type: '/type/datetime',
            value: '2024-08-26T09:38:15.526497',
          },
        })
      })
    )
  })
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

      await expect(async () => await getByISBN(isbn)).rejects.toThrow('The operation timed out.')
    })

    it.skip("should be able to retrieve The Stainless Steel Rat's Revenge (9781857984996)", async () => {})
    it.skip("should be able to retrieve another edition of The Stainless Steel Rat's Revenge (9780575115408)", async () => {})
    it.skip('should be able to retrieve The Dragons of Heaven (9780857664334)', async () => {})
    it.skip('should be able to retrieve The Princess and the Grilled Cheese Sandwich (9780316538725)', async () => {})
  })
})
