import { getPassword, setPassword, deletePassword } from 'tauri-plugin-keyring-api'

export interface TokenStorage {
  getToken(namespace?: string): Promise<string | null>
  setToken(token: string, namespace?: string): Promise<void>
  clearToken(namespace?: string): Promise<void>
}

const DEFAULT_NAMESPACE = 'token'

export class KeychainTokenStorage implements TokenStorage {
  private static readonly SERVICE_NAME = 'books-db'

  private getKey(namespace?: string): string {
    return namespace || DEFAULT_NAMESPACE
  }

  async getToken(namespace?: string): Promise<string | null> {
    const key = this.getKey(namespace)
    try {
      return await getPassword(KeychainTokenStorage.SERVICE_NAME, key)
    } catch {
      // TODO: Handle specific error types once we understand what the keyring plugin throws
      return null
    }
  }

  async setToken(token: string, namespace?: string): Promise<void> {
    const key = this.getKey(namespace)
    try {
      await setPassword(KeychainTokenStorage.SERVICE_NAME, key, token)
    } catch {
      // TODO: Handle specific error types once we understand what the keyring plugin throws
      throw new Error('Failed to store token securely. Please check your system keychain access.')
    }
  }

  async clearToken(namespace?: string): Promise<void> {
    const key = this.getKey(namespace)
    try {
      await deletePassword(KeychainTokenStorage.SERVICE_NAME, key)
    } catch {
      // TODO: Handle specific error types once we understand what the keyring plugin throws
      // For now, ignore errors when deleting (key might not exist)
    }
  }
}

// TODO: Could implement alternative TokenStorage implementations like SqliteTokenStorage
// as fallback mechanisms when Keychain is unavailable