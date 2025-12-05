import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, publicProcedure, protectedProcedure } from './index.js';
import { db } from '$lib/server/db';
import { scannedImage, usageRecord, user, getPlan, PLAN_LIST } from '$lib/server/db/schema';
import { eq, desc, and, gte, lte, sql } from 'drizzle-orm';
import crypto from 'crypto';

// =============================================================================
// Helper functions
// =============================================================================

function generateId() {
	return crypto.randomUUID();
}

function now() {
	return new Date();
}

function getMonthPeriod(date: Date = new Date()) {
	const start = new Date(date.getFullYear(), date.getMonth(), 1);
	const end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
	return { start, end };
}

// =============================================================================
// Router
// =============================================================================

export const appRouter = router({
	// =========================================================================
	// General
	// =========================================================================

	greeting: publicProcedure.input(z.object({ name: z.string().optional() })).query(({ input }) => {
		return {
			message: `Hello, ${input.name ?? 'World'}!`
		};
	}),

	getSession: publicProcedure.query(({ ctx }) => {
		return {
			session: ctx.session,
			user: ctx.user
		};
	}),

	// =========================================================================
	// Images
	// =========================================================================

	images: router({
		list: protectedProcedure
			.input(
				z.object({
					limit: z.number().min(1).max(100).default(20),
					cursor: z.string().optional(),
					status: z.enum(['pending', 'processing', 'completed', 'failed']).optional()
				})
			)
			.query(async ({ ctx, input }) => {
				const { limit, cursor, status } = input;

				const conditions = [eq(scannedImage.userId, ctx.user.id)];

				if (status) {
					conditions.push(eq(scannedImage.status, status));
				}

				if (cursor) {
					const cursorImage = await db.query.scannedImage.findFirst({
						where: eq(scannedImage.id, cursor)
					});
					if (cursorImage) {
						conditions.push(lte(scannedImage.createdAt, cursorImage.createdAt));
					}
				}

				const images = await db.query.scannedImage.findMany({
					where: and(...conditions),
					orderBy: [desc(scannedImage.createdAt)],
					limit: limit + 1
				});

				let nextCursor: string | undefined;
				if (images.length > limit) {
					const nextItem = images.pop();
					nextCursor = nextItem?.id;
				}

				return {
					images,
					nextCursor
				};
			}),

		get: protectedProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
			const image = await db.query.scannedImage.findFirst({
				where: and(eq(scannedImage.id, input.id), eq(scannedImage.userId, ctx.user.id))
			});

			if (!image) {
				throw new TRPCError({
					code: 'NOT_FOUND',
					message: 'Image not found'
				});
			}

			return image;
		}),

		create: protectedProcedure
			.input(
				z.object({
					fileName: z.string(),
					originalUrl: z.string(),
					thumbnailUrl: z.string().optional(),
					mimeType: z.string(),
					fileSizeBytes: z.number().positive(),
					width: z.number().positive().optional(),
					height: z.number().positive().optional(),
					language: z.string().optional(),
					metadata: z.record(z.string(), z.unknown()).optional()
				})
			)
			.mutation(async ({ ctx, input }) => {
				// Check usage limits
				const usage = await getCurrentUsage(ctx.user.id);
				const userPlan = await getUserPlan(ctx.user.id);

				if (userPlan.imagesPerMonth !== -1 && usage.imagesScanned >= userPlan.imagesPerMonth) {
					throw new TRPCError({
						code: 'FORBIDDEN',
						message: 'Monthly image limit reached. Please upgrade your plan.'
					});
				}

				if (input.fileSizeBytes > userPlan.maxImageSizeMb * 1024 * 1024) {
					throw new TRPCError({
						code: 'BAD_REQUEST',
						message: `File size exceeds the ${userPlan.maxImageSizeMb}MB limit for your plan.`
					});
				}

				const id = generateId();
				const timestamp = now();

				await db.insert(scannedImage).values({
					id,
					userId: ctx.user.id,
					fileName: input.fileName,
					originalUrl: input.originalUrl,
					thumbnailUrl: input.thumbnailUrl,
					mimeType: input.mimeType,
					fileSizeBytes: input.fileSizeBytes,
					width: input.width,
					height: input.height,
					language: input.language,
					metadata: input.metadata,
					status: 'pending',
					createdAt: timestamp,
					updatedAt: timestamp
				});

				// Increment usage
				await incrementUsage(ctx.user.id, input.fileSizeBytes);

				return { id };
			}),

		updateResult: protectedProcedure
			.input(
				z.object({
					id: z.string(),
					extractedText: z.string(),
					confidence: z.number().min(0).max(1).optional(),
					processingTimeMs: z.number().positive().optional(),
					status: z.enum(['completed', 'failed']),
					errorMessage: z.string().optional()
				})
			)
			.mutation(async ({ ctx, input }) => {
				const existing = await db.query.scannedImage.findFirst({
					where: and(eq(scannedImage.id, input.id), eq(scannedImage.userId, ctx.user.id))
				});

				if (!existing) {
					throw new TRPCError({
						code: 'NOT_FOUND',
						message: 'Image not found'
					});
				}

				await db
					.update(scannedImage)
					.set({
						extractedText: input.extractedText,
						confidence: input.confidence,
						processingTimeMs: input.processingTimeMs,
						status: input.status,
						errorMessage: input.errorMessage,
						updatedAt: now()
					})
					.where(eq(scannedImage.id, input.id));

				return { success: true };
			}),

		delete: protectedProcedure
			.input(z.object({ id: z.string() }))
			.mutation(async ({ ctx, input }) => {
				const existing = await db.query.scannedImage.findFirst({
					where: and(eq(scannedImage.id, input.id), eq(scannedImage.userId, ctx.user.id))
				});

				if (!existing) {
					throw new TRPCError({
						code: 'NOT_FOUND',
						message: 'Image not found'
					});
				}

				await db.delete(scannedImage).where(eq(scannedImage.id, input.id));

				return { success: true };
			})
	}),

	// =========================================================================
	// Plans
	// =========================================================================

	plans: router({
		list: publicProcedure.query(() => {
			return PLAN_LIST;
		}),

		getCurrent: protectedProcedure.query(async ({ ctx }) => {
			const userRecord = await db.query.user.findFirst({
				where: eq(user.id, ctx.user.id)
			});

			const planId = userRecord?.planId ?? 'free';
			return getPlan(planId);
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
	}),

	// =========================================================================
	// Usage
	// =========================================================================

	usage: router({
		getCurrent: protectedProcedure.query(async ({ ctx }) => {
			const usage = await getCurrentUsage(ctx.user.id);
			const userPlan = await getUserPlan(ctx.user.id);

			return {
				...usage,
				limit: userPlan.imagesPerMonth,
				remainingImages:
					userPlan.imagesPerMonth === -1 ? -1 : userPlan.imagesPerMonth - usage.imagesScanned
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
	}),

	// =========================================================================
	// Dashboard Stats
	// =========================================================================

	dashboard: router({
		getStats: protectedProcedure.query(async ({ ctx }) => {
			const { start, end } = getMonthPeriod();

			// Get total images
			const totalImagesResult = await db
				.select({ count: sql<number>`count(*)` })
				.from(scannedImage)
				.where(eq(scannedImage.userId, ctx.user.id));

			// Get this month's images
			const monthImagesResult = await db
				.select({ count: sql<number>`count(*)` })
				.from(scannedImage)
				.where(
					and(
						eq(scannedImage.userId, ctx.user.id),
						gte(scannedImage.createdAt, start),
						lte(scannedImage.createdAt, end)
					)
				);

			// Get recent images
			const recentImages = await db.query.scannedImage.findMany({
				where: eq(scannedImage.userId, ctx.user.id),
				orderBy: [desc(scannedImage.createdAt)],
				limit: 5
			});

			// Get usage and plan info
			const usage = await getCurrentUsage(ctx.user.id);
			const userPlan = await getUserPlan(ctx.user.id);

			return {
				totalImages: totalImagesResult[0]?.count ?? 0,
				imagesThisMonth: monthImagesResult[0]?.count ?? 0,
				recentImages,
				usage: {
					used: usage.imagesScanned,
					limit: userPlan.imagesPerMonth,
					percentage:
						userPlan.imagesPerMonth === -1
							? 0
							: Math.round((usage.imagesScanned / userPlan.imagesPerMonth) * 100)
				},
				plan: {
					id: userPlan.id,
					name: userPlan.displayName,
					imagesPerMonth: userPlan.imagesPerMonth
				}
			};
		})
	})
});

// =============================================================================
// Helper functions for usage tracking
// =============================================================================

async function getCurrentUsage(userId: string) {
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
		await db.insert(usageRecord).values({
			id,
			userId,
			periodStart: start,
			periodEnd: end,
			imagesScanned: 0,
			bytesProcessed: 0,
			createdAt: timestamp,
			updatedAt: timestamp
		});
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

	return record;
}

async function incrementUsage(userId: string, bytes: number) {
	const { start, end } = getMonthPeriod();

	await db
		.update(usageRecord)
		.set({
			imagesScanned: sql`${usageRecord.imagesScanned} + 1`,
			bytesProcessed: sql`${usageRecord.bytesProcessed} + ${bytes}`,
			updatedAt: now()
		})
		.where(
			and(
				eq(usageRecord.userId, userId),
				gte(usageRecord.periodStart, start),
				lte(usageRecord.periodEnd, end)
			)
		);
}

async function getUserPlan(userId: string) {
	const userRecord = await db.query.user.findFirst({
		where: eq(user.id, userId)
	});

	return getPlan(userRecord?.planId);
}

// Export type router type signature for client
export type AppRouter = typeof appRouter;
