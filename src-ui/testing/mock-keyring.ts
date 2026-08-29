import { mockIPC } from '@tauri-apps/api/mocks'

export function setupMockKeyring() {
  const storedTokens: Record<string, string> = {}

  mockIPC((cmd, payload) => {
    const args = payload as Record<string, string>

    switch (cmd) {
      case 'plugin:keyring|get_password': {
        const key = `${args.service}:${args.user}`
        return storedTokens[key] || null
      }
      case 'plugin:keyring|set_password': {
        const key = `${args.service}:${args.user}`
        storedTokens[key] = args.password
        return undefined
      }
      case 'plugin:keyring|delete_password': {
        const key = `${args.service}:${args.user}`
        delete storedTokens[key]
        return undefined
      }
      default:
        return Promise.reject(new Error(`Unknown command: ${cmd}`))
    }
  })
}
