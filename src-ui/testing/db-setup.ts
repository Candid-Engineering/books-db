import { beforeEach, afterEach } from 'vitest'
import { createTestDB } from '$lib/db/test_helpers.js'
import type { SqliteRemoteDatabase } from 'drizzle-orm/sqlite-proxy'
import type { Database } from 'sql.js'
import type * as schema from '$lib/db/schema'

interface TestDb {
  drizzle: SqliteRemoteDatabase<typeof schema>
  sqlite: Database
}

// Populated fresh before each test by the beforeEach hook below. Exported as a
// stable object (rather than a reassigned binding) so test files can import
// it once and always see the current test's database.
export const testDb = {} as TestDb

beforeEach(async () => {
  const fresh = await createTestDB()
  testDb.drizzle = fresh.drizzle
  testDb.sqlite = fresh.sqlite
})

afterEach(() => {
  testDb.sqlite.close()
})
