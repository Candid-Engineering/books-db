import { defineConfig } from 'vitest/config'
import { sveltekit } from '@sveltejs/kit/vite'
import { TAURI_INTEGRATION_BASE_URL } from './integration/config'

export default defineConfig({
  plugins: [sveltekit()],
  test: {
    environment: 'jsdom',
    globalSetup: './integration/global-setup.ts',
    // Reuse the existing local-SQLite test harness (only the Rails leg needs
    // to be real here) -- deliberately no msw-setup.ts, since the whole
    // point of this tier is a real fetch against a real server.
    setupFiles: ['./src-ui/testing/db-setup.ts'],
    env: { VITE_API_BASE_URL: TAURI_INTEGRATION_BASE_URL },
    include: ['./integration/**/*.integration.spec.ts'],
  },
})
