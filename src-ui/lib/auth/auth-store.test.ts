import { describe, it, expect, beforeEach } from 'vitest'
import { http, HttpResponse } from 'msw'
import { mockServer } from '../../testing/msw-setup'
import { setupMockKeyring } from '../../testing/mock-keyring'
import { KeychainTokenStorage } from './token-storage'
import { DrizzleLocalUserStore } from './local-user-store'
import { createTestAuthStore, type AuthStore } from './auth-store.svelte'
import { testDb } from '../../testing/db-setup'

const BASE_URL = 'http://localhost:3000'

function mockAuthTokenSuccess(overrides: { token?: string; user?: Record<string, string> } = {}) {
  mockServer.use(
    http.post(`${BASE_URL}/tokens/auth`, () => {
      return HttpResponse.json(
        {
          token: overrides.token ?? 'new-auth-token-789',
          token_type: 'auth',
          expires_in: 900,
          user: {
            id: 'user-1',
            name: 'Ada Reader',
            email: 'reader@example.com',
            ...overrides.user,
          },
        },
        { status: 201 }
      )
    })
  )
}

describe('AuthStore', () => {
  let tokenStorage: KeychainTokenStorage
  let authStore: AuthStore

  beforeEach(() => {
    setupMockKeyring()
    tokenStorage = new KeychainTokenStorage()
    authStore = createTestAuthStore(tokenStorage, new DrizzleLocalUserStore(testDb.drizzle))
  })

  describe('when created', () => {
    it('should have unauthenticated initial state', () => {
      expect(authStore.state.isAuthenticated).toBe(false)
      expect(authStore.state.user).toBeNull()
      expect(authStore.state.isLoading).toBe(false)
      expect(authStore.state.error).toBeNull()
    })
  })

  describe('when checking for existing auth', () => {
    describe('with no stored tokens', () => {
      it('should return null for auth token', async () => {
        expect(await authStore.getAuthToken()).toBeNull()
      })
    })

    describe('with valid stored auth token', () => {
      beforeEach(async () => {
        const futureExpiry = Date.now() + 10 * 60 * 1000 // 10 minutes from now
        const authData = JSON.stringify({
          token: 'auth-token-456',
          expiresAt: futureExpiry
        })
        await tokenStorage.setToken(authData, 'auth')
      })

      it('should return the stored auth token', async () => {
        expect(await authStore.getAuthToken()).toBe('auth-token-456')
      })
    })

    describe('with expired stored auth token', () => {
      beforeEach(async () => {
        const pastExpiry = Date.now() - 60 * 1000 // 1 minute ago
        const authData = JSON.stringify({
          token: 'expired-auth-token',
          expiresAt: pastExpiry
        })
        await tokenStorage.setToken(authData, 'auth')
        await tokenStorage.setToken('refresh-token-123', 'refresh')
        mockAuthTokenSuccess()
      })

      it('should refresh the expired token', async () => {
        expect(await authStore.getAuthToken()).toBe('new-auth-token-789')
      })

      it('should update the auth state with the refreshed user', async () => {
        await authStore.getAuthToken()
        expect(authStore.state.isAuthenticated).toBe(true)
        expect(authStore.state.user).toEqual({
          id: 'user-1',
          name: 'Ada Reader',
          email: 'reader@example.com',
        })
      })
    })

    describe('with auth token expiring soon', () => {
      beforeEach(async () => {
        const soonExpiry = Date.now() + 2 * 60 * 1000 // 2 minutes from now
        const authData = JSON.stringify({
          token: 'expiring-soon-token',
          expiresAt: soonExpiry
        })
        await tokenStorage.setToken(authData, 'auth')
        await tokenStorage.setToken('refresh-token-123', 'refresh')
        mockAuthTokenSuccess()
      })

      it('should refresh the token preemptively', async () => {
        expect(await authStore.getAuthToken()).toBe('new-auth-token-789')
      })
    })

    describe('with stored refresh token but no auth token', () => {
      beforeEach(async () => {
        await tokenStorage.setToken('refresh-token-123', 'refresh')
        mockAuthTokenSuccess()
      })

      it('should fetch a fresh auth token', async () => {
        expect(await authStore.getAuthToken()).toBe('new-auth-token-789')
      })
    })

    describe('with an invalid or expired refresh token', () => {
      beforeEach(async () => {
        await tokenStorage.setToken('refresh-token-123', 'refresh')
        mockServer.use(
          http.post(`${BASE_URL}/tokens/auth`, () => {
            return HttpResponse.json(
              { errors: [{ code: 'token_expired', message: 'Token has expired' }] },
              { status: 400 }
            )
          })
        )
      })

      it('should reject', async () => {
        await expect(authStore.getAuthToken()).rejects.toMatchObject({ code: 'token_expired' })
      })

      it('should log the user out as a side effect', async () => {
        await authStore.getAuthToken().catch(() => undefined)

        expect(await tokenStorage.getToken('refresh')).toBeNull()
        expect(await tokenStorage.getToken('auth')).toBeNull()
        expect(authStore.state.isAuthenticated).toBe(false)
      })
    })
  })

  describe('when logging out', () => {
    beforeEach(async () => {
      // Setup: user has tokens stored
      await tokenStorage.setToken('refresh-token-123', 'refresh')
      await tokenStorage.setToken('auth-token-456', 'auth')
    })

    it('should clear all stored tokens and reset auth state', async () => {
      // When: user logs out
      await authStore.logout()

      // Then: tokens should be cleared
      expect(await tokenStorage.getToken('refresh')).toBeNull()
      expect(await tokenStorage.getToken('auth')).toBeNull()

      // And: auth state should be reset
      expect(authStore.state.isAuthenticated).toBe(false)
      expect(authStore.state.user).toBeNull()
      expect(authStore.state.error).toBeNull()
    })
  })
})
