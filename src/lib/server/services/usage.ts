/**
 * Usage tracking service
 * Handles monthly usage limits and tracking
 */

import { db } from '$lib/server/db';
import { usageRecord, user } from '$lib/server/db/schema';
import { getPlan } from '$lib/server/config/plans';
import { eq, and, gte, lte, sql } from 'drizzle-orm';
import { generateId, now, getMonthPeriod } from '$lib/server/utils';

export interface UsageRecord {
	id: string;
	userId: string;
	periodStart: Date;
	periodEnd: Date;
	imagesScanned: number;
	bytesProcessed: number;
	createdAt: Date;
	updatedAt: Date;
}

/**
 * Get or create the current month's usage record for a user
 */
export async function getCurrentUsage(userId: string): Promise<UsageRecord> {
	const { start, end } = getMonthPeriod();

	let record = await db.query.usageRecord.findFirst({
		where: and(
			eq(usageRecord.userId, userId),
			gte(usageRecord.periodStart, start),
			lte(usageRecord.periodEnd, end)
		)
	});

	if (!record) {
		const timestamp = now();
		const id = generateId();

		// Use INSERT OR IGNORE pattern to handle race conditions
		await db
			.insert(usageRecord)
			.values({
				id,
				userId,
				periodStart: start,
				periodEnd: end,
				imagesScanned: 0,
				bytesProcessed: 0,
				createdAt: timestamp,
				updatedAt: timestamp
			})
			.onConflictDoNothing();

		// Re-fetch to get the actual record (in case another request created it)
		record = await db.query.usageRecord.findFirst({
			where: and(
				eq(usageRecord.userId, userId),
				gte(usageRecord.periodStart, start),
				lte(usageRecord.periodEnd, end)
			)
		});

		// Fallback if still not found (shouldn't happen)
		if (!record) {
			record = {
				id,
				userId,
				periodStart: start,
				periodEnd: end,
				imagesScanned: 0,
				bytesProcessed: 0,
				createdAt: timestamp,
				updatedAt: timestamp
			};
		}
	}

	return record;
}

/**
 * Increment usage counters for a user using atomic update
 * Creates record if it doesn't exist
 */
export async function incrementUsage(userId: string, bytes: number): Promise<void> {
	const { start, end } = getMonthPeriod();
	const timestamp = now();

	// Try to update first (most common case)
	const result = await db
		.update(usageRecord)
		.set({
			imagesScanned: sql`${usageRecord.imagesScanned} + 1`,
			bytesProcessed: sql`${usageRecord.bytesProcessed} + ${bytes}`,
			updatedAt: timestamp
		})
		.where(
			and(
				eq(usageRecord.userId, userId),
				gte(usageRecord.periodStart, start),
				lte(usageRecord.periodEnd, end)
			)
		);

	// If no rows updated, create the record and try again
	if (result.rowsAffected === 0) {
		await db
			.insert(usageRecord)
			.values({
				id: generateId(),
				userId,
				periodStart: start,
				periodEnd: end,
				imagesScanned: 1,
				bytesProcessed: bytes,
				createdAt: timestamp,
				updatedAt: timestamp
			})
			.onConflictDoNothing();
	}
}

/**
 * Get the plan for a user
 */
export async function getUserPlan(userId: string) {
	const userRecord = await db.query.user.findFirst({
		where: eq(user.id, userId),
		columns: { planId: true }
	});

	return getPlan(userRecord?.planId);
}

/**
 * Check if user can upload based on their plan limits
 */
export async function checkUploadLimits(
	userId: string,
	fileSizeBytes: number
): Promise<{ allowed: boolean; error?: string }> {
	// Run both queries in parallel
	const [usage, plan] = await Promise.all([getCurrentUsage(userId), getUserPlan(userId)]);

	if (plan.imagesPerMonth !== -1 && usage.imagesScanned >= plan.imagesPerMonth) {
		return {
			allowed: false,
			error: 'Monthly image limit reached. Please upgrade your plan.'
		};
	}

	if (fileSizeBytes > plan.maxImageSizeMb * 1024 * 1024) {
		return {
			allowed: false,
			error: `File size exceeds the ${plan.maxImageSizeMb}MB limit for your plan.`
		};
	}

	return { allowed: true };
}

/**
 * Check usage limits and optionally increment usage
 * Returns current usage info and whether the operation is allowed
 */
export async function checkAndIncrementUsage(
	userId: string,
	fileSizeBytes: number
): Promise<{
	allowed: boolean;
	currentUsage: number;
	limit: number;
	error?: string;
}> {
	const [usage, plan] = await Promise.all([getCurrentUsage(userId), getUserPlan(userId)]);

	const currentUsage = usage.imagesScanned;
	const limit = plan.imagesPerMonth;

	// Check if limit is reached (skip check for unlimited plans)
	if (limit !== -1 && currentUsage >= limit) {
		return {
			allowed: false,
			currentUsage,
			limit,
			error: 'Monthly image limit reached. Please upgrade your plan.'
		};
	}

	// If fileSizeBytes > 0, we're actually processing - increment usage
	if (fileSizeBytes > 0) {
		await incrementUsage(userId, fileSizeBytes);
	}

	return {
		allowed: true,
		currentUsage: fileSizeBytes > 0 ? currentUsage + 1 : currentUsage,
		limit
	};
}
