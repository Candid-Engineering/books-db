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
    throw new Error('getAuthToken not implemented yet')
  }

  async refreshAuthToken(): Promise<string> {
    throw new Error('refreshAuthToken not implemented yet')
  }

  async initialize(): Promise<void> {
    throw new Error('initialize not implemented yet')
  }
}

export const authStore: AuthStore = new AuthStoreImpl()