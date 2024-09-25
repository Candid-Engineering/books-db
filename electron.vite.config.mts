import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()]
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    root: 'src-ui/',
    build: {
      rollupOptions: {
        input: 'src-ui/index.html'
      }
    },
    plugins: [svelte()]
  }
})
