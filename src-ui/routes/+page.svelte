<script lang="ts">
  import 'bulma/css/bulma.css'
  import onScan from 'onscan.js'

  import type { Action } from 'svelte/action'
  import BooksTable from '../lib/components/BooksTable.svelte'
  import { type Book } from '../lib/types/book.js'
  import { getByISBN } from '../lib/openLibrary.js'
  import { books } from '../lib/state/Books.svelte'

  const initialBook: Book = {
    isbn10: '1234567890',
    title: 'Hunting Prince Dracula',
    tags: ['Young Adult', 'Fiction'],
    authors: ['Kerri Maniscalco'],
    hasRead: true
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
      }
    }
  }
</script>
<h1>Your Friendly Book Catalog</h1>

<svelte:document on:scan={handleScan} use:listenForBarcodes />
<BooksTable />
