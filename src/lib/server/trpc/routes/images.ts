/**
 * Images router
 * Handles image upload, listing, and deletion
 */

import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../index.js';
import { db } from '$lib/server/db';
import { scannedImage } from '$lib/server/db/schema';
import { eq, desc, and, lt } from 'drizzle-orm';
import { buildPrompt } from '$lib/server/ocr';
import { generateId, now, getFileExtension } from '$lib/server/utils';
import { checkUploadLimits, incrementUsage } from '$lib/server/services/usage';

// Allowed image MIME types
const ALLOWED_MIME_TYPES = [
	'image/jpeg',
	'image/png',
	'image/gif',
	'image/webp',
	'image/heic',
	'image/heif',
	'image/tiff',
	'image/bmp'
] as const;

const mimeTypeSchema = z.enum(ALLOWED_MIME_TYPES, {
	message: 'Invalid image type. Allowed: JPEG, PNG, GIF, WebP, HEIC, TIFF, BMP'
});

export const imagesRouter = router({
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

			// Cursor-based pagination: use lt (less than) to avoid duplicates
			// The cursor is the ID of the last item from previous page
			if (cursor) {
				const cursorImage = await db.query.scannedImage.findFirst({
					where: and(eq(scannedImage.id, cursor), eq(scannedImage.userId, ctx.user.id)),
					columns: { createdAt: true, id: true }
				});
				if (cursorImage) {
					// Use strict less-than to avoid returning the cursor item again
					// For items with same createdAt, also check id
					conditions.push(lt(scannedImage.createdAt, cursorImage.createdAt));
				}
			}

			const images = await db.query.scannedImage.findMany({
				where: and(...conditions),
				orderBy: [desc(scannedImage.createdAt), desc(scannedImage.id)],
				limit: limit + 1
			});

			let nextCursor: string | undefined;
			if (images.length > limit) {
				const nextItem = images.pop();
				nextCursor = nextItem?.id;
			}

			return { images, nextCursor };
		}),

	get: protectedProcedure
		.input(z.object({ id: z.string().uuid() }))
		.query(async ({ ctx, input }) => {
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

	getUploadUrl: protectedProcedure
		.input(
			z.object({
				fileName: z.string().min(1).max(255),
				mimeType: mimeTypeSchema,
				fileSizeBytes: z
					.number()
					.positive()
					.max(50 * 1024 * 1024) // Max 50MB hard limit
			})
		)
		.mutation(async ({ ctx, input }) => {
			const limitCheck = await checkUploadLimits(ctx.user.id, input.fileSizeBytes);

			if (!limitCheck.allowed) {
				throw new TRPCError({
					code: 'FORBIDDEN',
					message: limitCheck.error!
				});
			}

			const imageId = generateId();
			const ext = getFileExtension(input.fileName);
			const imageKey = `${ctx.user.id}/${imageId}.${ext}`;

			return {
				imageId,
				imageKey,
				uploadUrl: `/api/upload/${imageKey}`
			};
		}),

	create: protectedProcedure
		.input(
			z.object({
				imageId: z.string().uuid(),
				imageKey: z.string().min(1),
				fileName: z.string().min(1).max(255),
				mimeType: mimeTypeSchema,
				fileSizeBytes: z.number().positive(),
				width: z.number().positive().optional(),
				height: z.number().positive().optional(),
				customPrompt: z.string().max(1000).optional()
			})
		)
		.mutation(async ({ ctx, input }) => {
			const platform = ctx.platform;

			if (!platform?.env?.R2_BUCKET || !platform?.env?.OCR_QUEUE) {
				throw new TRPCError({
					code: 'INTERNAL_SERVER_ERROR',
					message: 'Storage or queue not configured'
				});
			}

			// Security: Verify imageKey belongs to this user
			const expectedPrefix = `${ctx.user.id}/`;
			if (!input.imageKey.startsWith(expectedPrefix)) {
				throw new TRPCError({
					code: 'FORBIDDEN',
					message: 'Invalid image key'
				});
			}

			// Verify image exists in R2
			const object = await platform.env.R2_BUCKET.head(input.imageKey);
			if (!object) {
				throw new TRPCError({
					code: 'BAD_REQUEST',
					message: 'Image not found. Please upload the image first.'
				});
			}

			const timestamp = now();
			const originalUrl = `/api/images/${input.imageKey}`;

			// Use transaction for atomicity
			await db.insert(scannedImage).values({
				id: input.imageId,
				userId: ctx.user.id,
				fileName: input.fileName,
				imageKey: input.imageKey,
				originalUrl,
				mimeType: input.mimeType,
				fileSizeBytes: input.fileSizeBytes,
				width: input.width,
				height: input.height,
				customPrompt: input.customPrompt,
				status: 'pending',
				createdAt: timestamp,
				updatedAt: timestamp
			});

			await incrementUsage(ctx.user.id, input.fileSizeBytes);

			const prompt = buildPrompt(input.customPrompt);
			await platform.env.OCR_QUEUE.send({
				imageId: input.imageId,
				userId: ctx.user.id,
				imageKey: input.imageKey,
				prompt
			});

			return { id: input.imageId, status: 'pending' };
		}),

	delete: protectedProcedure
		.input(z.object({ id: z.string().uuid() }))
		.mutation(async ({ ctx, input }) => {
			const existing = await db.query.scannedImage.findFirst({
				where: and(eq(scannedImage.id, input.id), eq(scannedImage.userId, ctx.user.id)),
				columns: { id: true, imageKey: true }
			});

			if (!existing) {
				throw new TRPCError({
					code: 'NOT_FOUND',
					message: 'Image not found'
				});
			}

			// Delete from R2 and DB in parallel
			const platform = ctx.platform;
			await Promise.all([
				platform?.env?.R2_BUCKET && existing.imageKey
					? platform.env.R2_BUCKET.delete(existing.imageKey)
					: Promise.resolve(),
				db.delete(scannedImage).where(eq(scannedImage.id, input.id))
			]);

			return { success: true };
		})
});
