<script lang="ts">
  import { getByISBN } from '$lib/openLibrary.js'
  import { createBooksStore } from '$lib/state/Books.svelte'
  import type { Book, NewBook } from '$lib/types/book.js'
  import 'bulma/css/bulma.css'
  import onScan from 'onscan.js'
  import type { Action } from 'svelte/action'
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
    void booksStorePromise
      .then(async (booksStore) => {
        if (booksStore.value.length === 0) {
          await booksStore.add(initialBook)
        }
      })
      .catch((err: unknown) => {
        console.log('Err is: ', err)
      })
  })

  const addByISBN = async (isbn: string): Promise<void> => {
    return booksStorePromise.then(async (booksStore) => {
      const book = await getByISBN(isbn)
      await booksStore.add(book)
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

<svelte:document use:listenForBarcodes on:scan={handleScan} />
{#await booksStorePromise}
  ...initial loading of books...
{:then booksStore}
  <table class="table is-fullwidth">
    <thead>
      <tr>
        <th><!-- delete action --></th>
        <th>ISBN</th>
        <th>Title</th>
        <th>Author</th>
        <th>Tags</th>
        <th>Read?</th>
      </tr>
    </thead>
    <tbody>
      {#each booksStore.value as book}
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
{/await}
