<script lang="ts">
  import type { Book, BookWithoutId } from '$lib/types/book.js'
  import 'bulma/css/bulma.css'
  import onScan from 'onscan.js'
  import type { Action } from 'svelte/action'
  import { getByISBN } from '../../lib/openLibrary.js'
  import { books } from '../state/Books.svelte'
  import BooksTableRow from './BooksTableRow.svelte'

  const initialBook: BookWithoutId = {
    isbn10: '1234567890',
    title: 'Hunting Prince Dracula',
    tags: ['Young Adult', 'Fiction'],
    authors: ['Kerri Maniscalco'],
    hasRead: true,
  }


  if (books.value.length == 0) {
    books.add(initialBook)
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
  let promise: Promise<void> | undefined;
  const handleScan = async (event: scanEvent): Promise<void> => {
    promise = addBook(event.detail.scanCode)
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


<button on:click={() => onScan.simulate(document, '1234567890123')}>
	Simulate ISBN
</button>

{#await promise}
  <p>Loading...</p>
{:catch error}
  <p style="color: red">{error.message}</p>
{/await}

<svelte:document use:listenForBarcodes on:scan={handleScan} />
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
