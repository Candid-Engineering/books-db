import db from '$lib/db'
import * as orm from 'drizzle-orm'
import * as schema from '$lib/drizzle/schema'

// svelte-kit is meant for a server/client apps with svelte-kit as the backend
// server as well (like nuxt or next.js). These settings help make it client-only.
export const prerender = true
export const ssr = false

// make the types happy w/ window exports.
declare global {
  interface Window {
    db: typeof db
    schema: typeof schema
    orm: typeof orm
  }
}

export function load() {
  // exported just for ease of debugging. Remove if we don't find it useful over time.
  window.db = db
  window.schema = schema
  window.orm = orm
}
