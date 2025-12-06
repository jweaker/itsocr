import { integer, sqliteTable, text, index, real, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';

// Re-export plan types and utilities from config
// Note: Using relative import for drizzle-kit compatibility (it runs outside SvelteKit bundler)
export { type PlanId, type Plan, PLANS, PLAN_LIST, getPlan } from '../config/plans';

// =============================================================================
// Better Auth tables (with custom planId field)
// =============================================================================

export const user = sqliteTable('user', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	email: text('email').notNull().unique(),
	emailVerified: integer('email_verified', { mode: 'boolean' }).notNull().default(false),
	image: text('image'),
	planId: text('plan_id').notNull().default('free'), // 'free', 'pro', 'enterprise'
	createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
	updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull()
});

export const session = sqliteTable('session', {
	id: text('id').primaryKey(),
	expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
	token: text('token').notNull().unique(),
	createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
	updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
	ipAddress: text('ip_address'),
	userAgent: text('user_agent'),
	userId: text('user_id')
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' })
});

export const account = sqliteTable('account', {
	id: text('id').primaryKey(),
	accountId: text('account_id').notNull(),
	providerId: text('provider_id').notNull(),
	userId: text('user_id')
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' }),
	accessToken: text('access_token'),
	refreshToken: text('refresh_token'),
	idToken: text('id_token'),
	accessTokenExpiresAt: integer('access_token_expires_at', { mode: 'timestamp' }),
	refreshTokenExpiresAt: integer('refresh_token_expires_at', { mode: 'timestamp' }),
	scope: text('scope'),
	password: text('password'),
	createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
	updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull()
});

export const verification = sqliteTable('verification', {
	id: text('id').primaryKey(),
	identifier: text('identifier').notNull(),
	value: text('value').notNull(),
	expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
	createdAt: integer('created_at', { mode: 'timestamp' }),
	updatedAt: integer('updated_at', { mode: 'timestamp' })
});

// =============================================================================
// Scanned Images
// =============================================================================

// Page delimiter for multi-page PDFs - used to split extracted text by page
export const PAGE_DELIMITER = '\n\n---PAGE_BREAK---\n\n';

export const scannedImage = sqliteTable(
	'scanned_image',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		fileName: text('file_name').notNull(),
		imageKey: text('image_key').notNull(), // R2 object key (for PDFs, this is the original PDF)
		originalUrl: text('original_url').notNull(), // URL to access the image/PDF
		thumbnailUrl: text('thumbnail_url'),
		mimeType: text('mime_type').notNull(),
		fileSizeBytes: integer('file_size_bytes').notNull(),
		contentHash: text('content_hash'), // SHA-256 hash for duplicate detection
		width: integer('width'),
		height: integer('height'),
		// PDF-specific fields
		isPdf: integer('is_pdf', { mode: 'boolean' }).notNull().default(false),
		pageCount: integer('page_count'), // Number of pages (1 for images, N for PDFs)
		pageImages: text('page_images', { mode: 'json' }).$type<string[]>(), // R2 keys for page images
		customPrompt: text('custom_prompt'), // User's custom addition to the default prompt
		extractedText: text('extracted_text'), // For PDFs: pages separated by PAGE_DELIMITER
		confidence: real('confidence'),
		language: text('language'),
		processingTimeMs: integer('processing_time_ms'),
		status: text('status').notNull().default('pending'), // 'pending', 'processing', 'completed', 'failed'
		errorMessage: text('error_message'),
		metadata: text('metadata', { mode: 'json' }),
		createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
		updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull()
	},
	(table) => [
		index('scanned_image_user_idx').on(table.userId),
		index('scanned_image_created_idx').on(table.createdAt),
		index('scanned_image_status_idx').on(table.status),
		index('scanned_image_hash_idx').on(table.userId, table.contentHash), // For duplicate lookup
		uniqueIndex('scanned_image_key_idx').on(table.imageKey)
	]
);

// =============================================================================
// Usage Tracking (for monthly limits)
// =============================================================================

export const usageRecord = sqliteTable(
	'usage_record',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		periodStart: integer('period_start', { mode: 'timestamp' }).notNull(),
		periodEnd: integer('period_end', { mode: 'timestamp' }).notNull(),
		imagesScanned: integer('images_scanned').notNull().default(0),
		bytesProcessed: integer('bytes_processed').notNull().default(0),
		createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
		updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull()
	},
	(table) => [
		index('usage_record_user_idx').on(table.userId),
		index('usage_record_period_idx').on(table.periodStart, table.periodEnd),
		// Composite index for efficient lookups by user and period
		uniqueIndex('usage_record_user_period_idx').on(table.userId, table.periodStart)
	]
);

// =============================================================================
// API Access Tokens (for programmatic access)
// =============================================================================

export const apiToken = sqliteTable(
	'api_token',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		name: text('name').notNull(), // User-friendly name for the token
		// Token is stored as SHA-256 hash for security - original token shown only once at creation
		tokenHash: text('token_hash').notNull().unique(),
		// Prefix for identification (first 8 chars of token, e.g., "itsocr_a1b2c3d4")
		tokenPrefix: text('token_prefix').notNull(),
		lastUsedAt: integer('last_used_at', { mode: 'timestamp' }),
		expiresAt: integer('expires_at', { mode: 'timestamp' }), // null = never expires
		revokedAt: integer('revoked_at', { mode: 'timestamp' }), // null = active
		createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
		updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull()
	},
	(table) => [
		index('api_token_user_idx').on(table.userId),
		index('api_token_hash_idx').on(table.tokenHash),
		index('api_token_prefix_idx').on(table.tokenPrefix)
	]
);

// =============================================================================
// Relations
// =============================================================================

export const userRelations = relations(user, ({ many }) => ({
	sessions: many(session),
	accounts: many(account),
	scannedImages: many(scannedImage),
	usageRecords: many(usageRecord),
	apiTokens: many(apiToken)
}));

export const sessionRelations = relations(session, ({ one }) => ({
	user: one(user, {
		fields: [session.userId],
		references: [user.id]
	})
}));

export const accountRelations = relations(account, ({ one }) => ({
	user: one(user, {
		fields: [account.userId],
		references: [user.id]
	})
}));

export const scannedImageRelations = relations(scannedImage, ({ one }) => ({
	user: one(user, {
		fields: [scannedImage.userId],
		references: [user.id]
	})
}));

export const usageRecordRelations = relations(usageRecord, ({ one }) => ({
	user: one(user, {
		fields: [usageRecord.userId],
		references: [user.id]
	})
}));

export const apiTokenRelations = relations(apiToken, ({ one }) => ({
	user: one(user, {
		fields: [apiToken.userId],
		references: [user.id]
	})
}));
