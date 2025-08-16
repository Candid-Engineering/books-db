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
        // TODO: implement authStore.getAuthToken()
        // expect(await authStore.getAuthToken()).toBeNull()
      })
    })

    describe('with stored refresh token', () => {
      beforeEach(async () => {
        await tokenStorage.setToken('refresh-token-123', 'refresh')
      })

      it('should attempt to refresh auth token', async () => {
        // TODO: implement authStore.getAuthToken() that calls refresh
        // This will fail until we have API layer - that's expected
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