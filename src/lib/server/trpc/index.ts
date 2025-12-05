import { initTRPC, TRPCError } from '@trpc/server';
import type { RequestEvent } from '@sveltejs/kit';
import { auth, isAuthConfigured } from '$lib/server/auth';

// Create context from SvelteKit request event
export const createContext = async (event: RequestEvent) => {
	let session = null;

	// Only try to get session if auth is configured
	if (isAuthConfigured()) {
		try {
			session = await auth.api.getSession({
				headers: event.request.headers
			});
		} catch (e) {
			// Log but don't throw - allow public procedures to work
			console.error('Failed to get session:', e);
		}
	}

	return {
		event,
		session,
		user: session?.user ?? null,
		// Cloudflare platform bindings (R2, Queue, etc.)
		platform: event.platform
	};
};

export type Context = Awaited<ReturnType<typeof createContext>>;

// Initialize tRPC
const t = initTRPC.context<Context>().create();

// Export reusable router and procedure helpers
export const router = t.router;
export const publicProcedure = t.procedure;

// Protected procedure - requires authentication
export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
	if (!ctx.session || !ctx.user) {
		throw new TRPCError({
			code: 'UNAUTHORIZED',
			message: 'You must be logged in to access this resource'
		});
	}

	return next({
		ctx: {
			...ctx,
			session: ctx.session,
			user: ctx.user
		}
	});
});
