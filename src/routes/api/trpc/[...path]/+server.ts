import type { RequestHandler } from '@sveltejs/kit';
import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { createContext } from '$lib/server/trpc';
import { appRouter } from '$lib/server/trpc/router';

const handler: RequestHandler = (event) =>
	fetchRequestHandler({
		endpoint: '/api/trpc',
		req: event.request,
		router: appRouter,
		createContext: async () => createContext(event)
	});

export const GET = handler;
export const POST = handler;
