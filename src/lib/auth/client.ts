import { createAuthClient } from 'better-auth/svelte';

export const authClient = createAuthClient({
	baseURL: import.meta.env.VITE_BETTER_AUTH_URL || ''
});

export const { signIn, signUp, signOut, useSession } = authClient;
