/**
 * WebSocket endpoint for OCR session
 * Upgrades HTTP connection to WebSocket and forwards to DO
 */

import type { RequestEvent } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { scannedImage } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';

export async function GET({ params, platform, request, locals }: RequestEvent) {
	// Verify user is authenticated
	if (!locals.user) {
		return new Response('Unauthorized', { status: 401 });
	}

	if (!platform?.env?.OCR_SESSION) {
		return new Response('OCR service not configured', { status: 503 });
	}

	const imageId = params.id;
	if (!imageId) {
		return new Response('Image ID required', { status: 400 });
	}

	// Verify user owns this image
	const image = await db
		.select({ id: scannedImage.id })
		.from(scannedImage)
		.where(and(eq(scannedImage.id, imageId), eq(scannedImage.userId, locals.user.id)))
		.limit(1);

	if (image.length === 0) {
		return new Response('Image not found', { status: 404 });
	}

	// Check for WebSocket upgrade header
	const upgradeHeader = request.headers.get('Upgrade');
	if (upgradeHeader?.toLowerCase() !== 'websocket') {
		return new Response('Expected WebSocket upgrade', { status: 426 });
	}

	try {
		// Get the DO instance for this image
		const doId = platform.env.OCR_SESSION.idFromName(imageId);
		const stub = platform.env.OCR_SESSION.get(doId);

		// Forward the WebSocket upgrade request to the DO
		return stub.fetch(
			new Request('https://do/websocket', {
				headers: new Headers({
					Upgrade: 'websocket'
				})
			})
		);
	} catch (error) {
		console.error('[OCR WS] Error upgrading connection:', error);
		return new Response('Failed to establish WebSocket connection', { status: 500 });
	}
}
