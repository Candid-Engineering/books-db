<script lang="ts">
  import type { Book, BookWithoutId } from '$lib/types/book.js'
  import 'bulma/css/bulma.css'
  import onScan from 'onscan.js'
  import type { Action } from 'svelte/action'
  import { getByISBN } from '../../lib/openLibrary.js'
  import { books } from '../state/Books.svelte'
  import BooksTableRow from './BooksTableRow.svelte'
  const isbns: Array<string> = []

  async function fetchBooksWithISBNs() {
    try {
      // Fetch works for author John Scalzi
      const worksResponse = await fetch('https://openlibrary.org/authors/OL10677176A/works.json')
      const worksData = await worksResponse.json()

      // Iterate over the works to get editions (and their ISBNs)
      await Promise.all(
        worksData.entries.map(async (work: { key: string }) => {
          // Fetch editions for each work
          const editionsResponse = await fetch(
            `https://openlibrary.org/works/${work.key.split('/').pop()}/editions.json`
          )
          const editionsData = await editionsResponse.json()
          // Extract ISBNs from the editions, checking if the field exists
          editionsData.entries.map(
            (edition: { isbn_13: Array<string>; isbn_10: Array<string> }) => {
              isbns.push(edition.isbn_13[0] || edition.isbn_10[0])
            }
          )
        })
      )

      console.log(isbns)
    } catch (error) {
      console.error('Error fetching books or ISBNs:', error)
    }
  }

  const initialBook: BookWithoutId = {
    isbn10: '1234567890',
    title: 'Hunting Prince Dracula',
    tags: ['Young Adult', 'Fiction'],
    authors: ['Kerri Maniscalco'],
    hasRead: true,
  }

  if (books.value.length == 0) {
    books.add(initialBook)
    fetchBooksWithISBNs()
  }

  const addBook = async (isbn: string): Promise<void> => {
    books.add(await getByISBN(isbn))
  }

  type scanEvent = {
    detail: {
      scanCode: string
      qty: number
    }
  }
  const handleScan = async (event: scanEvent): Promise<void> => {
    await addBook(event.detail.scanCode)
  }
  const handleEdit = (book: Book, field: keyof Book, e: Event) => {
    const target = e.target as HTMLElement
    const value =
      field === 'authors'
        ? target.innerText.split(',').map((author) => author.trim())
        : target.innerText.trim()

    books.edit({ ...book, [field]: value })
  }

  type ScanAttributes = {
    'on:scan': (event: scanEvent) => void
  }

  const listenForBarcodes: Action<HTMLElement, undefined, ScanAttributes> = (node: HTMLElement) => {
    onScan.attachTo(node, {})
    return {
      destroy: (): void => {
        onScan.detachFrom(node)
      },
    }
  }
</script>

<svelte:document on:scan={handleScan} use:listenForBarcodes />
<table class="table is-fullwidth">
  <thead>
    <tr>
      <th>ISBN</th>
      <th>Title</th>
      <th>Author</th>
      <th>Tags</th>
      <th>Read?</th>
    </tr>
  </thead>
  <tbody>
    {#each books.value as book}
      <BooksTableRow {book} {handleEdit} />
    {:else}
      <tr>
        <td colspan="5">
          <section class="section">
            <div class="content has-text-grey has-text-centered">
              <p><i class="far fa-3x fa-frown"></i></p>
              <p>No books</p>
            </div>
          </section>
        </td>
      </tr>
    {/each}
  </tbody>
</table>
