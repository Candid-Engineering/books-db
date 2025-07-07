import { describe, it, expect, beforeEach } from 'vitest'
import { mockIPC } from '@tauri-apps/api/mocks'
import { KeychainTokenStorage, type TokenStorage } from './token-storage'

describe('KeychainTokenStorage', () => {
  const storage: TokenStorage = new KeychainTokenStorage()
  let storedTokens: Record<string, string> = {}

  beforeEach(() => {
    storedTokens = {}
    
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
  })

  describe('when no token is stored', () => {
    it('should return null for default namespace', async () => {
      const token = await storage.getToken()
      expect(token).toBeNull()
    })

    it('should return null for custom namespace', async () => {
      const token = await storage.getToken('refresh')
      expect(token).toBeNull()
    })
  })

  describe('when token is stored', () => {
    const testToken = 'stored_token_123'

    beforeEach(async () => {
      await storage.setToken(testToken)
    })

    it('should return the stored token', async () => {
      const token = await storage.getToken()
      expect(token).toBe(testToken)
    })

    describe('after clearing token', () => {
      beforeEach(async () => {
        await storage.clearToken()
      })

      it('should return null', async () => {
        const token = await storage.getToken()
        expect(token).toBeNull()
      })
    })
  })

  describe('with custom namespace', () => {
    const testToken = 'refresh_token_456'
    const namespace = 'refresh'

    beforeEach(async () => {
      await storage.setToken(testToken, namespace)
    })

    it('should store and retrieve token', async () => {
      const token = await storage.getToken(namespace)
      expect(token).toBe(testToken)
    })

    it('should not affect default namespace', async () => {
      const defaultToken = await storage.getToken()
      expect(defaultToken).toBeNull()
    })

    describe('after clearing namespace', () => {
      beforeEach(async () => {
        await storage.clearToken(namespace)
      })

      it('should return null for that namespace', async () => {
        const token = await storage.getToken(namespace)
        expect(token).toBeNull()
      })
    })
  })

  describe('error handling', () => {
    // TODO: Add tests for specific keyring error scenarios once we understand what errors the plugin throws
    it.todo('should handle keychain access denied errors')
    it.todo('should handle keychain locked errors')
    it.todo('should throw meaningful error when setToken fails due to permissions')
    it.todo('should handle platform-specific keychain errors')
  })
})