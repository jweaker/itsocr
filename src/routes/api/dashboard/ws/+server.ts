/**
 * WebSocket endpoint for Dashboard live updates
 * Upgrades HTTP connection to WebSocket and forwards to DO
 */

import type { RequestEvent } from '@sveltejs/kit';

export async function GET({ locals, platform }: RequestEvent) {
	if (!platform?.env?.DASHBOARD_SESSIONS) {
		return new Response('Dashboard service not configured', { status: 503 });
	}

	// Require authentication
	if (!locals.user) {
		return new Response('Unauthorized', { status: 401 });
	}

	const userId = locals.user.id;

	// Get the DO instance for this user
	const doId = platform.env.DASHBOARD_SESSIONS.idFromName(userId);
	const stub = platform.env.DASHBOARD_SESSIONS.get(doId);

	// Forward the WebSocket upgrade request to the DO
	return stub.fetch(
		new Request('https://do/websocket', {
			headers: new Headers({
				Upgrade: 'websocket'
			})
		})
	);
}
