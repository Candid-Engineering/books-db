import db from '$lib/db'
import * as orm from 'drizzle-orm'
import * as schema from '$lib/db/schema'
import * as fs from '@tauri-apps/plugin-fs'
import { commands } from '$lib/generated/sqlite_proxy'

declare global {
  interface Window {
    db: typeof db
    schema: typeof schema
    orm: typeof orm
    fs: typeof fs
    sqlite: typeof commands
  }
}

window.db = db
window.schema = schema
window.orm = orm
window.fs = fs
window.sqlite = commands