import { check } from '@tauri-apps/plugin-updater'
import { relaunch } from '@tauri-apps/plugin-process'
import { ask, message } from '@tauri-apps/plugin-dialog'
import { reportError } from './error-reporting'
import { errorToast } from './error-toast.svelte'

interface CheckForUpdatesOptions {
  // Boot-time checks stay quiet when there's nothing to report; a user-triggered
  // "Check for Updates" button should confirm it actually did something.
  notifyIfUpToDate?: boolean
}

// Orchestration over Tauri plugin calls (check/ask/downloadAndInstall/relaunch),
// same category as the Settings page's Export/Import/Reset handlers - not unit
// tested, verified manually.
export async function checkForUpdatesAndPrompt(options: CheckForUpdatesOptions = {}): Promise<void> {
  try {
    const update = await check()
    if (!update) {
      if (options.notifyIfUpToDate) {
        await message("You're on the latest version.", { title: 'No updates available' })
      }
      return
    }

    const shouldInstall = await ask(`Version ${update.version} is available. Install now?`, {
      title: 'Update available',
      kind: 'info',
    })
    if (!shouldInstall) return

    await update.downloadAndInstall()
    await relaunch()
  } catch (error) {
    reportError(error, 'check-for-updates')
    errorToast.show('Could not check for updates. Please try again.')
  }
}
