import adapter from '@sveltejs/adapter-static';

import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://kit.svelte.dev/docs/integrations#preprocessors
	// for more information about preprocessors
	preprocess: vitePreprocess(),

	kit: {
		// See https://kit.svelte.dev/docs/adapters for more information about adapters.
		adapter: adapter(),

    // Wish we could just do a top-level "files: 'src-ui'" but, alas, we cannot.
    files: {
      assets: 'static',
      hooks: {
        client: 'src-ui/hooks.client',
        server: 'src-ui/hooks.server',
        universal: 'src-ui/hooks.universal',
      },
      lib: 'src-ui/lib',
      params: 'src-ui/params',
      routes: 'src-ui/routes',
      serviceWorker: 'src-ui/service-worker',
      appTemplate: 'src-ui/app.html',
      errorTemplate: 'src-ui/error.html'
    }

	}
};

export default config;
