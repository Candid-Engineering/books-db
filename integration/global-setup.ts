import { spawn, spawnSync, type ChildProcess } from 'child_process'
import { fileURLToPath } from 'node:url'
import kill from 'tree-kill'
import path from 'node:path'
import { isServerUp, waitForServer } from './wait-for-server'
import { TAURI_INTEGRATION_PORT, TAURI_INTEGRATION_HEALTH_URL } from './config'

const RAILS_REPO_PATH = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../../books-db-rails')
const HEALTH_URL = TAURI_INTEGRATION_HEALTH_URL

export default async function setup(): Promise<() => Promise<void>> {
  if (await isServerUp(HEALTH_URL)) {
    // Detect-or-boot: reuse a server the developer already left running
    // (e.g. `RAILS_ENV=tauri_integration bin/rails s -p 3099` in a spare
    // terminal, for fast iteration) rather than spawning a second one, and
    // don't touch it in teardown either.
    console.log(`[integration] Reusing already-running server at ${HEALTH_URL}`)
    return async () => {}
  }

  const railsBin = path.join(RAILS_REPO_PATH, 'bin', 'rails')

  console.log('[integration] Preparing the tauri_integration database...')
  const prepare = spawnSync(railsBin, ['db:tauri_integration:prepare'], { cwd: RAILS_REPO_PATH })
  if (prepare.status !== 0) {
    throw new Error(`Failed to prepare the tauri_integration database:\n${prepare.stderr?.toString() ?? ''}`)
  }

  console.log(`[integration] Booting Rails server on port ${TAURI_INTEGRATION_PORT}...`)
  const server: ChildProcess = spawn(railsBin, ['server', '-p', String(TAURI_INTEGRATION_PORT)], {
    cwd: RAILS_REPO_PATH,
    env: { ...process.env, RAILS_ENV: 'tauri_integration' },
    stdio: [null, process.stdout, process.stderr],
  })

  await waitForServer(HEALTH_URL)
  console.log('[integration] Server is healthy.')

  return async () => {
    const pid = server.pid
    if (!pid) return

    // Await the kill (unlike wdio.conf.ts's fire-and-forget tauri-driver
    // teardown) -- a lingering Puma process squatting on the port would
    // break the next run, not just this one.
    await new Promise<void>((resolve) => {
      kill(pid, 'SIGTERM', () => resolve())
    })
  }
}
