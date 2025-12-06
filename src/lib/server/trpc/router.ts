/**
 * Main tRPC router
 * Combines all route modules into a single router
 */

import { z } from 'zod';
import { router, publicProcedure } from './index.js';
import {
	imagesRouter,
	plansRouter,
	usageRouter,
	dashboardRouter,
	tokensRouter
} from './routes/index.js';

export const appRouter = router({
	// General endpoints
	greeting: publicProcedure.input(z.object({ name: z.string().optional() })).query(({ input }) => {
		return { message: `Hello, ${input.name ?? 'World'}!` };
	}),

	getSession: publicProcedure.query(({ ctx }) => {
		return {
			session: ctx.session,
			user: ctx.user
		};
	}),

	// Feature routers
	images: imagesRouter,
	plans: plansRouter,
	usage: usageRouter,
	dashboard: dashboardRouter,
	tokens: tokensRouter
});

export type AppRouter = typeof appRouter;
