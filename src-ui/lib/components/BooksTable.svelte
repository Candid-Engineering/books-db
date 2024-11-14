<script lang="ts">
  import { getByISBN } from '$lib/openLibrary.js'
  import { createBooksStore } from '$lib/state/Books.svelte'
  import type { NewBook } from '$lib/types/book.js'
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
      .catch((err: any) => {
        console.log('Err is: ', err)
      })
  })

  const addByISBN = async (isbn: string): Promise<void> => {
    return booksStorePromise.then(async (booksStore) => {
      const book = await getByISBN(isbn)
      await booksStore.add({
        ...book,
        scanDate: new Date().toISOString()
      })
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
  const handleEdit = async (book: Book, field: keyof Book, e: Event) => {
    const target = e.target as HTMLElement
    const value =
      field === 'authors' || 'tags'
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
</script>

<svelte:document use:listenForBarcodes on:scan={handleScan} />
{#await booksStorePromise}
  ...initial loading of books...
{:then booksStore}
  <table class="table is-fullwidth">
    <thead>
      <tr>
        <th><!-- delete action --></th>
        <th>isbn10</th>
        <th>isbn13</th>
        <th>Title</th>
        <th>Author</th>
        <th>Tags</th>
        <th>Read?</th>
        <th>Scan Date</th>
      </tr>
    </thead>
    <tbody>
      {#each booksStore.value as book}
        <BooksTableRow {book} />
      {:else}
        <tr>
          <td colspan="6">
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
