<script lang="ts">
  import 'bulma/css/bulma.css'
  import onScan from 'onscan.js'

  import BooksTable, { type Book } from './components/BooksTable.svelte'
  import Versions from './components/Versions.svelte'
  import electronLogo from './assets/electron.svg'
  import { onDestroy } from 'svelte'

  const ipcHandle = (): void => window.electron.ipcRenderer.send('ping')
  let books: Book[] = [
    {
      isbn: 12345,
      title: 'Hunting Prince Dracula',
      genre: 'Young Adult',
      author: 'Kerri Maniscalco',
      is_read: false
    }
  ]

  const addBook = (isbn: number): void => {
    books = [...books, { isbn: isbn }]
  }

  const handleScan = (event: { detail: { scanCode: string } }): void => {
    const isbn = parseInt(event.detail.scanCode, 10)
    addBook(isbn)
  }

  onScan.attachTo(document)
  onDestroy(() => {
    onScan.detachFrom(document)
  })
</script>

<svelte:document on:scan={handleScan} />
<BooksTable {books} />

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
