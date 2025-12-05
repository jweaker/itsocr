/**
 * Plans router
 * Handles plan listing and updates
 */

import { z } from 'zod';
import { router, publicProcedure, protectedProcedure } from '../index.js';
import { db } from '$lib/server/db';
import { user } from '$lib/server/db/schema';
import { PLAN_LIST, getPlan } from '$lib/server/config/plans';
import { eq } from 'drizzle-orm';
import { now } from '$lib/server/utils';

export const plansRouter = router({
	list: publicProcedure.query(() => {
		return PLAN_LIST;
	}),

	getCurrent: protectedProcedure.query(async ({ ctx }) => {
		const userRecord = await db.query.user.findFirst({
			where: eq(user.id, ctx.user.id)
		});

		return getPlan(userRecord?.planId ?? 'free');
	}),

	update: protectedProcedure
		.input(
			z.object({
				planId: z.enum(['free', 'pro', 'enterprise'])
			})
		)
		.mutation(async ({ ctx, input }) => {
			await db
				.update(user)
				.set({
					planId: input.planId,
					updatedAt: now()
				})
				.where(eq(user.id, ctx.user.id));

			return { success: true, plan: getPlan(input.planId) };
		})
});
