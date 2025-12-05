import { z } from 'zod';
import { router, publicProcedure, protectedProcedure } from './index.js';

export const appRouter = router({
	// Example public procedure
	greeting: publicProcedure.input(z.object({ name: z.string().optional() })).query(({ input }) => {
		return {
			message: `Hello, ${input.name ?? 'World'}!`
		};
	}),

	// Get current session/user
	getSession: publicProcedure.query(({ ctx }) => {
		return {
			session: ctx.session,
			user: ctx.user
		};
	}),

	// Example protected procedure - only accessible when logged in
	getProtectedData: protectedProcedure.query(({ ctx }) => {
		return {
			message: `Hello, ${ctx.user.name}! This is protected data.`,
			userId: ctx.user.id
		};
	})
});

// Export type router type signature for client
export type AppRouter = typeof appRouter;
