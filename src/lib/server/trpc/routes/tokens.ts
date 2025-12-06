import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../index.js';
import { db } from '$lib/server/db';
import { apiToken } from '$lib/server/db/schema';
import { eq, and, isNull, desc } from 'drizzle-orm';
import { generateId } from '$lib/server/utils';

// Token prefix for identification
const TOKEN_PREFIX = 'itsocr_';

/**
 * Generate a secure random token
 * Format: itsocr_<32 random chars>
 */
function generateToken(): string {
	const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	let token = TOKEN_PREFIX;
	const randomValues = new Uint8Array(32);
	crypto.getRandomValues(randomValues);
	for (let i = 0; i < 32; i++) {
		token += chars[randomValues[i] % chars.length];
	}
	return token;
}

/**
 * Hash a token using SHA-256 for secure storage
 */
async function hashToken(token: string): Promise<string> {
	const encoder = new TextEncoder();
	const data = encoder.encode(token);
	const hashBuffer = await crypto.subtle.digest('SHA-256', data);
	const hashArray = Array.from(new Uint8Array(hashBuffer));
	return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Extract prefix from token for identification
 */
function getTokenPrefix(token: string): string {
	// Return first 12 characters (itsocr_ + first 5 random chars)
	return token.substring(0, 12);
}

export const tokensRouter = router({
	/**
	 * List all API tokens for the current user
	 * Returns tokens without the actual token value (only prefix for identification)
	 */
	list: protectedProcedure.query(async ({ ctx }) => {
		const tokens = await db
			.select({
				id: apiToken.id,
				name: apiToken.name,
				tokenPrefix: apiToken.tokenPrefix,
				lastUsedAt: apiToken.lastUsedAt,
				expiresAt: apiToken.expiresAt,
				revokedAt: apiToken.revokedAt,
				createdAt: apiToken.createdAt
			})
			.from(apiToken)
			.where(eq(apiToken.userId, ctx.user.id))
			.orderBy(desc(apiToken.createdAt));

		return tokens.map((t) => ({
			...t,
			isActive: !t.revokedAt && (!t.expiresAt || t.expiresAt > new Date()),
			lastUsedAt: t.lastUsedAt?.toISOString() ?? null,
			expiresAt: t.expiresAt?.toISOString() ?? null,
			revokedAt: t.revokedAt?.toISOString() ?? null,
			createdAt: t.createdAt.toISOString()
		}));
	}),

	/**
	 * Create a new API token
	 * Returns the full token value - this is the only time it's visible
	 */
	create: protectedProcedure
		.input(
			z.object({
				name: z.string().min(1).max(100),
				expiresInDays: z.number().int().min(1).max(365).optional()
			})
		)
		.mutation(async ({ ctx, input }) => {
			// Limit number of active tokens per user
			const MAX_TOKENS = 10;
			const activeTokens = await db
				.select({ id: apiToken.id })
				.from(apiToken)
				.where(and(eq(apiToken.userId, ctx.user.id), isNull(apiToken.revokedAt)));

			if (activeTokens.length >= MAX_TOKENS) {
				throw new TRPCError({
					code: 'BAD_REQUEST',
					message: `You can have a maximum of ${MAX_TOKENS} active API tokens. Please revoke unused tokens.`
				});
			}

			// Generate token
			const token = generateToken();
			const tokenHash = await hashToken(token);
			const tokenPrefix = getTokenPrefix(token);
			const now = new Date();
			const expiresAt = input.expiresInDays
				? new Date(now.getTime() + input.expiresInDays * 24 * 60 * 60 * 1000)
				: null;

			const id = generateId();

			await db.insert(apiToken).values({
				id,
				userId: ctx.user.id,
				name: input.name,
				tokenHash,
				tokenPrefix,
				expiresAt,
				createdAt: now,
				updatedAt: now
			});

			return {
				id,
				name: input.name,
				token, // Only returned once at creation!
				tokenPrefix,
				expiresAt: expiresAt?.toISOString() ?? null,
				createdAt: now.toISOString()
			};
		}),

	/**
	 * Revoke an API token
	 */
	revoke: protectedProcedure
		.input(z.object({ id: z.string() }))
		.mutation(async ({ ctx, input }) => {
			// Check token belongs to user
			const [existingToken] = await db
				.select()
				.from(apiToken)
				.where(and(eq(apiToken.id, input.id), eq(apiToken.userId, ctx.user.id)));

			if (!existingToken) {
				throw new TRPCError({
					code: 'NOT_FOUND',
					message: 'Token not found'
				});
			}

			if (existingToken.revokedAt) {
				throw new TRPCError({
					code: 'BAD_REQUEST',
					message: 'Token is already revoked'
				});
			}

			const now = new Date();
			await db
				.update(apiToken)
				.set({ revokedAt: now, updatedAt: now })
				.where(eq(apiToken.id, input.id));

			return { success: true };
		}),

	/**
	 * Delete an API token permanently
	 */
	delete: protectedProcedure
		.input(z.object({ id: z.string() }))
		.mutation(async ({ ctx, input }) => {
			// Check token belongs to user
			const [existingToken] = await db
				.select()
				.from(apiToken)
				.where(and(eq(apiToken.id, input.id), eq(apiToken.userId, ctx.user.id)));

			if (!existingToken) {
				throw new TRPCError({
					code: 'NOT_FOUND',
					message: 'Token not found'
				});
			}

			await db.delete(apiToken).where(eq(apiToken.id, input.id));

			return { success: true };
		})
});
