import db from '$lib/db'
import * as orm from 'drizzle-orm'
import * as schema from '$lib/db/schema'
import * as fs from '@tauri-apps/plugin-fs'
import { commands } from '$lib/generated/sqlite_proxy'
import { migrate } from '$lib/db/migrator'
import { getBooksStore, type BooksStore } from '$lib/state/Books.svelte'
import { authStore, type AuthStore } from '$lib/auth/auth-store.svelte'
import { reportError } from '$lib/error-reporting'
import { errorToast } from '$lib/error-toast.svelte'
import { SyncEngine } from '$lib/sync/sync-engine'
import { checkForUpdatesAndPrompt } from '$lib/updater'

declare global {
  interface Window {
    db: typeof db
    schema: typeof schema
    orm: typeof orm
    fs: typeof fs
    sqlite: typeof commands
    booksStore: BooksStore
    authStore: AuthStore
    syncEngine: SyncEngine
  }
}

window.db = db
window.schema = schema
window.orm = orm
window.fs = fs
window.sqlite = commands

await migrate(db)
window.booksStore = getBooksStore()

await authStore.initialize()
window.authStore = authStore

const syncEngine = new SyncEngine(db, window.booksStore, () => authStore.getAuthToken())
window.syncEngine = syncEngine

async function runSync(): Promise<void> {
  if (!authStore.state.isAuthenticated) return
  try {
    await syncEngine.sync()
  } catch (error) {
    // A failed background sync isn't worth interrupting the user for - it
    // just retries next cycle. Still reported so it's visible in devtools.
    reportError(error, 'sync')
  }
}

void runSync()
setInterval(() => void runSync(), 60_000)

// Dev sessions run straight from source, not an installed/versioned build -
// there's nothing meaningful to update, so skip the boot-time check (matches
// the dev/prod split already used for TokenStorage in auth-store.svelte.ts).
if (!import.meta.env.DEV) {
  void checkForUpdatesAndPrompt()
}

window.addEventListener('error', (event) => {
  reportError(event.error, 'window.onerror')
  errorToast.show('Something went wrong')
})

window.addEventListener('unhandledrejection', (event) => {
  reportError(event.reason, 'unhandledrejection')
  errorToast.show('Something went wrong')
})
