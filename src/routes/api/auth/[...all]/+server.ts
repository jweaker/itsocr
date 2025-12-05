import type { RequestHandler } from '@sveltejs/kit';
import { auth } from '$lib/server/auth';

const handler: RequestHandler = async (event) => {
	return auth.handler(event.request);
};

export const GET = handler;
export const POST = handler;
