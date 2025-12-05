<script lang="ts">
	import { onMount } from 'svelte';
	import { Button } from '$lib/components/ui/button';
	import { getTheme, setTheme, type Theme } from '$lib/stores/theme';

	interface Props {
		showLabel?: boolean;
	}

	let { showLabel = false }: Props = $props();

	let currentTheme = $state<Theme>('system');
	let mounted = $state(false);

	onMount(() => {
		currentTheme = getTheme();
		mounted = true;
	});

	function cycle() {
		const themes: Theme[] = ['light', 'dark', 'system'];
		const idx = themes.indexOf(currentTheme);
		const next = themes[(idx + 1) % themes.length];
		currentTheme = next;
		setTheme(next);
	}

	function getLabel(theme: Theme): string {
		return theme.charAt(0).toUpperCase() + theme.slice(1);
	}
</script>

<Button
	variant="ghost"
	size={showLabel ? 'sm' : 'icon'}
	onclick={cycle}
	class={showLabel ? 'gap-2' : 'h-9 w-9'}
	aria-label="Toggle theme"
>
	{#if !mounted}
		<!-- Placeholder during SSR -->
		<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<circle cx="12" cy="12" r="4" stroke-width="2" />
		</svg>
	{:else if currentTheme === 'light'}
		<!-- Sun icon -->
		<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				stroke-width="2"
				d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
			/>
		</svg>
	{:else if currentTheme === 'dark'}
		<!-- Moon icon -->
		<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				stroke-width="2"
				d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
			/>
		</svg>
	{:else}
		<!-- System/auto icon -->
		<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				stroke-width="2"
				d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
			/>
		</svg>
	{/if}
	{#if showLabel && mounted}
		<span class="text-sm">{getLabel(currentTheme)}</span>
	{/if}
</Button>
