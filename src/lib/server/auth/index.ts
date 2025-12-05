import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from '$lib/server/db';
import * as schema from '$lib/server/db/schema';
import { env } from '$env/dynamic/private';

export const auth = betterAuth({
	database: drizzleAdapter(db, {
		provider: 'sqlite',
		schema: {
			user: schema.user,
			session: schema.session,
			account: schema.account,
			verification: schema.verification
		}
	}),
	secret: env.BETTER_AUTH_SECRET,
	baseURL: env.BETTER_AUTH_BASE_URL,
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
});

export type Auth = typeof auth;
