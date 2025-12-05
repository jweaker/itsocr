import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { auth, isAuthConfigured } from '$lib/server/auth';

export const load: PageServerLoad = async ({ request }) => {
	if (!isAuthConfigured()) {
		return {};
	}

	try {
		const session = await auth.api.getSession({
			headers: request.headers
		});

		// If user is already logged in, redirect to dashboard
		if (session?.user) {
			throw redirect(302, '/dashboard');
		}
	} catch (e) {
		// If it's a redirect, rethrow it
		if (e && typeof e === 'object' && 'status' in e) {
			throw e;
		}
		// Otherwise ignore auth errors on login page
	}

	return {};
};
