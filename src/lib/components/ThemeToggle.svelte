<script lang="ts">
	import { browser } from '$app/environment';
	import { Button } from '$lib/components/ui/button';
	import { getTheme, setTheme, type Theme } from '$lib/stores/theme';

	interface Props {
		showLabel?: boolean;
	}

	let { showLabel = false }: Props = $props();

	// Initialize immediately on client, fallback to 'light' on server
	let currentTheme = $state<Theme>(browser ? getTheme() : 'light');

	function toggle() {
		const next: Theme = currentTheme === 'light' ? 'dark' : 'light';
		currentTheme = next;
		setTheme(next);
	}
</script>

<Button
	variant="ghost"
	size={showLabel ? 'sm' : 'icon'}
	onclick={toggle}
	class={showLabel ? 'gap-2' : 'h-9 w-9'}
	aria-label="Toggle theme"
>
	{#if currentTheme === 'light'}
		<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				stroke-width="2"
				d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
			/>
		</svg>
	{:else}
		<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				stroke-width="2"
				d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
			/>
		</svg>
	{/if}
	{#if showLabel}
		<span class="text-sm">{currentTheme === 'light' ? 'Light' : 'Dark'}</span>
	{/if}
</Button>
