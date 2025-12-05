import { createAuthClient } from 'better-auth/svelte';
import { browser } from '$app/environment';

// In the browser, always use the current origin to avoid CORS issues
// The VITE_BETTER_AUTH_URL is only useful for SSR or specific dev scenarios
export const authClient = createAuthClient({
	baseURL: browser ? window.location.origin : import.meta.env.VITE_BETTER_AUTH_URL || ''
});

export const { signIn, signUp, signOut, useSession } = authClient;
