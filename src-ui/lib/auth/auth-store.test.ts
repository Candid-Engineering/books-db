import { describe, it, expect, beforeEach } from 'vitest'
import { setupMockKeyring } from '../../testing/mock-keyring'
import { KeychainTokenStorage } from './token-storage'
import { authStore } from './auth-store.svelte'

describe('AuthStore', () => {
  let tokenStorage: KeychainTokenStorage

  beforeEach(() => {
    setupMockKeyring()
    tokenStorage = new KeychainTokenStorage()
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
      })

      it('should attempt to refresh the expired token', async () => {
        await expect(authStore.getAuthToken()).rejects.toThrow('refreshAuthToken not implemented yet')
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
      })

      it('should attempt to refresh the token preemptively', async () => {
        await expect(authStore.getAuthToken()).rejects.toThrow('refreshAuthToken not implemented yet')
      })
    })

    describe('with stored refresh token but no auth token', () => {
      beforeEach(async () => {
        await tokenStorage.setToken('refresh-token-123', 'refresh')
      })

      it('should attempt to refresh auth token', async () => {
        // This will fail until we have API layer - that's expected
        await expect(authStore.getAuthToken()).rejects.toThrow('refreshAuthToken not implemented yet')
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