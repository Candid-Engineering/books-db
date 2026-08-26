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

function mockRefreshTokenSuccess(overrides: { token?: string } = {}) {
  mockServer.use(
    http.post(`${BASE_URL}/tokens/refresh`, () => {
      return HttpResponse.json(
        {
          token: overrides.token ?? 'refresh-token-abc',
          token_type: 'refresh',
          expires_in: 31536000,
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

  describe('when requesting a login link', () => {
    describe('with a registered email', () => {
      beforeEach(() => {
        mockServer.use(
          http.post(`${BASE_URL}/tokens/request_login_link`, () => {
            return HttpResponse.json({}, { status: 201 })
          })
        )
      })

      it('should resolve without error', async () => {
        await authStore.requestLoginLink('reader@example.com')
        expect(authStore.state.error).toBeNull()
      })
    })

    describe('with an unregistered email', () => {
      beforeEach(() => {
        mockServer.use(
          http.post(`${BASE_URL}/tokens/request_login_link`, () => {
            return HttpResponse.json({ error: 'No such user' }, { status: 422 })
          })
        )
      })

      it('should not throw', async () => {
        await expect(authStore.requestLoginLink('nobody@example.com')).resolves.toBeUndefined()
      })

      it('should set an error', async () => {
        await authStore.requestLoginLink('nobody@example.com')
        expect(authStore.state.error).toBe('No such user')
      })
    })
  })

  describe('when registering', () => {
    describe('with a new email', () => {
      beforeEach(() => {
        mockServer.use(
          http.post(`${BASE_URL}/users`, () => {
            return HttpResponse.json(
              { user: { id: 'user-1', name: 'Ada Reader', email: 'reader@example.com' } },
              { status: 201 }
            )
          })
        )
      })

      it('should resolve without error', async () => {
        await authStore.register('reader@example.com', 'Ada Reader')
        expect(authStore.state.error).toBeNull()
      })
    })

    describe('with an already-registered email', () => {
      beforeEach(() => {
        mockServer.use(
          http.post(`${BASE_URL}/users`, () => {
            return HttpResponse.json({ email: ['has already been taken'] }, { status: 422 })
          })
        )
      })

      it('should not throw', async () => {
        await expect(authStore.register('reader@example.com', 'Ada Reader')).resolves.toBeUndefined()
      })

      it('should set an error', async () => {
        await authStore.register('reader@example.com', 'Ada Reader')
        expect(authStore.state.error).toBe('Email has already been taken')
      })
    })
  })

  describe('when exchanging a login token', () => {
    describe('with a valid login token', () => {
      beforeEach(() => {
        mockRefreshTokenSuccess()
        mockAuthTokenSuccess()
      })

      it('should store the refresh token', async () => {
        await authStore.exchangeLoginToken('login-token-123')
        expect(await tokenStorage.getToken('refresh')).toBe('refresh-token-abc')
      })

      it('should store the auth token', async () => {
        await authStore.exchangeLoginToken('login-token-123')
        const storedAuth = await tokenStorage.getToken('auth')
        expect(storedAuth && JSON.parse(storedAuth)).toMatchObject({ token: 'new-auth-token-789' })
      })

      it('should authenticate with the returned user', async () => {
        await authStore.exchangeLoginToken('login-token-123')
        expect(authStore.state.isAuthenticated).toBe(true)
        expect(authStore.state.user).toEqual({
          id: 'user-1',
          name: 'Ada Reader',
          email: 'reader@example.com',
        })
      })
    })

    describe('with an invalid or expired login token', () => {
      beforeEach(() => {
        mockServer.use(
          http.post(`${BASE_URL}/tokens/refresh`, () => {
            return HttpResponse.json(
              { errors: [{ code: 'token_invalid', message: 'Token is invalid or malformed' }] },
              { status: 400 }
            )
          })
        )
      })

      it('should not throw', async () => {
        await expect(authStore.exchangeLoginToken('garbage')).resolves.toBeUndefined()
      })

      it('should set an error and remain unauthenticated', async () => {
        await authStore.exchangeLoginToken('garbage')
        expect(authStore.state.error).toBe('Token is invalid or malformed')
        expect(authStore.state.isAuthenticated).toBe(false)
      })

      it('should not persist a refresh token', async () => {
        await authStore.exchangeLoginToken('garbage')
        expect(await tokenStorage.getToken('refresh')).toBeNull()
      })
    })
  })

  describe('when logging out', () => {
    let localUserStore: DrizzleLocalUserStore

    beforeEach(async () => {
      // Setup: user has tokens and a cached user stored
      await tokenStorage.setToken('refresh-token-123', 'refresh')
      await tokenStorage.setToken('auth-token-456', 'auth')
      localUserStore = new DrizzleLocalUserStore(testDb.drizzle)
      await localUserStore.set({ id: 'user-1', name: 'Ada Reader', email: 'reader@example.com' })
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

    it('should clear the cached local user', async () => {
      await authStore.logout()
      expect(await localUserStore.get()).toBeNull()
    })
  })

  describe('when initializing', () => {
    describe('with no stored refresh token', () => {
      it('should remain unauthenticated', async () => {
        await authStore.initialize()
        expect(authStore.state.isAuthenticated).toBe(false)
        expect(authStore.state.user).toBeNull()
      })

      it('should leave isLoading false once done', async () => {
        await authStore.initialize()
        expect(authStore.state.isLoading).toBe(false)
      })
    })

    describe('with a stored refresh token and a cached user', () => {
      beforeEach(async () => {
        await tokenStorage.setToken('refresh-token-123', 'refresh')
        await new DrizzleLocalUserStore(testDb.drizzle).set({
          id: 'cached-user',
          name: 'Cached Reader',
          email: 'cached@example.com',
        })
      })

      describe('when the refresh token is still valid', () => {
        beforeEach(() => {
          mockAuthTokenSuccess()
        })

        it('should end authenticated with the revalidated user', async () => {
          await authStore.initialize()
          expect(authStore.state.isAuthenticated).toBe(true)
          expect(authStore.state.user).toEqual({
            id: 'user-1',
            name: 'Ada Reader',
            email: 'reader@example.com',
          })
        })
      })

      describe('when the refresh token has been revoked', () => {
        beforeEach(() => {
          mockServer.use(
            http.post(`${BASE_URL}/tokens/auth`, () => {
              return HttpResponse.json(
                { errors: [{ code: 'token_not_found', message: 'Token user not found' }] },
                { status: 400 }
              )
            })
          )
        })

        it('should end logged out', async () => {
          await authStore.initialize()
          expect(authStore.state.isAuthenticated).toBe(false)
          expect(await tokenStorage.getToken('refresh')).toBeNull()
        })

        it('should clear the stale cached user', async () => {
          await authStore.initialize()
          expect(await new DrizzleLocalUserStore(testDb.drizzle).get()).toBeNull()
        })
      })
    })
  })
})
