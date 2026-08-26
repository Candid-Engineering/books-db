import { sveltekit } from '@sveltejs/kit/vite'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [sveltekit()],
  // SvelteKit's default esbuild target supports old browsers (chrome87,
  // safari14, etc.), which don't support top-level await -- but this app
  // only ever runs inside Tauri's own bundled webview (WebView2 / WKWebView
  // / WebKitGTK), all modern enough for it. Without this, the build fails
  // on `await migrate(db)` in hooks.client.ts.
  build: {
    target: 'esnext',
  },
  test: {
    include: ['src/**/*.{test,spec}.{js,ts}'],
  },
})
