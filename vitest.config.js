import { defineConfig, configDefaults } from 'vitest/config'
import { sveltekit } from '@sveltejs/kit/vite'

export default defineConfig({
  plugins: [sveltekit()],
  test: {
    diff: './vitest.diff.ts',
    environment: 'jsdom',
    setupFiles: ['./src-ui/testing/msw-setup.ts', './src-ui/testing/db-setup.ts'],
    // *.integration.spec.ts files run under vitest.integration.config.ts
    // instead (real Rails server, no MSW) -- excluded here so they don't
    // also match this config's default *.spec.ts pattern.
    exclude: [...configDefaults.exclude, './integration/**/*.integration.spec.ts'],
  },
})
