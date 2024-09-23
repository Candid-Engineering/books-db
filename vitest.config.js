import { defineConfig } from 'vitest/config'
import { svelte } from '@sveltejs/vite-plugin-svelte'

export default defineConfig({
  plugins: [svelte()],
  test: {
    diff: './vitest.diff.ts',
    environment: 'jsdom'
  }
})
