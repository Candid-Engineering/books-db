import { defineConfig } from 'drizzle-kit'
// import { getAppDataPath } from 'appdata-path'
// import { identifier } from './src-tauri/tauri.conf.json'

export default defineConfig({
  out: './migrations/',
  dialect: 'sqlite',
  schema: './src-ui/lib/db/schema.ts',
  migrations: {
    prefix: 'timestamp',
    // table: '__drizzle_migrations__',
  },
  // dbCredentials: {
  //   url: '',
  // },
})
