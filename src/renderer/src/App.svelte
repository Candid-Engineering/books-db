<script lang="ts">
  import 'bulma/css/bulma.css'
  import onScan from 'onscan.js'

  import BooksTable from './components/BooksTable.svelte'
  import { type Book } from '../../lib/types/book.js'
  import Versions from './components/Versions.svelte'
  import electronLogo from './assets/electron.svg'
  import { getByISBN } from '../../lib/openLibrary.js'
  import type { Action } from 'svelte/action'
  import { books } from './stores/Books.js'

  // @ts-ignore (long-term, use a d.ts fix for window.electron typing)
  const ipcHandle = (): void => window.electron.ipcRenderer.send('ping')

  const initialBook: Book = {
    isbn10: '1234567890',
    title: 'Hunting Prince Dracula',
    tags: ['Young Adult', 'Fiction'],
    authors: ['Kerri Maniscalco'],
    hasRead: true
  }
  books.add(initialBook)

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
    onScan.attachTo(node)
    return {
      destroy: (): void => {
        onScan.detachFrom(node)
      }
    }
  }
</script>

<svelte:document on:scan={handleScan} use:listenForBarcodes />
<BooksTable />

<img alt="logo" class="logo" src={electronLogo} />
<div class="creator">Powered by electron-vite</div>
<div class="text">
  Build an Electron app with
  <span class="svelte">Svelte</span>
  and
  <span class="ts">TypeScript</span>
</div>
<p class="tip">Please try pressing <code>F12</code> to open the devTool</p>
<div class="actions">
  <div class="action">
    <a href="https://electron-vite.org/" target="_blank" rel="noreferrer">Documentation</a>
  </div>
  <div class="action">
    <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions a11y-missing-attribute-->
    <a target="_blank" rel="noreferrer" on:click={ipcHandle}>Send IPC</a>
  </div>
</div>
<Versions />
