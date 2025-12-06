/**
 * Images router
 * Handles image upload, listing, and deletion
 */

import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../index.js';
import { db } from '$lib/server/db';
import { scannedImage } from '$lib/server/db/schema';
import { eq, desc, and, lt, or, like, inArray } from 'drizzle-orm';
import { buildPrompt } from '$lib/server/ocr';
import { generateId, now, getFileExtension } from '$lib/server/utils';
import { checkUploadLimits, incrementUsage } from '$lib/server/services/usage';

// Allowed image MIME types
const ALLOWED_IMAGE_MIME_TYPES = [
	'image/jpeg',
	'image/png',
	'image/gif',
	'image/webp',
	'image/heic',
	'image/heif',
	'image/tiff',
	'image/bmp'
] as const;

// PDF MIME type
const PDF_MIME_TYPE = 'application/pdf' as const;

// All allowed MIME types (images + PDF)
const ALLOWED_MIME_TYPES = [...ALLOWED_IMAGE_MIME_TYPES, PDF_MIME_TYPE] as const;

const mimeTypeSchema = z.enum(ALLOWED_MIME_TYPES, {
	message: 'Invalid file type. Allowed: JPEG, PNG, GIF, WebP, HEIC, TIFF, BMP, PDF'
});

// Helper to check if a MIME type is PDF
export function isPdfMimeType(mimeType: string): boolean {
	return mimeType === PDF_MIME_TYPE;
}

export const imagesRouter = router({
	list: protectedProcedure
		.input(
			z.object({
				limit: z.number().min(1).max(100).default(20),
				cursor: z.string().optional(),
				status: z.enum(['pending', 'processing', 'completed', 'failed', 'cancelled']).optional(),
				search: z.string().max(200).optional()
			})
		)
		.query(async ({ ctx, input }) => {
			const { limit, cursor, status, search } = input;

			const conditions = [eq(scannedImage.userId, ctx.user.id)];

			if (status) {
				conditions.push(eq(scannedImage.status, status));
			}

			// Search in fileName and extractedText
			if (search && search.trim()) {
				const searchPattern = `%${search.trim()}%`;
				conditions.push(
					or(
						like(scannedImage.fileName, searchPattern),
						like(scannedImage.extractedText, searchPattern)
					)!
				);
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
				contentHash: z.string().length(64).optional(), // SHA-256 hash (64 hex chars)
				width: z.number().positive().optional(),
				height: z.number().positive().optional(),
				pageCount: z.number().positive().optional(), // For PDFs
				pageImages: z.array(z.string()).optional(), // R2 keys for page images
				customPrompt: z.string().max(1000).optional()
			})
		)
		.mutation(async ({ ctx, input }) => {
			const platform = ctx.platform;

			if (!platform?.env?.R2_BUCKET) {
				throw new TRPCError({
					code: 'INTERNAL_SERVER_ERROR',
					message: 'Storage not configured'
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

			// Check for duplicate image by content hash (same user, same content)
			if (input.contentHash) {
				const existing = await db.query.scannedImage.findFirst({
					where: and(
						eq(scannedImage.userId, ctx.user.id),
						eq(scannedImage.contentHash, input.contentHash),
						eq(scannedImage.status, 'completed')
					),
					columns: {
						id: true,
						extractedText: true,
						processingTimeMs: true,
						customPrompt: true
					}
				});

				if (existing && existing.extractedText) {
					// Found a completed duplicate - delete the uploaded file and return existing
					await platform.env.R2_BUCKET.delete(input.imageKey);

					return {
						id: existing.id,
						isDuplicate: true,
						existingText: existing.extractedText,
						processingTimeMs: existing.processingTimeMs,
						status: 'completed' as const
					};
				}
			}

			// Verify file exists in R2
			const object = await platform.env.R2_BUCKET.head(input.imageKey);
			if (!object) {
				throw new TRPCError({
					code: 'BAD_REQUEST',
					message: 'File not found. Please upload the file first.'
				});
			}

			const isPdf = isPdfMimeType(input.mimeType);
			const timestamp = now();
			const originalUrl = `/api/images/${input.imageKey}`;

			// Create the database record
			await db.insert(scannedImage).values({
				id: input.imageId,
				userId: ctx.user.id,
				fileName: input.fileName,
				imageKey: input.imageKey,
				originalUrl,
				mimeType: input.mimeType,
				fileSizeBytes: input.fileSizeBytes,
				contentHash: input.contentHash,
				width: input.width,
				height: input.height,
				isPdf,
				pageCount: isPdf ? input.pageCount : 1,
				pageImages: isPdf ? input.pageImages : null,
				customPrompt: input.customPrompt,
				status: 'pending',
				createdAt: timestamp,
				updatedAt: timestamp
			});

			await incrementUsage(ctx.user.id, input.fileSizeBytes);

			// Build the prompt for OCR processing
			const prompt = buildPrompt(input.customPrompt);

			// Return info for client to connect via WebSocket and trigger processing
			return {
				id: input.imageId,
				isDuplicate: false,
				isPdf,
				pageCount: isPdf ? input.pageCount : 1,
				status: 'pending' as const,
				wsUrl: `/api/ocr/${input.imageId}/ws`,
				processUrl: `/api/ocr/${input.imageId}/process`,
				processPayload: {
					imageId: input.imageId,
					userId: ctx.user.id,
					imageKey: input.imageKey,
					prompt,
					isPdf,
					pageCount: isPdf ? input.pageCount : 1,
					pageImages: isPdf ? input.pageImages : null
				}
			};
		}),

	rescan: protectedProcedure
		.input(
			z.object({
				id: z.string().uuid(),
				customPrompt: z.string().max(1000).nullable().optional()
			})
		)
		.mutation(async ({ ctx, input }) => {
			const platform = ctx.platform;

			if (!platform?.env?.OCR_SESSION) {
				throw new TRPCError({
					code: 'INTERNAL_SERVER_ERROR',
					message: 'OCR service not configured'
				});
			}

			// Get the existing image
			const existing = await db.query.scannedImage.findFirst({
				where: and(eq(scannedImage.id, input.id), eq(scannedImage.userId, ctx.user.id))
			});

			if (!existing) {
				throw new TRPCError({
					code: 'NOT_FOUND',
					message: 'Image not found'
				});
			}

			// Update custom prompt - null clears it, undefined keeps existing
			const newPrompt =
				input.customPrompt === undefined ? existing.customPrompt : input.customPrompt;

			// Reset the image status to pending
			await db
				.update(scannedImage)
				.set({
					status: 'pending',
					extractedText: null,
					errorMessage: null,
					processingTimeMs: null,
					customPrompt: newPrompt || null,
					updatedAt: now()
				})
				.where(eq(scannedImage.id, input.id));

			// Reset the DO session state
			const doId = platform.env.OCR_SESSION.idFromName(input.id);
			const stub = platform.env.OCR_SESSION.get(doId);

			await stub.fetch(new Request('https://do/reset', { method: 'POST' }));

			// Build the prompt for OCR processing
			const prompt = buildPrompt(newPrompt);

			return {
				id: input.id,
				isPdf: existing.isPdf,
				pageCount: existing.isPdf ? existing.pageCount : 1,
				status: 'pending',
				wsUrl: `/api/ocr/${input.id}/ws`,
				processUrl: `/api/ocr/${input.id}/process`,
				processPayload: {
					imageId: input.id,
					userId: ctx.user.id,
					imageKey: existing.imageKey,
					prompt,
					isPdf: existing.isPdf,
					pageCount: existing.isPdf ? existing.pageCount : 1,
					pageImages: existing.isPdf ? existing.pageImages : null
				}
			};
		}),

	delete: protectedProcedure
		.input(z.object({ id: z.string().uuid() }))
		.mutation(async ({ ctx, input }) => {
			const existing = await db.query.scannedImage.findFirst({
				where: and(eq(scannedImage.id, input.id), eq(scannedImage.userId, ctx.user.id)),
				columns: { id: true, imageKey: true, isPdf: true, pageImages: true }
			});

			if (!existing) {
				throw new TRPCError({
					code: 'NOT_FOUND',
					message: 'Image not found'
				});
			}

			// Collect all R2 keys to delete (original + page images for PDFs)
			const keysToDelete: string[] = [];
			if (existing.imageKey) {
				keysToDelete.push(existing.imageKey);
			}
			if (existing.isPdf && existing.pageImages) {
				keysToDelete.push(...existing.pageImages);
			}

			// Delete from R2 and DB in parallel
			const platform = ctx.platform;
			await Promise.all([
				platform?.env?.R2_BUCKET && keysToDelete.length > 0
					? Promise.all(keysToDelete.map((key) => platform.env.R2_BUCKET.delete(key)))
					: Promise.resolve(),
				db.delete(scannedImage).where(eq(scannedImage.id, input.id))
			]);

			return { success: true };
		}),

	bulkDelete: protectedProcedure
		.input(z.object({ ids: z.array(z.string().uuid()).min(1).max(100) }))
		.mutation(async ({ ctx, input }) => {
			const { ids } = input;

			// Get all images that belong to this user
			const existingImages = await db.query.scannedImage.findMany({
				where: and(eq(scannedImage.userId, ctx.user.id), inArray(scannedImage.id, ids)),
				columns: { id: true, imageKey: true, isPdf: true, pageImages: true }
			});

			if (existingImages.length === 0) {
				throw new TRPCError({
					code: 'NOT_FOUND',
					message: 'No images found'
				});
			}

			// Collect all R2 keys to delete (original files + page images for PDFs)
			const keysToDelete: string[] = [];
			for (const img of existingImages) {
				if (img.imageKey) {
					keysToDelete.push(img.imageKey);
				}
				if (img.isPdf && img.pageImages) {
					keysToDelete.push(...img.pageImages);
				}
			}
			const imageIds = existingImages.map((img) => img.id);

			const platform = ctx.platform;

			// Delete from R2 and DB in parallel
			await Promise.all([
				// Delete all images from R2
				platform?.env?.R2_BUCKET && keysToDelete.length > 0
					? Promise.all(keysToDelete.map((key) => platform.env.R2_BUCKET.delete(key)))
					: Promise.resolve(),
				// Delete all from DB
				db
					.delete(scannedImage)
					.where(and(eq(scannedImage.userId, ctx.user.id), inArray(scannedImage.id, imageIds)))
			]);

			return { success: true, deletedCount: existingImages.length };
		})
});
