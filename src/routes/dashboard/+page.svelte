<script lang="ts">
	import ImagePopup from '$lib/components/ImagePopup.svelte';
	import { signOut } from '$lib/auth/client';
	import { goto } from '$app/navigation';

	interface Props {
		data: {
			user: {
				id: string;
				name: string;
				email: string;
			};
		};
	}

	let { data }: Props = $props();

	async function handleSignOut() {
		await signOut();
		goto('/login');
	}
</script>

<main>
	<h1>Dashboard</h1>
	<p>Welcome, {data.user.name}!</p>

	<nav>
		<a href="/">Home</a>
		<a href="/image/example-image-id">View Image</a>
		<button type="button" onclick={handleSignOut}>Sign Out</button>
	</nav>

	<!-- Example usage of ImagePopup component -->
	<ImagePopup />
</main>
