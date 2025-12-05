import { auth, isAuthConfigured } from '$lib/server/auth';
import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
	// Skip auth for static assets and API routes that don't need it
	const pathname = event.url.pathname;

	// Always allow these paths without auth check
	const publicPaths = ['/', '/login', '/api/auth'];
	const isPublicPath = publicPaths.some((p) => pathname === p || pathname.startsWith(p + '/'));

	// If auth is not configured, allow public pages but block protected ones
	if (!isAuthConfigured()) {
		if (isPublicPath) {
			event.locals.session = null;
			event.locals.user = null;
			return resolve(event);
		}
		// For protected routes, return a helpful error
		return new Response(
			JSON.stringify({
				error: 'Service not configured',
				message:
					'The application is not fully configured. Please set up the required environment variables.'
			}),
			{
				status: 503,
				headers: { 'Content-Type': 'application/json' }
			}
		);
	}

	try {
		const session = await auth.api.getSession({
			headers: event.request.headers
		});

		event.locals.session = session;
		event.locals.user = session?.user ?? null;
	} catch (error) {
		// Log error but don't crash - allow page to render
		console.error('Failed to get session:', error);
		event.locals.session = null;
		event.locals.user = null;
	}

	return resolve(event);
};
