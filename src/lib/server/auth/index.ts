import { betterAuth, type BetterAuthOptions } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db, isDatabaseConfigured } from '$lib/server/db';
import * as schema from '$lib/server/db/schema';
import { env } from '$env/dynamic/private';
import { dev } from '$app/environment';

// Minimum secret length required by better-auth
const MIN_SECRET_LENGTH = 32;

// Check if auth is properly configured
export function isAuthConfigured(): boolean {
	if (!isDatabaseConfigured()) return false;
	const secret = env.BETTER_AUTH_SECRET || (dev ? 'dev-secret-change-in-production-32chars!' : '');
	if (secret.length < MIN_SECRET_LENGTH) return false;
	return true;
}

// Lazy auth instance - only created when accessed and configured
let _auth: ReturnType<typeof betterAuth> | null = null;
let _authError: Error | null = null;

function createAuth() {
	if (_auth) return _auth;
	if (_authError) throw _authError;

	const secret = env.BETTER_AUTH_SECRET || (dev ? 'dev-secret-change-in-production-32chars!' : '');

	if (secret.length < MIN_SECRET_LENGTH) {
		_authError = new Error(
			`BETTER_AUTH_SECRET must be at least ${MIN_SECRET_LENGTH} characters. ` +
				'Generate one with: openssl rand -base64 32'
		);
		throw _authError;
	}

	if (!isDatabaseConfigured()) {
		_authError = new Error('Database is not configured');
		throw _authError;
	}

	try {
		// In dev mode, use localhost. In production, use BETTER_AUTH_BASE_URL
		const baseURL = dev ? 'http://localhost:5173' : env.BETTER_AUTH_BASE_URL || '';

		// Build trusted origins list
		const trustedOrigins: string[] = [];
		if (baseURL) trustedOrigins.push(baseURL);
		if (dev) {
			trustedOrigins.push('http://localhost:5173');
			trustedOrigins.push('http://localhost:5174');
			trustedOrigins.push('http://localhost:5175');
		}
		// Add production origins
		trustedOrigins.push('https://itsocr.jweaker.workers.dev');
		trustedOrigins.push('https://itsocr.jweaker-t.workers.dev');
		trustedOrigins.push('https://itsocr.com');
		trustedOrigins.push('https://www.itsocr.com');

		const authOptions: BetterAuthOptions = {
			database: drizzleAdapter(db, {
				provider: 'sqlite',
				schema: {
					user: schema.user,
					session: schema.session,
					account: schema.account,
					verification: schema.verification
				}
			}),
			secret,
			baseURL,
			trustedOrigins,
			emailAndPassword: {
				enabled: true,
				requireEmailVerification: false
			},
			socialProviders: {
				github: {
					clientId: env.BETTER_AUTH_GITHUB_CLIENT_ID || '',
					clientSecret: env.BETTER_AUTH_GITHUB_CLIENT_SECRET || '',
					enabled: !!(env.BETTER_AUTH_GITHUB_CLIENT_ID && env.BETTER_AUTH_GITHUB_CLIENT_SECRET)
				},
				google: {
					clientId: env.BETTER_AUTH_GOOGLE_CLIENT_ID || '',
					clientSecret: env.BETTER_AUTH_GOOGLE_CLIENT_SECRET || '',
					enabled: !!(env.BETTER_AUTH_GOOGLE_CLIENT_ID && env.BETTER_AUTH_GOOGLE_CLIENT_SECRET)
				}
			}
		};

		_auth = betterAuth(authOptions);
		return _auth;
	} catch (e) {
		_authError = e instanceof Error ? e : new Error(String(e));
		throw _authError;
	}
}

// Export a proxy that lazily initializes auth
export const auth = new Proxy({} as ReturnType<typeof betterAuth>, {
	get(_, prop) {
		const instance = createAuth();
		return (instance as unknown as Record<string | symbol, unknown>)[prop];
	}
});

export type Auth = ReturnType<typeof betterAuth>;
