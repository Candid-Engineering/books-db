import { describe, it, expect, vi, beforeEach } from 'vitest'
import { checkForUpdatesAndPrompt } from './updater'
import { errorToast } from './error-toast.svelte'

vi.mock('@tauri-apps/plugin-updater', () => ({ check: vi.fn() }))
vi.mock('@tauri-apps/plugin-process', () => ({ relaunch: vi.fn() }))
vi.mock('@tauri-apps/plugin-dialog', () => ({ ask: vi.fn(), message: vi.fn() }))

import { check, type Update } from '@tauri-apps/plugin-updater'
import { relaunch } from '@tauri-apps/plugin-process'
import { ask, message } from '@tauri-apps/plugin-dialog'

function mockUpdate(downloadAndInstall: () => Promise<void>): Update {
  return { version: '1.2.3', downloadAndInstall } as unknown as Update
}

describe('checkForUpdatesAndPrompt', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    errorToast.dismiss()
  })

  it('stays quiet when up to date and not asked to notify', async () => {
    vi.mocked(check).mockResolvedValue(null)

    await checkForUpdatesAndPrompt()

    expect(message).not.toHaveBeenCalled()
  })

  it('confirms up-to-date when notifyIfUpToDate is set', async () => {
    vi.mocked(check).mockResolvedValue(null)

    await checkForUpdatesAndPrompt({ notifyIfUpToDate: true })

    expect(message).toHaveBeenCalledWith("You're on the latest version.", expect.anything())
  })

  it('installs and relaunches when an update is accepted', async () => {
    const downloadAndInstall = vi.fn().mockResolvedValue(undefined)
    vi.mocked(check).mockResolvedValue(mockUpdate(downloadAndInstall))
    vi.mocked(ask).mockResolvedValue(true)

    await checkForUpdatesAndPrompt()

    expect(downloadAndInstall).toHaveBeenCalled()
    expect(relaunch).toHaveBeenCalled()
  })

  it('does not install when the update is declined', async () => {
    const downloadAndInstall = vi.fn()
    vi.mocked(check).mockResolvedValue(mockUpdate(downloadAndInstall))
    vi.mocked(ask).mockResolvedValue(false)

    await checkForUpdatesAndPrompt()

    expect(downloadAndInstall).not.toHaveBeenCalled()
    expect(relaunch).not.toHaveBeenCalled()
  })

  it('stays silent on a boot-time (non-notifying) check failure', async () => {
    vi.mocked(check).mockRejectedValue(new Error('network down'))

    await checkForUpdatesAndPrompt()

    expect(errorToast.message).toBeNull()
  })

  it('shows an actionable toast on a manual check failure', async () => {
    vi.mocked(check).mockRejectedValue(new Error('network down'))

    await checkForUpdatesAndPrompt({ notifyIfUpToDate: true })

    expect(errorToast.message).toMatch(/internet connection/)
  })
})
