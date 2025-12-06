/**
 * API Token Authentication
 *
 * Validates API tokens from the Authorization header and returns the associated user.
 */

import { db } from '$lib/server/db';
import { apiToken, user } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export interface ApiTokenUser {
	id: string;
	name: string;
	email: string;
	planId: string;
	tokenId: string;
	tokenName: string;
}

export interface ApiAuthResult {
	success: boolean;
	user?: ApiTokenUser;
	error?: string;
	statusCode?: number;
}

/**
 * Hash a token using SHA-256
 */
async function hashToken(token: string): Promise<string> {
	const encoder = new TextEncoder();
	const data = encoder.encode(token);
	const hashBuffer = await crypto.subtle.digest('SHA-256', data);
	const hashArray = Array.from(new Uint8Array(hashBuffer));
	return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Validate an API token from the Authorization header
 *
 * @param authHeader - The Authorization header value (e.g., "Bearer itsocr_...")
 * @returns ApiAuthResult with user info if valid, or error details if not
 */
export async function validateApiToken(authHeader: string | null): Promise<ApiAuthResult> {
	if (!authHeader) {
		return {
			success: false,
			error: 'Missing Authorization header',
			statusCode: 401
		};
	}

	// Parse Bearer token
	const parts = authHeader.split(' ');
	if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
		return {
			success: false,
			error: 'Invalid Authorization header format. Expected: Bearer <token>',
			statusCode: 401
		};
	}

	const token = parts[1];

	// Validate token format
	if (!token.startsWith('itsocr_') || token.length !== 39) {
		// itsocr_ (7) + 32 random chars
		return {
			success: false,
			error: 'Invalid token format',
			statusCode: 401
		};
	}

	// Hash the token to lookup in database
	const tokenHash = await hashToken(token);

	// Find the token in database
	const [tokenRecord] = await db
		.select({
			id: apiToken.id,
			name: apiToken.name,
			userId: apiToken.userId,
			expiresAt: apiToken.expiresAt,
			revokedAt: apiToken.revokedAt
		})
		.from(apiToken)
		.where(eq(apiToken.tokenHash, tokenHash));

	if (!tokenRecord) {
		return {
			success: false,
			error: 'Invalid API token',
			statusCode: 401
		};
	}

	// Check if token is revoked
	if (tokenRecord.revokedAt) {
		return {
			success: false,
			error: 'API token has been revoked',
			statusCode: 401
		};
	}

	// Check if token is expired
	if (tokenRecord.expiresAt && tokenRecord.expiresAt < new Date()) {
		return {
			success: false,
			error: 'API token has expired',
			statusCode: 401
		};
	}

	// Get user info
	const [userData] = await db.select().from(user).where(eq(user.id, tokenRecord.userId));

	if (!userData) {
		return {
			success: false,
			error: 'User not found',
			statusCode: 401
		};
	}

	// Update last used timestamp (fire and forget)
	db.update(apiToken)
		.set({ lastUsedAt: new Date(), updatedAt: new Date() })
		.where(eq(apiToken.id, tokenRecord.id))
		.catch((err) => console.error('Failed to update token lastUsedAt:', err));

	return {
		success: true,
		user: {
			id: userData.id,
			name: userData.name,
			email: userData.email,
			planId: userData.planId,
			tokenId: tokenRecord.id,
			tokenName: tokenRecord.name
		}
	};
}

/**
 * CORS headers for API responses
 */
const CORS_HEADERS = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Methods': 'POST, OPTIONS',
	'Access-Control-Allow-Headers': 'Authorization, Content-Type'
};

/**
 * Create a JSON error response for API endpoints
 */
export function apiError(message: string, statusCode: number = 400): Response {
	return new Response(
		JSON.stringify({
			error: message,
			success: false
		}),
		{
			status: statusCode,
			headers: {
				'Content-Type': 'application/json',
				...CORS_HEADERS
			}
		}
	);
}

/**
 * Create a JSON success response for API endpoints
 */
export function apiSuccess<T>(data: T, statusCode: number = 200): Response {
	return new Response(
		JSON.stringify({
			...data,
			success: true
		}),
		{
			status: statusCode,
			headers: {
				'Content-Type': 'application/json',
				...CORS_HEADERS
			}
		}
	);
}
