import Database from '@tauri-apps/plugin-sql'

export const prerender = true
export const ssr = false

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function load({ params }) {
  const db = await Database.load('sqlite:books-dev.db')
  window.db = db
  console.log('DB: ', db)
  return { db }
}
