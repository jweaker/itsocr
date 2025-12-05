<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { trpc } from '$lib/trpc/client';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Separator } from '$lib/components/ui/separator';

	interface Props {
		data: {
			imageId: string;
			user: {
				id: string;
				name: string;
				email: string;
			};
		};
	}

	let { data }: Props = $props();

	// Image state
	let image = $state<{
		id: string;
		fileName: string;
		originalUrl: string;
		mimeType: string;
		fileSizeBytes: number;
		width: number | null;
		height: number | null;
		status: string;
		extractedText: string | null;
		customPrompt: string | null;
		errorMessage: string | null;
		processingTimeMs: number | null;
		confidence: number | null;
		language: string | null;
		createdAt: Date;
		updatedAt: Date;
	} | null>(null);

	let isLoading = $state(true);
	let error = $state<string | null>(null);
	let copied = $state(false);
	let isDeleteDialogOpen = $state(false);
	let isDeleting = $state(false);

	// Polling for processing status
	let pollInterval: ReturnType<typeof setInterval> | null = null;

	onMount(() => {
		loadImage();
		return () => {
			if (pollInterval) clearInterval(pollInterval);
		};
	});

	async function loadImage() {
		isLoading = true;
		error = null;
		try {
			const result = await trpc.images.get.query({ id: data.imageId });
			image = result;

			// Start polling if still processing
			if (result.status === 'pending' || result.status === 'processing') {
				startPolling();
			}
		} catch (e) {
			console.error('Failed to load image:', e);
			error = e instanceof Error ? e.message : 'Failed to load image';
		} finally {
			isLoading = false;
		}
	}

	function startPolling() {
		if (pollInterval) return;
		pollInterval = setInterval(async () => {
			try {
				const result = await trpc.images.get.query({ id: data.imageId });
				image = result;
				if (result.status !== 'pending' && result.status !== 'processing') {
					if (pollInterval) {
						clearInterval(pollInterval);
						pollInterval = null;
					}
				}
			} catch (e) {
				console.error('Polling error:', e);
			}
		}, 3000);
	}

	async function copyToClipboard() {
		if (!image?.extractedText) return;
		try {
			await navigator.clipboard.writeText(image.extractedText);
			copied = true;
			setTimeout(() => (copied = false), 2000);
		} catch (e) {
			console.error('Failed to copy:', e);
		}
	}

	async function handleDelete() {
		if (!image) return;
		isDeleting = true;
		try {
			await trpc.images.delete.mutate({ id: image.id });
			goto('/dashboard');
		} catch (e) {
			console.error('Failed to delete:', e);
			error = e instanceof Error ? e.message : 'Failed to delete image';
		} finally {
			isDeleting = false;
			isDeleteDialogOpen = false;
		}
	}

	function formatDate(date: Date | string) {
		const d = new Date(date);
		return d.toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	function formatFileSize(bytes: number) {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	}

	function getStatusColor(status: string) {
		switch (status) {
			case 'completed':
				return 'text-green-500';
			case 'processing':
				return 'text-yellow-500';
			case 'failed':
				return 'text-red-500';
			default:
				return 'text-muted-foreground';
		}
	}

	function getStatusBgColor(status: string) {
		switch (status) {
			case 'completed':
				return 'bg-green-500/10';
			case 'processing':
				return 'bg-yellow-500/10';
			case 'failed':
				return 'bg-red-500/10';
			default:
				return 'bg-muted';
		}
	}
</script>

<div class="flex min-h-screen flex-col bg-background">
	<!-- Header -->
	<header class="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-sm">
		<div class="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
			<div class="flex items-center gap-4">
				<Button variant="ghost" size="sm" onclick={() => goto('/dashboard')} class="-ml-2 gap-2">
					<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M10 19l-7-7m0 0l7-7m-7 7h18"
						/>
					</svg>
					Back
				</Button>
				<Separator orientation="vertical" class="h-6" />
				<h1 class="max-w-[200px] truncate text-sm font-semibold sm:max-w-md">
					{image?.fileName || 'Loading...'}
				</h1>
			</div>
			<div class="flex items-center gap-2">
				<Button variant="outline" size="sm" onclick={() => goto('/dashboard')}>
					<svg class="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M12 4v16m8-8H4"
						/>
					</svg>
					New Scan
				</Button>
				{#if image}
					<Button variant="outline" size="sm" onclick={() => (isDeleteDialogOpen = true)}>
						<svg
							class="h-4 w-4 text-destructive"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
							/>
						</svg>
					</Button>
				{/if}
			</div>
		</div>
	</header>

	<!-- Main Content -->
	<main class="flex-1">
		<div class="mx-auto max-w-7xl px-4 py-6 sm:px-6">
			{#if isLoading}
				<div class="flex h-64 items-center justify-center">
					<div class="flex flex-col items-center gap-4">
						<div
							class="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"
						></div>
						<p class="text-sm text-muted-foreground">Loading image...</p>
					</div>
				</div>
			{:else if error}
				<div class="flex h-64 flex-col items-center justify-center gap-4">
					<p class="text-destructive">{error}</p>
					<Button onclick={loadImage}>Try again</Button>
				</div>
			{:else if image}
				<div class="grid gap-6 lg:grid-cols-3">
					<!-- Image Preview -->
					<div class="space-y-4 lg:col-span-1">
						<Card.Root class="overflow-hidden">
							<div class="relative bg-muted/30">
								<img
									src={image.originalUrl}
									alt={image.fileName}
									class="w-full object-contain p-4"
									style="max-height: 400px;"
								/>
							</div>
						</Card.Root>

						<!-- Metadata Card -->
						<Card.Root>
							<Card.Header class="pb-3">
								<Card.Title class="text-sm">Details</Card.Title>
							</Card.Header>
							<Card.Content class="space-y-3 text-sm">
								<div class="flex justify-between">
									<span class="text-muted-foreground">Status</span>
									<span class="flex items-center gap-1.5 {getStatusColor(image.status)}">
										{#if image.status === 'processing'}
											<div class="h-2 w-2 animate-pulse rounded-full bg-yellow-500"></div>
										{:else if image.status === 'completed'}
											<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
												<path
													stroke-linecap="round"
													stroke-linejoin="round"
													stroke-width="2"
													d="M5 13l4 4L19 7"
												/>
											</svg>
										{:else if image.status === 'failed'}
											<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
												<path
													stroke-linecap="round"
													stroke-linejoin="round"
													stroke-width="2"
													d="M6 18L18 6M6 6l12 12"
												/>
											</svg>
										{/if}
										{image.status.charAt(0).toUpperCase() + image.status.slice(1)}
									</span>
								</div>
								<Separator />
								<div class="flex justify-between">
									<span class="text-muted-foreground">Created</span>
									<span>{formatDate(image.createdAt)}</span>
								</div>
								<div class="flex justify-between">
									<span class="text-muted-foreground">File Size</span>
									<span>{formatFileSize(image.fileSizeBytes)}</span>
								</div>
								<div class="flex justify-between">
									<span class="text-muted-foreground">Type</span>
									<span>{image.mimeType.split('/')[1].toUpperCase()}</span>
								</div>
								{#if image.width && image.height}
									<div class="flex justify-between">
										<span class="text-muted-foreground">Dimensions</span>
										<span>{image.width} x {image.height}</span>
									</div>
								{/if}
								{#if image.processingTimeMs}
									<div class="flex justify-between">
										<span class="text-muted-foreground">Processing Time</span>
										<span>{(image.processingTimeMs / 1000).toFixed(2)}s</span>
									</div>
								{/if}
								{#if image.confidence}
									<div class="flex justify-between">
										<span class="text-muted-foreground">Confidence</span>
										<span>{(image.confidence * 100).toFixed(0)}%</span>
									</div>
								{/if}
								{#if image.language}
									<div class="flex justify-between">
										<span class="text-muted-foreground">Language</span>
										<span>{image.language}</span>
									</div>
								{/if}
							</Card.Content>
						</Card.Root>
					</div>

					<!-- Result Viewer -->
					<div class="lg:col-span-2">
						<Card.Root class="flex h-full flex-col">
							<Card.Header
								class="flex-row items-center justify-between space-y-0 border-b bg-muted/30 pb-3"
							>
								<div class="flex items-center gap-2">
									<svg
										class="h-4 w-4 text-primary"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
										/>
									</svg>
									<Card.Title class="text-sm">Extracted Text</Card.Title>
									<span
										class="rounded-md border bg-muted px-2 py-0.5 text-xs text-muted-foreground"
									>
										Plain Text
									</span>
								</div>
								{#if image.extractedText}
									<Button variant="ghost" size="sm" onclick={copyToClipboard} class="gap-1.5">
										{#if copied}
											<svg
												class="h-4 w-4 text-green-500"
												fill="none"
												viewBox="0 0 24 24"
												stroke="currentColor"
											>
												<path
													stroke-linecap="round"
													stroke-linejoin="round"
													stroke-width="2"
													d="M5 13l4 4L19 7"
												/>
											</svg>
											Copied
										{:else}
											<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
												<path
													stroke-linecap="round"
													stroke-linejoin="round"
													stroke-width="2"
													d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
												/>
											</svg>
											Copy
										{/if}
									</Button>
								{/if}
							</Card.Header>

							<Card.Content class="flex-1 p-6">
								{#if image.status === 'processing' || image.status === 'pending'}
									<div class="flex h-full min-h-[300px] flex-col items-center justify-center gap-4">
										<div class="relative">
											<div
												class="h-12 w-12 animate-spin rounded-full border-4 border-primary/20 border-t-primary"
											></div>
											<div class="absolute inset-0 flex items-center justify-center">
												<svg
													class="h-4 w-4 animate-pulse text-primary"
													fill="none"
													viewBox="0 0 24 24"
													stroke="currentColor"
												>
													<path
														stroke-linecap="round"
														stroke-linejoin="round"
														stroke-width="2"
														d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
													/>
												</svg>
											</div>
										</div>
										<p class="animate-pulse text-sm text-muted-foreground">
											Analyzing document structure...
										</p>
									</div>
								{:else if image.status === 'failed'}
									<div class="flex h-full min-h-[300px] flex-col items-center justify-center gap-4">
										<div class="rounded-full bg-destructive/10 p-4">
											<svg
												class="h-8 w-8 text-destructive"
												fill="none"
												viewBox="0 0 24 24"
												stroke="currentColor"
											>
												<path
													stroke-linecap="round"
													stroke-linejoin="round"
													stroke-width="2"
													d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
												/>
											</svg>
										</div>
										<div class="text-center">
											<p class="font-medium text-destructive">Processing Failed</p>
											{#if image.errorMessage}
												<p class="mt-1 max-w-md text-sm text-muted-foreground">
													{image.errorMessage}
												</p>
											{/if}
										</div>
									</div>
								{:else if !image.extractedText}
									<div
										class="flex h-full min-h-[300px] flex-col items-center justify-center gap-4 text-muted-foreground/50"
									>
										<svg
											class="h-12 w-12 opacity-20"
											fill="none"
											viewBox="0 0 24 24"
											stroke="currentColor"
										>
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												stroke-width="2"
												d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
											/>
										</svg>
										<p class="text-sm">No text was extracted from this image.</p>
									</div>
								{:else}
									<div
										class="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap font-mono text-sm leading-relaxed"
									>
										{image.extractedText}
									</div>
								{/if}
							</Card.Content>

							{#if image.customPrompt}
								<div class="border-t bg-muted/30 px-6 py-3">
									<p class="text-xs text-muted-foreground">
										<span class="font-medium">Custom prompt:</span>
										{image.customPrompt}
									</p>
								</div>
							{/if}
						</Card.Root>
					</div>
				</div>
			{/if}
		</div>
	</main>
</div>

<!-- Delete Confirmation Dialog -->
<Dialog.Root bind:open={isDeleteDialogOpen}>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>Delete Image</Dialog.Title>
			<Dialog.Description>
				Are you sure you want to delete this image? This action cannot be undone.
			</Dialog.Description>
		</Dialog.Header>
		<Dialog.Footer class="gap-2 sm:gap-0">
			<Button variant="outline" onclick={() => (isDeleteDialogOpen = false)} disabled={isDeleting}>
				Cancel
			</Button>
			<Button variant="destructive" onclick={handleDelete} disabled={isDeleting}>
				{#if isDeleting}
					<div
						class="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
					></div>
				{/if}
				Delete
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
