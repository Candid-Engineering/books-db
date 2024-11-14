import { defineConfig } from 'vitest/config'
import { sveltekit } from '@sveltejs/kit/vite'

export default defineConfig({
  plugins: [sveltekit()],
  test: {
    diff: './vitest.diff.ts',
    environment: 'jsdom',
    setupFiles: ['./src-ui/testing/msw-setup.ts'],
  },
})
