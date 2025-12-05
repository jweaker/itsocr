import type { RequestHandler } from './$types';
import { auth } from '$lib/server/auth';
import { error, json } from '@sveltejs/kit';

export const PUT: RequestHandler = async ({ request, params, platform }) => {
	// Authenticate request
	const session = await auth.api.getSession({
		headers: request.headers
	});

	if (!session?.user) {
		throw error(401, 'Unauthorized');
	}

	const imageKey = params.path;

	if (!imageKey) {
		throw error(400, 'Missing image key');
	}

	// Verify the image key belongs to this user
	if (!imageKey.startsWith(session.user.id + '/')) {
		throw error(403, 'Forbidden');
	}

	if (!platform?.env?.R2_BUCKET) {
		throw error(500, 'Storage not configured');
	}

	// Get the file from request body
	const contentType = request.headers.get('content-type') || 'application/octet-stream';
	const body = await request.arrayBuffer();

	// Upload to R2
	await platform.env.R2_BUCKET.put(imageKey, body, {
		httpMetadata: {
			contentType
		}
	});

	return json({ success: true, imageKey });
};
