import { KeychainTokenStorage, type TokenStorage } from './token-storage'
import { getLocalUserStore, type LocalUserStore } from './local-user-store'
import * as authApi from './auth-api'
import { AuthApiError, type AuthTokenResult } from './auth-api'

export interface User {
  id: string
  email: string
  name: string
}

export interface AuthState {
  isAuthenticated: boolean
  user: User | null
  isLoading: boolean
  error: string | null
}

interface StoredAuthToken {
  token: string
  expiresAt: number
}

function isStoredAuthToken(value: unknown): value is StoredAuthToken {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as StoredAuthToken).token === 'string' &&
    typeof (value as StoredAuthToken).expiresAt === 'number'
  )
}

export interface AuthStore {
  // Reactive state (Svelte 5 runes)
  readonly state: AuthState
  
  // Authentication actions
  requestLoginLink(email: string): Promise<void>
  exchangeLoginToken(loginToken: string): Promise<void>
  logout(): Promise<void>
  
  // Token management
  getAuthToken(): Promise<string | null>
  refreshAuthToken(): Promise<string>
  
  // Initialization
  initialize(): Promise<void>
}

class AuthStoreImpl implements AuthStore {
  private tokenStorage: TokenStorage
  private localUserStore: LocalUserStore
  private authState = $state<AuthState>({
    isAuthenticated: false,
    user: null,
    isLoading: false,
    error: null
  })

  constructor(
    tokenStorage: TokenStorage = new KeychainTokenStorage(),
    localUserStore: LocalUserStore = getLocalUserStore()
  ) {
    this.tokenStorage = tokenStorage
    this.localUserStore = localUserStore
  }

  get state(): AuthState {
    return this.authState
  }

  async logout(): Promise<void> {
    await this.tokenStorage.clearToken('refresh')
    await this.tokenStorage.clearToken('auth')
    this.authState.isAuthenticated = false
    this.authState.user = null
    this.authState.error = null
  }

  async requestLoginLink(email: string): Promise<void> {
    throw new Error('requestLoginLink not implemented yet')
  }

  async exchangeLoginToken(loginToken: string): Promise<void> {
    throw new Error('exchangeLoginToken not implemented yet')
  }

  async getAuthToken(): Promise<string | null> {
    const storedAuth = await this.tokenStorage.getToken('auth')
    if (storedAuth) {
      try {
        const parsed: unknown = JSON.parse(storedAuth)
        if (!isStoredAuthToken(parsed)) {
          throw new SyntaxError('Stored auth token has an unexpected shape')
        }
        const { token, expiresAt } = parsed

        // Check if token expires within 5 minutes (refresh buffer)
        const refreshBuffer = 5 * 60 * 1000
        if (Date.now() + refreshBuffer < expiresAt) {
          return token
        }

        // Token expired or expiring soon, try to refresh
        const refreshToken = await this.tokenStorage.getToken('refresh')
        if (refreshToken) {
          return await this.refreshAuthToken()
        }

        // No refresh token, clear expired auth token
        await this.tokenStorage.clearToken('auth')
        return null
      } catch (error) {
        if (!(error instanceof SyntaxError)) {
          throw error
        }
        // Invalid JSON or unexpected shape, treat as expired
        await this.tokenStorage.clearToken('auth')
      }
    }

    // No auth token, try to refresh if we have a refresh token
    const refreshToken = await this.tokenStorage.getToken('refresh')
    if (refreshToken) {
      return await this.refreshAuthToken()
    }

    return null
  }

  async refreshAuthToken(): Promise<string> {
    const refreshToken = await this.tokenStorage.getToken('refresh')
    if (!refreshToken) {
      throw new Error('No refresh token available')
    }

    try {
      const result = await authApi.exchangeRefreshTokenForAuthToken(refreshToken)
      return await this.applyAuthTokenResult(result)
    } catch (error) {
      if (error instanceof AuthApiError) {
        // The refresh token itself is invalid/expired/wrong type/not found — force a full logout.
        await this.logout()
      }
      throw error
    }
  }

  private async applyAuthTokenResult(result: AuthTokenResult): Promise<string> {
    const storedAuthToken: StoredAuthToken = {
      token: result.authToken,
      expiresAt: Date.now() + result.expiresIn * 1000
    }
    await this.tokenStorage.setToken(JSON.stringify(storedAuthToken), 'auth')
    await this.localUserStore.set(result.user)

    this.authState.isAuthenticated = true
    this.authState.user = result.user

    return result.authToken
  }

  async initialize(): Promise<void> {
    throw new Error('initialize not implemented yet')
  }
}

export const authStore: AuthStore = new AuthStoreImpl()

export function createTestAuthStore(tokenStorage: TokenStorage, localUserStore: LocalUserStore): AuthStore {
  return new AuthStoreImpl(tokenStorage, localUserStore)
}