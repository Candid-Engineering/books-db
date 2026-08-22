import { describe, it, expect, beforeEach } from 'vitest'
import type { SqliteRemoteDatabase } from 'drizzle-orm/sqlite-proxy'
import * as schema from '$lib/db/schema'
import { createTestDB } from '$lib/db/test_helpers.js'
import { DrizzleLocalUserStore, type LocalUserStore } from './local-user-store'
import type { User } from './auth-store.svelte'

describe('DrizzleLocalUserStore', () => {
  let db: SqliteRemoteDatabase<typeof schema>
  let store: LocalUserStore

  const user: User = { id: 'user-1', email: 'reader@example.com', name: 'Ada Reader' }

  beforeEach(async () => {
    ;({ drizzle: db } = await createTestDB())
    store = new DrizzleLocalUserStore(db)
  })

  describe('when no user is cached', () => {
    it('should return null', async () => {
      expect(await store.get()).toBeNull()
    })
  })

  describe('when a user is cached', () => {
    beforeEach(async () => {
      await store.set(user)
    })

    it('should return the cached user', async () => {
      expect(await store.get()).toEqual(user)
    })

    describe('when set again with a different user', () => {
      const otherUser: User = { id: 'user-2', email: 'other@example.com', name: 'Bea Reader' }

      beforeEach(async () => {
        await store.set(otherUser)
      })

      it('should replace the cached user rather than storing a second row', async () => {
        expect(await store.get()).toEqual(otherUser)
      })
    })

    describe('after clearing', () => {
      beforeEach(async () => {
        await store.clear()
      })

      it('should return null', async () => {
        expect(await store.get()).toBeNull()
      })
    })
  })
})
