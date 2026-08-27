import { describe, it, expect, beforeEach } from 'vitest'
import { setupMockKeyring } from '../src-ui/testing/mock-keyring'
import { testDb } from '../src-ui/testing/db-setup'
import { createTestDB } from '$lib/db/test_helpers'
import { KeychainTokenStorage } from '$lib/auth/token-storage'
import { DrizzleLocalUserStore } from '$lib/auth/local-user-store'
import { createTestAuthStore, type AuthStore } from '$lib/auth/auth-store.svelte'
import { createTestBooksStore } from '$lib/state/Books.svelte'
import { SyncEngine } from '$lib/sync/sync-engine'
import { createFactory, fetchLoginToken } from './rails-integration-client'

describe('sync flow against a real Rails server', () => {
  let authStore: AuthStore

  beforeEach(async () => {
    setupMockKeyring()
    const tokenStorage = new KeychainTokenStorage()
    authStore = createTestAuthStore(tokenStorage, new DrizzleLocalUserStore(testDb.drizzle))

    const email = `sync-reader-${crypto.randomUUID()}@example.com`
    await createFactory('user', { email, name: 'Sync Reader' })
    const loginToken = await fetchLoginToken(email)
    await authStore.exchangeLoginToken(loginToken)
  })

  it('round-trips a new book, tag, and author from one device to another', async () => {
    const deviceABooksStore = createTestBooksStore(testDb.drizzle)
    const deviceASync = new SyncEngine(testDb.drizzle, deviceABooksStore, () =>
      authStore.getAuthToken()
    )

    const bookId = await deviceABooksStore.add({
      title: 'Dune',
      isbn13: '9780441172719',
    })
    const book = deviceABooksStore.value.find((b) => b.id === bookId)!
    await deviceABooksStore.updateTags(book, ['Science Fiction'])
    await deviceABooksStore.updateAuthors(book, ['Frank Herbert'])

    await deviceASync.push()

    // A second, independent local DB signed in as the same user - simulates
    // a second device pulling down what the first just pushed.
    const deviceB = await createTestDB()
    const deviceBBooksStore = createTestBooksStore(deviceB.drizzle)
    const deviceBSync = new SyncEngine(deviceB.drizzle, deviceBBooksStore, () =>
      authStore.getAuthToken()
    )

    await deviceBSync.pull()

    const pulledBook = deviceBBooksStore.value.find((b) => b.id === bookId)
    expect(pulledBook).toBeDefined()
    expect(pulledBook?.title).toBe('Dune')
    expect(pulledBook?.tags.map((t) => t.name)).toContain('Science Fiction')
    expect(pulledBook?.authors.map((a) => a.name)).toContain('Frank Herbert')
  })

  it('round-trips a deletion as a tombstone', async () => {
    const deviceABooksStore = createTestBooksStore(testDb.drizzle)
    const deviceASync = new SyncEngine(testDb.drizzle, deviceABooksStore, () =>
      authStore.getAuthToken()
    )

    const bookId = await deviceABooksStore.add({ title: 'Dune Messiah' })
    await deviceASync.push()

    await deviceABooksStore.remove(bookId)
    await deviceASync.push()

    const deviceB = await createTestDB()
    const deviceBBooksStore = createTestBooksStore(deviceB.drizzle)
    const deviceBSync = new SyncEngine(deviceB.drizzle, deviceBBooksStore, () =>
      authStore.getAuthToken()
    )

    await deviceBSync.pull()

    expect(deviceBBooksStore.value.find((b) => b.id === bookId)).toBeUndefined()
  })
})
