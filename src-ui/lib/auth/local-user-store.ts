import type { SqliteRemoteDatabase } from 'drizzle-orm/sqlite-proxy'
import realDb from '$lib/db/index.js'
import * as schema from '$lib/db/schema'
import type { User } from './auth-store.svelte'

const SINGLETON_KEY = 1

export interface LocalUserStore {
  get(): Promise<User | null>
  set(user: User): Promise<void>
  clear(): Promise<void>
}

export class DrizzleLocalUserStore implements LocalUserStore {
  constructor(private db: SqliteRemoteDatabase<typeof schema>) {}

  async get(): Promise<User | null> {
    const [row] = await this.db.query.localUser.findMany()
    if (!row) return null
    return { id: row.id, email: row.email, name: row.name }
  }

  async set(user: User): Promise<void> {
    await this.db
      .insert(schema.localUser)
      .values({ singleton: SINGLETON_KEY, id: user.id, email: user.email, name: user.name })
      .onConflictDoUpdate({
        target: schema.localUser.singleton,
        set: { id: user.id, email: user.email, name: user.name, updatedAt: new Date() },
      })
  }

  async clear(): Promise<void> {
    await this.db.delete(schema.localUser)
  }
}

let localUserStore: LocalUserStore
export function getLocalUserStore(): LocalUserStore {
  if (localUserStore === undefined) {
    localUserStore = new DrizzleLocalUserStore(realDb)
  }
  return localUserStore
}
