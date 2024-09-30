<script lang="ts">
  import 'bulma/css/bulma.css'
  import onScan from 'onscan.js'
  import { books } from '../state/Books.svelte'
  import type { Action } from 'svelte/action'
  import { getByISBN } from '../../lib/openLibrary.js'
  import { type Book } from '../../lib/types/book.js'
  import BooksTableRow from './BooksTableRow.svelte'

  const initialBook: Partial<Book> = {
    isbn10: '1234567890',
    title: 'Hunting Prince Dracula',
    tags: ['Young Adult', 'Fiction'],
    authors: ['Kerri Maniscalco'],
    hasRead: true,
  }

  if (books.value.length == 0) {
    books.add(initialBook)
    console.log(books.value)
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
      <BooksTableRow {book} />
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
