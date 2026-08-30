<script lang="ts">
  import { addBookByIsbn } from '$lib/add-book-by-isbn.js'
  import { getBooksStore, type BooksStore } from '$lib/state/Books.svelte'
  import { groupByEdition } from '$lib/duplicates'
  import onScan from 'onscan.js'
  import type { Action } from 'svelte/action'
  import BooksTableRow from './BooksTableRow.svelte'

  let { booksStore = getBooksStore() }: { booksStore?: BooksStore } = $props()

  let groups = $derived(groupByEdition(booksStore.value))

  type scanEvent = {
    detail: {
      scanCode: string
      qty: number
    }
  }
  const handleScan = (event: scanEvent): void => {
    void addBookByIsbn(event.detail.scanCode, booksStore)
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
        <th><!-- disclosure --></th>
        <th><!-- cover --></th>
        <th>Title</th>
        <th>Author</th>
        <th>Tags</th>
        <th>Series</th>
        <th>Read?</th>
        <th>Scanned</th>
        <th><!-- delete action --></th>
      </tr>
    </thead>
    <tbody>
      {#each groups as group (group[0].id)}
        <BooksTableRow books={group} {booksStore} />
      {:else}
        <tr>
          <td colspan="9">
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
