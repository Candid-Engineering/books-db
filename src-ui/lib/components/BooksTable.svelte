<script lang="ts">
  import type { Book, NewBook } from '$lib/types/book.js'
  import 'bulma/css/bulma.css'
  import onScan from 'onscan.js'
  import type { Action } from 'svelte/action'
  import { getByISBN } from '$lib/openLibrary.js'
  import { createBooksStore } from '$lib/state/Books.svelte'
  import BooksTableRow from './BooksTableRow.svelte'

  let booksStorePromise = createBooksStore()

  $effect(() => {
    const initialBook: NewBook = {
      isbn10: '1234567890',
      title: 'Hunting Prince Dracula',
      tags: ['Young Adult', 'Fiction'],
      authors: ['Kerri Maniscalco'],
      hasRead: true,
    }
    void booksStorePromise.then(async (booksStore) => {
      if (booksStore.value.length === 0) {
        await booksStore.add(initialBook)
      }
    })
  })

  const addByISBN = async (isbn: string): Promise<void> => {
    return booksStorePromise.then(async (booksStore) => {
      isLoading = true
      const book = await getByISBN(isbn)
      await booksStore.add(book)
      isLoading = false
    })
  }

  type scanEvent = {
    detail: {
      scanCode: string
      qty: number
    }
  }
  let promise = $state<Promise<void>>()
  const handleScan = (event: scanEvent): void => {
    promise = addByISBN(event.detail.scanCode)
  }
  const handleEdit = (book: Book, field: keyof Book, e: Event) => {
    const target = e.target as HTMLElement
    const value =
      field === 'authors'
        ? target.innerText.split(',').map((author) => author.trim())
        : target.innerText.trim()

    return booksStorePromise.then(async (booksStore) => {
      await booksStore.edit({ ...book, [field]: value })
    })
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
  let isLoading = $state(false)
</script>

<button disabled={isLoading} onclick={() => onScan.simulate(document, '1234567890123')}>
  Simulate ISBN
</button>

{#await promise}
  <p>Loading...</p>
{:catch error}
  <p style="color: red">{error.message}</p>
{/await}

<svelte:document use:listenForBarcodes on:scan={handleScan} />
{#await booksStorePromise}
  ...initial loading of books...
{:then booksStore}
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
      {#each booksStore.value as book}
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
{/await}
