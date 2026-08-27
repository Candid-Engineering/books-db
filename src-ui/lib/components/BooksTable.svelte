<script lang="ts">
  import { getByISBN } from '$lib/openLibrary.js'
  import { getBooksStore } from '$lib/state/Books.svelte'
  import onScan from 'onscan.js'
  import type { Action } from 'svelte/action'
  import BooksTableRow from './BooksTableRow.svelte'

  let booksStore = getBooksStore()

  const addByISBN = async (isbn: string): Promise<void> => {
    const { book, tags, authors } = await getByISBN(isbn)
    const bookId = await booksStore.add(book)
    if (tags.length > 0 || authors.length > 0) {
      const fullBook = booksStore.value.find((b) => b.id === bookId)!
      if (tags.length > 0) await booksStore.updateTags(fullBook, tags)
      if (authors.length > 0) await booksStore.updateAuthors(fullBook, authors)
    }
  }

  type scanEvent = {
    detail: {
      scanCode: string
      qty: number
    }
  }
  const handleScan = (event: scanEvent): void => {
    void addByISBN(event.detail.scanCode)
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
{#if !booksStore.initialized}
  ...initial loading of books...
{:else}
  <table class="table is-fullwidth">
    <thead>
      <tr>
        <th><!-- delete action --></th>
        <th>ISBN 10</th>
        <th>ISBN 13</th>
        <th>Title</th>
        <th>Author</th>
        <th>Tags</th>
        <th>Read?</th>
        <th>Scanned</th>
      </tr>
    </thead>
    <tbody>
      {#each booksStore.value as book (book.id)}
        <BooksTableRow {book} />
      {:else}
        <tr>
          <td colspan="8">
            <section class="section">
              <div class="content has-text-soft has-text-centered">
                <p><i class="far fa-3x fa-frown"></i></p>
                <p>No books</p>
              </div>
            </section>
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
{/if}
