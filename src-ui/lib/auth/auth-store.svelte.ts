import { KeychainTokenStorage, type TokenStorage } from './token-storage'

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

export interface AuthTokens {
  refreshToken: string
  authToken: string
  authTokenExpiresAt: number
}

export interface LoginLinkResponse {
  message: string
}

export interface TokenExchangeResponse {
  refreshToken: string
  user: User
}

export interface AuthTokenResponse {
  authToken: string
  expiresAt: number
}

class AuthStoreImpl implements AuthStore {
  private tokenStorage: TokenStorage
  private authState = $state<AuthState>({
    isAuthenticated: false,
    user: null,
    isLoading: false,
    error: null
  })

  constructor(tokenStorage: TokenStorage = new KeychainTokenStorage()) {
    this.tokenStorage = tokenStorage
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
        const authData = JSON.parse(storedAuth)
        const { token, expiresAt } = authData
        
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
      } catch {
        // Invalid JSON format, treat as expired
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
    throw new Error('refreshAuthToken not implemented yet')
  }

  async initialize(): Promise<void> {
    throw new Error('initialize not implemented yet')
  }
}

export const authStore: AuthStore = new AuthStoreImpl()