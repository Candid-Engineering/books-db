import { confirm } from '@tauri-apps/plugin-dialog'
import { relaunch } from '@tauri-apps/plugin-process'
import { commands as sqliteProxy } from '$lib/generated/sqlite_proxy'
import { authStore } from '$lib/auth/auth-store.svelte'
import { hasUnsyncedData } from '$lib/sync/sync-engine'
import realDb from '$lib/db'
import { reportError } from '$lib/error-reporting'
import { errorToast } from '$lib/error-toast.svelte'

// Every local table is scoped to the signed-in account (see the cross-account
// data leak this replaced: local books/tags/sync cursors used to survive a
// logout, so a second account signing in on the same device would see the
// first account's catalog). Wiping the whole local database - rather than
// deleting rows table by table - guarantees nothing new gets missed later.
export async function signOut(): Promise<void> {
  if (await hasUnsyncedData(realDb)) {
    const confirmed = await confirm(
      "You have changes that haven't finished syncing. Logging out now will lose them permanently. Continue?",
      { title: 'Unsynced changes', kind: 'warning' }
    )
    if (!confirmed) return
  }

  await wipeLocalDataAndRelaunch('sign-out', 'Could not fully sign out. Please try again.')
}

// Shared with Settings' "Reset App Data" button, which does its own
// (stronger, unconditional) confirmation before calling this.
export async function wipeLocalDataAndRelaunch(
  context: string,
  failureMessage: string
): Promise<void> {
  try {
    await authStore.logout()
    const result = await sqliteProxy.factoryReset()
    if (result.status === 'error') {
      throw new Error(result.error.toString())
    }
  } catch (error) {
    reportError(error, context)
    errorToast.show(failureMessage)
    return
  }

  await relaunch()
}
