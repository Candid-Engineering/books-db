import { getPassword, setPassword, deletePassword } from 'tauri-plugin-keyring-api'
import type { SqliteRemoteDatabase } from 'drizzle-orm/sqlite-proxy'
import { eq } from 'drizzle-orm/sql/expressions/conditions'
import * as schema from '$lib/db/schema'

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

// Dev-only alternative to KeychainTokenStorage: unencrypted, backed by the
// dev_tokens table (see tables.ts) instead of the OS keychain. Used only
// when running via `pnpm tauri dev` (see auth-store.svelte.ts's singleton
// wiring) to avoid the OS re-prompting for keychain access on every
// unsigned, frequently-rebuilt dev binary - never used in a real build.
export class SqliteTokenStorage implements TokenStorage {
  constructor(private db: SqliteRemoteDatabase<typeof schema>) {}

  private getKey(namespace?: string): string {
    return namespace || DEFAULT_NAMESPACE
  }

  async getToken(namespace?: string): Promise<string | null> {
    const key = this.getKey(namespace)
    const [row] = await this.db.select().from(schema.devTokens).where(eq(schema.devTokens.namespace, key))
    return row?.value ?? null
  }

  async setToken(token: string, namespace?: string): Promise<void> {
    const key = this.getKey(namespace)
    await this.db
      .insert(schema.devTokens)
      .values({ namespace: key, value: token })
      .onConflictDoUpdate({ target: schema.devTokens.namespace, set: { value: token } })
  }

  async clearToken(namespace?: string): Promise<void> {
    const key = this.getKey(namespace)
    await this.db.delete(schema.devTokens).where(eq(schema.devTokens.namespace, key))
  }
}