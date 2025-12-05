<script lang="ts">
	import { signIn, signUp } from '$lib/auth/client';
	import { goto } from '$app/navigation';

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
		} catch (e) {
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

<main>
	<h1>{isLogin ? 'Login' : 'Sign Up'}</h1>

	<form onsubmit={handleSubmit}>
		{#if !isLogin}
			<div>
				<label for="name">Name</label>
				<input type="text" id="name" bind:value={name} required />
			</div>
		{/if}

		<div>
			<label for="email">Email</label>
			<input type="email" id="email" bind:value={email} required />
		</div>

		<div>
			<label for="password">Password</label>
			<input type="password" id="password" bind:value={password} required />
		</div>

		{#if error}
			<p class="error">{error}</p>
		{/if}

		<button type="submit" disabled={loading}>
			{loading ? 'Loading...' : isLogin ? 'Login' : 'Sign Up'}
		</button>
	</form>

	<div>
		<button type="button" onclick={handleGitHubLogin}>Continue with GitHub</button>
		<button type="button" onclick={handleGoogleLogin}>Continue with Google</button>
	</div>

	<p>
		{isLogin ? "Don't have an account?" : 'Already have an account?'}
		<button type="button" onclick={() => (isLogin = !isLogin)}>
			{isLogin ? 'Sign Up' : 'Login'}
		</button>
	</p>

	<a href="/">Back to Home</a>
</main>
