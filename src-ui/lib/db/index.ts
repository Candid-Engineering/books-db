import { drizzle } from 'drizzle-orm/sqlite-proxy'
import { commands } from '$lib/generated/sqlite_proxy'
import * as schema from '$lib/db/schema'

export const db = drizzle(
  async (sql, params, method) => {
    try {
      let res
      if (method === 'run') {
        res = await commands.execute(sql, params)
      } else {
        res = await commands.query(sql, params)
        if (res.status == 'ok') {
          return { rows: res.data.map((row) => Object.values(row)) }
        }
      }
      if (res.status === 'error') {
        console.error('Failed to execute query. Error: ', res.error)
      }
    } catch (e: unknown) {
      console.error('Error from sqlite proxy server: ', e)
    }
    return { rows: [] }
  },
  { schema: schema }
)

export default db
