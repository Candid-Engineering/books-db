<script lang="ts">
  import { save, open, confirm } from '@tauri-apps/plugin-dialog'
  import { writeTextFile, readTextFile } from '@tauri-apps/plugin-fs'
  import { getBooksStore } from '$lib/state/Books.svelte'
  import { booksToCsv } from '$lib/csv/csv-export'
  import { csvToBooks } from '$lib/csv/csv-import'
  import { errorToast } from '$lib/error-toast.svelte'
  import { reportError } from '$lib/error-reporting'
  import { wipeLocalDataAndRelaunch } from '$lib/sign-out'
  import { checkForUpdatesAndPrompt } from '$lib/updater'
  import Button from '$lib/components/core/Button.svelte'

  const booksStore = getBooksStore()

  async function handleExport() {
    const path = await save({
      defaultPath: 'books.csv',
      filters: [{ name: 'CSV', extensions: ['csv'] }],
    })
    if (!path) return

    try {
      await writeTextFile(path, booksToCsv(booksStore.value))
    } catch (error) {
      reportError(error, 'csv-export')
      errorToast.show('Could not export your catalog. Please try again.')
    }
  }

  async function handleImport() {
    const path = await open({ filters: [{ name: 'CSV', extensions: ['csv'] }] })
    if (!path || Array.isArray(path)) return

    let content: string
    try {
      content = await readTextFile(path)
    } catch (error) {
      reportError(error, 'csv-import')
      errorToast.show('Could not read that file. Please try again.')
      return
    }

    const result = csvToBooks(content)
    if (!result.success) {
      errorToast.show(result.errors.join('\n'))
      return
    }

    for (const { book, authors, series } of result.books) {
      const bookId = await booksStore.add(book)
      if (authors.length > 0 || series.length > 0) {
        const fullBook = booksStore.value.find((b) => b.id === bookId)!
        if (authors.length > 0) await booksStore.updateAuthors(fullBook, authors)
        if (series.length > 0) await booksStore.updateSeries(fullBook, series)
      }
    }
  }

  async function handleReset() {
    const confirmed = await confirm(
      'This deletes your entire catalog and signs you out, and restarts the app. This cannot be undone.',
      { title: 'Reset app data', kind: 'warning' }
    )
    if (!confirmed) return

    await wipeLocalDataAndRelaunch(
      'reset-app-data',
      'Could not fully reset app data. Please try again.'
    )
  }

  async function handleCheckForUpdates() {
    await checkForUpdatesAndPrompt({ notifyIfUpToDate: true })
  }
</script>

<div class="container">
  <h1 class="title is-spaced is-1">Settings</h1>

  <div class="field">
    <h2 class="title is-4">Catalog</h2>
    <div class="buttons">
      <Button primary onclick={handleExport}>Export CSV</Button>
      <Button onclick={handleImport}>Import CSV</Button>
    </div>
  </div>

  <div class="field">
    <h2 class="title is-4">App</h2>
    <div class="buttons">
      <Button onclick={handleCheckForUpdates}>Check for Updates</Button>
    </div>
  </div>

  <div class="field">
    <h2 class="title is-4">Danger Zone</h2>
    <div class="buttons">
      <Button class="is-danger" onclick={handleReset}>Reset App Data</Button>
    </div>
  </div>
</div>
