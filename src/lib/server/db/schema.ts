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

export const scannedImage = sqliteTable(
	'scanned_image',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		fileName: text('file_name').notNull(),
		imageKey: text('image_key').notNull(), // R2 object key
		originalUrl: text('original_url').notNull(), // URL to access the image
		thumbnailUrl: text('thumbnail_url'),
		mimeType: text('mime_type').notNull(),
		fileSizeBytes: integer('file_size_bytes').notNull(),
		width: integer('width'),
		height: integer('height'),
		customPrompt: text('custom_prompt'), // User's custom addition to the default prompt
		extractedText: text('extracted_text'),
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
// Relations
// =============================================================================

export const userRelations = relations(user, ({ many }) => ({
	sessions: many(session),
	accounts: many(account),
	scannedImages: many(scannedImage),
	usageRecords: many(usageRecord)
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
