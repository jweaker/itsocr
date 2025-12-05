/**
 * Dashboard router
 * Handles dashboard statistics
 */

import { router, protectedProcedure } from '../index.js';
import { db } from '$lib/server/db';
import { scannedImage, usageRecord } from '$lib/server/db/schema';
import { eq, desc, sql } from 'drizzle-orm';
import { getCurrentUsage, getUserPlan } from '$lib/server/services/usage';

export const dashboardRouter = router({
	getStats: protectedProcedure.query(async ({ ctx }) => {
		// Run queries in parallel for better performance
		const [totalScansResult, recentImages, usage, plan] = await Promise.all([
			// Sum all imagesScanned from all usage records for this user (all-time total)
			db
				.select({ total: sql<number>`COALESCE(SUM(${usageRecord.imagesScanned}), 0)` })
				.from(usageRecord)
				.where(eq(usageRecord.userId, ctx.user.id)),

			db.query.scannedImage.findMany({
				where: eq(scannedImage.userId, ctx.user.id),
				orderBy: [desc(scannedImage.createdAt)],
				limit: 5
			}),

			getCurrentUsage(ctx.user.id),
			getUserPlan(ctx.user.id)
		]);

		return {
			// Total scans ever (from usage records, not images table)
			totalScans: totalScansResult[0]?.total ?? 0,
			// Scans this month (from current usage record)
			scansThisMonth: usage.imagesScanned,
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
