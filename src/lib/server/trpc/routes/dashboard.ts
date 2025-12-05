/**
 * Dashboard router
 * Handles dashboard statistics
 */

import { router, protectedProcedure } from '../index.js';
import { db } from '$lib/server/db';
import { scannedImage } from '$lib/server/db/schema';
import { eq, desc, and, gte, lte, sql } from 'drizzle-orm';
import { getMonthPeriod } from '$lib/server/utils';
import { getCurrentUsage, getUserPlan } from '$lib/server/services/usage';

export const dashboardRouter = router({
	getStats: protectedProcedure.query(async ({ ctx }) => {
		const { start, end } = getMonthPeriod();

		// Run queries in parallel for better performance
		const [totalImagesResult, monthImagesResult, recentImages, usage, plan] = await Promise.all([
			db
				.select({ count: sql<number>`count(*)` })
				.from(scannedImage)
				.where(eq(scannedImage.userId, ctx.user.id)),

			db
				.select({ count: sql<number>`count(*)` })
				.from(scannedImage)
				.where(
					and(
						eq(scannedImage.userId, ctx.user.id),
						gte(scannedImage.createdAt, start),
						lte(scannedImage.createdAt, end)
					)
				),

			db.query.scannedImage.findMany({
				where: eq(scannedImage.userId, ctx.user.id),
				orderBy: [desc(scannedImage.createdAt)],
				limit: 5
			}),

			getCurrentUsage(ctx.user.id),
			getUserPlan(ctx.user.id)
		]);

		return {
			totalImages: totalImagesResult[0]?.count ?? 0,
			imagesThisMonth: monthImagesResult[0]?.count ?? 0,
			recentImages,
			usage: {
				used: usage.imagesScanned,
				limit: plan.imagesPerMonth,
				percentage:
					plan.imagesPerMonth === -1
						? 0
						: Math.round((usage.imagesScanned / plan.imagesPerMonth) * 100)
			},
			plan: {
				id: plan.id,
				name: plan.displayName,
				imagesPerMonth: plan.imagesPerMonth
			}
		};
	})
});
