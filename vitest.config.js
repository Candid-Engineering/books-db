import { defineConfig, configDefaults } from 'vitest/config'
import { sveltekit } from '@sveltejs/kit/vite'
import { svelteTesting } from '@testing-library/svelte/vite'

export default defineConfig({
  // `svelteTesting` puts `browser` ahead of `node` in resolve.conditions so
  // Svelte's client build (with `mount`) is used, not its SSR build, and
  // registers @testing-library/svelte's DOM cleanup after each test. It only
  // inserts `browser` relative to an existing `node`, so seed that here.
  plugins: [sveltekit(), svelteTesting()],
  resolve: { conditions: ['node'] },
  test: {
    diff: './vitest.diff.ts',
    environment: 'jsdom',
    // A `vi.spyOn` in one test must not see calls from another.
    clearMocks: true,
    restoreMocks: true,
    setupFiles: [
      './src-ui/testing/msw-setup.ts',
      './src-ui/testing/db-setup.ts',
      './src-ui/testing/component-setup.ts',
    ],
    // *.integration.spec.ts files run under vitest.integration.config.ts
    // instead (real Rails server, no MSW) -- excluded here so they don't
    // also match this config's default *.spec.ts pattern.
    exclude: [...configDefaults.exclude, './integration/**/*.integration.spec.ts'],
  },
})
