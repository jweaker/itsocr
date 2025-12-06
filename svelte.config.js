import adapter from '@sveltejs/adapter-cloudflare';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		adapter: adapter({
			routes: {
				include: ['/*'],
				exclude: ['<all>']
			}
			// Platform proxy disabled - it causes HMR full page reloads
			// Use `pnpm preview` for full Cloudflare bindings
		}),
		csrf: {
			// Allow external API requests - API routes use Bearer token auth which is CSRF-safe
			// Browser-based form submissions still get session cookie protection via SameSite
			checkOrigin: false
		}
	}
};

export default config;
