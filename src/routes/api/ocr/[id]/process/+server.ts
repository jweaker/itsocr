/**
 * Trigger OCR processing endpoint
 * Called after image upload to start the OCR process
 */

import type { RequestEvent } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { scannedImage } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';

export async function POST({ params, request, platform, locals }: RequestEvent) {
	// Verify user is authenticated
	if (!locals.user) {
		return new Response(JSON.stringify({ error: 'Unauthorized' }), {
			status: 401,
			headers: { 'Content-Type': 'application/json' }
		});
	}

	if (!platform?.env?.OCR_SESSION) {
		return new Response(JSON.stringify({ error: 'OCR service not configured' }), {
			status: 503,
			headers: { 'Content-Type': 'application/json' }
		});
	}

	const imageId = params.id;
	if (!imageId) {
		return new Response(JSON.stringify({ error: 'Image ID required' }), {
			status: 400,
			headers: { 'Content-Type': 'application/json' }
		});
	}

	// Verify user owns this image
	const image = await db
		.select({ id: scannedImage.id, imageKey: scannedImage.imageKey })
		.from(scannedImage)
		.where(and(eq(scannedImage.id, imageId), eq(scannedImage.userId, locals.user.id)))
		.limit(1);

	if (image.length === 0) {
		return new Response(JSON.stringify({ error: 'Image not found' }), {
			status: 404,
			headers: { 'Content-Type': 'application/json' }
		});
	}

	try {
		const body = (await request.json()) as Record<string, unknown>;

		// Ensure the userId in the body matches the authenticated user
		body.userId = locals.user.id;

		// Get the DO instance for this image
		const doId = platform.env.OCR_SESSION.idFromName(imageId);
		const stub = platform.env.OCR_SESSION.get(doId);

		// Tell the DO to start processing
		const response = await stub.fetch(
			new Request('https://do/process', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body)
			})
		);

		const result = await response.json();
		return new Response(JSON.stringify(result), {
			status: response.status,
			headers: { 'Content-Type': 'application/json' }
		});
	} catch (error) {
		console.error('[OCR Process] Error:', error);
		return new Response(
			JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
			{
				status: 500,
				headers: { 'Content-Type': 'application/json' }
			}
		);
	}
}
