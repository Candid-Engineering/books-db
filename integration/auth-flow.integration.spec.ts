import { describe, it, expect, beforeEach } from 'vitest'
import { setupMockKeyring } from '../src-ui/testing/mock-keyring'
import { testDb } from '../src-ui/testing/db-setup'
import { KeychainTokenStorage } from '$lib/auth/token-storage'
import { DrizzleLocalUserStore } from '$lib/auth/local-user-store'
import { createTestAuthStore, type AuthStore } from '$lib/auth/auth-store.svelte'
import { createFactory, fetchLoginToken } from './rails-integration-client'

describe('auth flow against a real Rails server', () => {
  let tokenStorage: KeychainTokenStorage
  let authStore: AuthStore

  beforeEach(() => {
    setupMockKeyring()
    tokenStorage = new KeychainTokenStorage()
    authStore = createTestAuthStore(tokenStorage, new DrizzleLocalUserStore(testDb.drizzle))
  })

  describe('with a valid login token', () => {
    it('should authenticate with the real user returned by Rails', async () => {
      const email = `reader-${Date.now()}@example.com`
      await createFactory('user', { email, name: 'Ada Reader' })
      const loginToken = await fetchLoginToken(email)

      await authStore.exchangeLoginToken(loginToken)

      expect(authStore.state.isAuthenticated).toBe(true)
      expect(authStore.state.user).toMatchObject({ email, name: 'Ada Reader' })
      expect(await tokenStorage.getToken('refresh')).not.toBeNull()
      expect(await authStore.getAuthToken()).not.toBeNull()
    })
  })

  describe('with an invalid login token', () => {
    it("should surface Rails' real error message", async () => {
      await authStore.exchangeLoginToken('garbage-token')

      expect(authStore.state.error).toBe('Token is invalid or malformed')
      expect(authStore.state.isAuthenticated).toBe(false)
    })
  })
})
