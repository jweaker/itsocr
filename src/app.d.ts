// See https://svelte.dev/docs/kit/types#app.d.ts
/// <reference types="@cloudflare/workers-types" />

import type { auth } from '$lib/server/auth';

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			session: Awaited<ReturnType<typeof auth.api.getSession>> | null;
			user: Awaited<ReturnType<typeof auth.api.getSession>>['user'] | null;
		}
		// interface PageData {}
		// interface PageState {}
		interface Platform {
			env: {
				R2_BUCKET: R2Bucket;
				OCR_SESSION: DurableObjectNamespace;
				DASHBOARD_SESSIONS: DurableObjectNamespace;
				DATABASE_URL: string;
				DATABASE_AUTH_TOKEN: string;
				BETTER_AUTH_SECRET: string;
				BETTER_AUTH_BASE_URL: string;
				BETTER_AUTH_GITHUB_CLIENT_ID?: string;
				BETTER_AUTH_GITHUB_CLIENT_SECRET?: string;
				BETTER_AUTH_GOOGLE_CLIENT_ID?: string;
				BETTER_AUTH_GOOGLE_CLIENT_SECRET?: string;
			};
			context: ExecutionContext;
			caches: CacheStorage & { default: Cache };
		}
	}
}

export {};
