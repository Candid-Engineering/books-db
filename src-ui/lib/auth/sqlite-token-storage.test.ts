import { describe, it, expect, beforeEach } from 'vitest'
import { SqliteTokenStorage } from './token-storage'
import type { TokenStorage } from './token-storage'
import { testDb } from '../../testing/db-setup'

describe('SqliteTokenStorage', () => {
  let storage: TokenStorage

  beforeEach(() => {
    storage = new SqliteTokenStorage(testDb.drizzle)
  })

  describe('when no token is stored', () => {
    it('should return null for default namespace', async () => {
      expect(await storage.getToken()).toBeNull()
    })

    it('should return null for custom namespace', async () => {
      expect(await storage.getToken('refresh')).toBeNull()
    })
  })

  describe('when token is stored', () => {
    const testToken = 'stored_token_123'

    beforeEach(async () => {
      await storage.setToken(testToken)
    })

    it('should return the stored token', async () => {
      expect(await storage.getToken()).toBe(testToken)
    })

    describe('after clearing token', () => {
      beforeEach(async () => {
        await storage.clearToken()
      })

      it('should return null', async () => {
        expect(await storage.getToken()).toBeNull()
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
      expect(await storage.getToken(namespace)).toBe(testToken)
    })

    it('should not affect default namespace', async () => {
      expect(await storage.getToken()).toBeNull()
    })

    describe('after clearing namespace', () => {
      beforeEach(async () => {
        await storage.clearToken(namespace)
      })

      it('should return null for that namespace', async () => {
        expect(await storage.getToken(namespace)).toBeNull()
      })
    })
  })

  it('should overwrite an existing token for the same namespace', async () => {
    await storage.setToken('first', 'refresh')
    await storage.setToken('second', 'refresh')
    expect(await storage.getToken('refresh')).toBe('second')
  })
})
