<script lang="ts">
	import { signIn, signUp } from '$lib/auth/client';
	import { goto } from '$app/navigation';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Separator } from '$lib/components/ui/separator';

	let isLogin = $state(true);
	let email = $state('');
	let password = $state('');
	let name = $state('');
	let error = $state('');
	let loading = $state(false);

	async function handleSubmit(e: Event) {
		e.preventDefault();
		error = '';
		loading = true;

		try {
			if (isLogin) {
				const result = await signIn.email({
					email,
					password
				});

				if (result.error) {
					error = result.error.message || 'Login failed';
				} else {
					goto('/dashboard');
				}
			} else {
				const result = await signUp.email({
					email,
					password,
					name
				});

				if (result.error) {
					error = result.error.message || 'Sign up failed';
				} else {
					goto('/dashboard');
				}
			}
		} catch (err) {
			error = 'An unexpected error occurred';
		} finally {
			loading = false;
		}
	}

	async function handleGitHubLogin() {
		await signIn.social({
			provider: 'github',
			callbackURL: '/dashboard'
		});
	}

	async function handleGoogleLogin() {
		await signIn.social({
			provider: 'google',
			callbackURL: '/dashboard'
		});
	}
</script>

<div class="flex min-h-screen items-center justify-center bg-background px-4">
	<div class="w-full max-w-sm">
		<div class="mb-8 text-center">
			<a href="/" class="inline-flex items-center justify-center gap-2">
				<div
					class="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary"
				>
					<svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
						/>
					</svg>
				</div>
				<span class="text-2xl font-bold tracking-tight">ItsOCR</span>
			</a>
			<p class="mt-3 text-sm text-muted-foreground">
				{isLogin ? 'Welcome back' : 'Create your account'}
			</p>
		</div>

		<Card.Root>
			<Card.Header class="space-y-1">
				<Card.Title class="text-xl">{isLogin ? 'Sign in' : 'Sign up'}</Card.Title>
				<Card.Description>
					{isLogin ? 'Enter your credentials to continue' : 'Enter your details to get started'}
				</Card.Description>
			</Card.Header>

			<Card.Content>
				<form onsubmit={handleSubmit} class="space-y-4">
					{#if !isLogin}
						<div class="space-y-2">
							<Label for="name">Name</Label>
							<Input type="text" id="name" placeholder="John Doe" bind:value={name} required />
						</div>
					{/if}

					<div class="space-y-2">
						<Label for="email">Email</Label>
						<Input
							type="email"
							id="email"
							placeholder="you@example.com"
							bind:value={email}
							required
						/>
					</div>

					<div class="space-y-2">
						<Label for="password">Password</Label>
						<Input
							type="password"
							id="password"
							placeholder="••••••••"
							bind:value={password}
							required
						/>
					</div>

					{#if error}
						<p class="text-sm text-destructive">{error}</p>
					{/if}

					<Button type="submit" class="w-full" disabled={loading}>
						{#if loading}
							<span
								class="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
							></span>
						{/if}
						{isLogin ? 'Sign in' : 'Sign up'}
					</Button>
				</form>

				<div class="relative my-6">
					<div class="absolute inset-0 flex items-center">
						<Separator class="w-full" />
					</div>
					<div class="relative flex justify-center text-xs uppercase">
						<span class="bg-card px-2 text-muted-foreground">or continue with</span>
					</div>
				</div>

				<div class="grid grid-cols-2 gap-3">
					<Button variant="outline" type="button" onclick={handleGitHubLogin}>
						<svg class="mr-2 h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
							<path
								d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"
							/>
						</svg>
						GitHub
					</Button>
					<Button variant="outline" type="button" onclick={handleGoogleLogin}>
						<svg class="mr-2 h-4 w-4" viewBox="0 0 24 24">
							<path
								fill="#4285F4"
								d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
							/>
							<path
								fill="#34A853"
								d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
							/>
							<path
								fill="#FBBC05"
								d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
							/>
							<path
								fill="#EA4335"
								d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
							/>
						</svg>
						Google
					</Button>
				</div>
			</Card.Content>

			<Card.Footer class="flex justify-center">
				<p class="text-sm text-muted-foreground">
					{isLogin ? "Don't have an account?" : 'Already have an account?'}
					<button
						type="button"
						class="ml-1 font-medium text-primary underline-offset-4 hover:underline"
						onclick={() => (isLogin = !isLogin)}
					>
						{isLogin ? 'Sign up' : 'Sign in'}
					</button>
				</p>
			</Card.Footer>
		</Card.Root>

		<p class="mt-6 text-center text-xs text-muted-foreground">
			<a href="/" class="hover:underline">Back to home</a>
		</p>
	</div>
</div>
