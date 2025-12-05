import type { RequestHandler } from './$types';
import { error } from '@sveltejs/kit';
import { auth } from '$lib/server/auth';

export const GET: RequestHandler = async ({ request, params, platform }) => {
	const imageKey = params.path;

	if (!imageKey) {
		throw error(400, 'Missing image key');
	}

	if (!platform?.env?.R2_BUCKET) {
		throw error(500, 'Storage not configured');
	}

	// Authenticate request - images are private to users
	const session = await auth.api.getSession({
		headers: request.headers
	});

	if (!session?.user) {
		throw error(401, 'Unauthorized');
	}

	// Verify the image belongs to this user (key format: userId/imageId.ext)
	if (!imageKey.startsWith(session.user.id + '/')) {
		throw error(403, 'Forbidden');
	}

	const object = await platform.env.R2_BUCKET.get(imageKey);

	if (!object) {
		throw error(404, 'Image not found');
	}

	const headers = new Headers();
	headers.set('Content-Type', object.httpMetadata?.contentType || 'image/jpeg');
	headers.set('Cache-Control', 'private, max-age=3600');
	headers.set('ETag', object.etag);

	return new Response(object.body, { headers });
};
