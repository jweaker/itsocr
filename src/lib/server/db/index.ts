import { dev } from '$app/environment';
import { drizzle, type LibSQLDatabase } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as schema from './schema';
import { env } from '$env/dynamic/private';

// In development, default to local SQLite file if DATABASE_URL not set
const databaseUrl = env.DATABASE_URL || (dev ? 'file:local.db' : '');

let _db: LibSQLDatabase<typeof schema> | null = null;
let _initError: Error | null = null;

function initDb(): LibSQLDatabase<typeof schema> {
	if (_db) return _db;
	if (_initError) throw _initError;

	if (!databaseUrl) {
		_initError = new Error('DATABASE_URL is not configured');
		throw _initError;
	}

	try {
		const client = createClient({
			url: databaseUrl,
			authToken: env.DATABASE_AUTH_TOKEN
		});
		_db = drizzle(client, { schema });
		return _db;
	} catch (e) {
		_initError = e instanceof Error ? e : new Error(String(e));
		throw _initError;
	}
}

// Lazy getter - throws if db cannot be initialized
export const db = new Proxy({} as LibSQLDatabase<typeof schema>, {
	get(_, prop) {
		const instance = initDb();
		return (instance as unknown as Record<string | symbol, unknown>)[prop];
	}
});

// Helper to check if database is configured (without throwing)
export function isDatabaseConfigured(): boolean {
	return !!databaseUrl;
}
