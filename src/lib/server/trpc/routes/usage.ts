/**
 * Usage router
 * Handles usage tracking and history
 */

import { z } from 'zod';
import { router, protectedProcedure } from '../index.js';
import { db } from '$lib/server/db';
import { usageRecord } from '$lib/server/db/schema';
import { eq, desc } from 'drizzle-orm';
import { getCurrentUsage, getUserPlan } from '$lib/server/services/usage';

export const usageRouter = router({
	getCurrent: protectedProcedure.query(async ({ ctx }) => {
		const usage = await getCurrentUsage(ctx.user.id);
		const plan = await getUserPlan(ctx.user.id);

		return {
			...usage,
			limit: plan.imagesPerMonth,
			remainingImages: plan.imagesPerMonth === -1 ? -1 : plan.imagesPerMonth - usage.imagesScanned
		};
	}),

	getHistory: protectedProcedure
		.input(
			z.object({
				months: z.number().min(1).max(12).default(6)
			})
		)
		.query(async ({ ctx, input }) => {
			const records = await db.query.usageRecord.findMany({
				where: eq(usageRecord.userId, ctx.user.id),
				orderBy: [desc(usageRecord.periodStart)],
				limit: input.months
			});

			return records;
		})
});
