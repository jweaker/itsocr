<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { trpc } from '$lib/trpc/client';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Separator } from '$lib/components/ui/separator';
	import { Textarea } from '$lib/components/ui/textarea';
	import { Label } from '$lib/components/ui/label';

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
		userId: string;
		fileName: string;
		imageKey: string;
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
		createdAt: string;
		updatedAt: string;
	} | null>(null);

	let isLoading = $state(true);
	let error = $state<string | null>(null);
	let copied = $state(false);
	let isDeleteDialogOpen = $state(false);
	let isDeleting = $state(false);
	let isCancelling = $state(false);
	let isRescanDialogOpen = $state(false);
	let isRescanning = $state(false);
	let rescanPrompt = $state('');

	// WebSocket for real-time updates
	let ws: WebSocket | null = null;
	let wsConnected = $state(false);

	onMount(() => {
		loadImage();
		return () => {
			if (ws) {
				ws.close();
				ws = null;
			}
		};
	});

	async function loadImage() {
		isLoading = true;
		error = null;
		try {
			const result = await trpc.images.get.query({ id: data.imageId });
			image = result as typeof image;

			// Connect WebSocket if still processing
			if (result.status === 'pending' || result.status === 'processing') {
				connectWebSocket();
			}
		} catch (e) {
			console.error('Failed to load image:', e);
			error = e instanceof Error ? e.message : 'Failed to load image';
		} finally {
			isLoading = false;
		}
	}

	function connectWebSocket() {
		if (ws) return;

		const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
		const wsUrl = `${protocol}//${window.location.host}/api/ocr/${data.imageId}/ws`;

		console.log('[WS] Connecting to:', wsUrl);
		ws = new WebSocket(wsUrl);

		ws.onopen = () => {
			console.log('[WS] Connected');
			wsConnected = true;
		};

		ws.onmessage = (event) => {
			try {
				const msg = JSON.parse(event.data);
				console.log('[WS] Message:', msg.type);

				switch (msg.type) {
					case 'connected':
						// WebSocket connected, check if we need to trigger processing
						if (image?.status === 'pending') {
							triggerProcessing();
						}
						break;

					case 'reconnected':
						// Reconnected to an existing session
						if (image) {
							image = { ...image, extractedText: msg.text, status: msg.status };
						}
						break;

					case 'status':
						if (image) {
							image = { ...image, status: msg.status };
						}
						break;

					case 'chunk':
						if (image) {
							image = {
								...image,
								extractedText: (image.extractedText || '') + msg.text,
								status: 'processing'
							};
						}
						break;

					case 'complete':
						if (image) {
							image = {
								...image,
								extractedText: msg.text,
								status: 'completed',
								processingTimeMs: msg.processingTimeMs
							};
						}
						closeWebSocket();
						break;

					case 'error':
						if (image) {
							image = { ...image, status: 'failed', errorMessage: msg.message };
						}
						closeWebSocket();
						break;

					case 'cancelled':
						if (image) {
							image = { ...image, status: 'cancelled' };
						}
						closeWebSocket();
						break;
				}
			} catch (e) {
				console.error('[WS] Parse error:', e);
			}
		};

		ws.onerror = (e) => {
			console.error('[WS] Error:', e);
		};

		ws.onclose = () => {
			console.log('[WS] Closed');
			wsConnected = false;
			ws = null;
		};
	}

	async function triggerProcessing() {
		if (!image) return;

		try {
			// Trigger processing via the process endpoint
			const response = await fetch(`/api/ocr/${data.imageId}/process`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					imageId: image.id,
					userId: image.userId,
					imageKey: image.imageKey,
					prompt: buildPrompt(image.customPrompt)
				})
			});

			if (!response.ok) {
				const err = (await response.json()) as { error?: string };
				console.error('[Process] Failed:', err);
			}
		} catch (e) {
			console.error('[Process] Error:', e);
		}
	}

	function buildPrompt(customPrompt: string | null): string {
		const basePrompt =
			'Extract all text from this image exactly as it appears. Preserve the original formatting and line breaks. Only output the text, nothing else.';
		return customPrompt
			? `${basePrompt}\n\nAdditional instructions: ${customPrompt.trim()}`
			: basePrompt;
	}

	function closeWebSocket() {
		if (ws) {
			ws.close();
			ws = null;
			wsConnected = false;
		}
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

	function downloadAsTxt() {
		if (!image?.extractedText) return;
		const blob = new Blob([image.extractedText], { type: 'text/plain' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `${image.fileName.replace(/\.[^/.]+$/, '')}.txt`;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	}

	function downloadAsDocx() {
		if (!image?.extractedText) return;
		// Create a simple DOCX-compatible HTML that Word can open
		const content = `
			<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
			<head><meta charset='utf-8'><title>${image.fileName}</title></head>
			<body><pre style="font-family: Consolas, monospace; white-space: pre-wrap;">${image.extractedText.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre></body>
			</html>
		`;
		const blob = new Blob([content], {
			type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
		});
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `${image.fileName.replace(/\.[^/.]+$/, '')}.doc`;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	}

	function downloadAsPdf() {
		if (!image?.extractedText) return;
		// Create a printable HTML page and trigger print dialog for PDF
		const printWindow = window.open('', '_blank');
		if (!printWindow) return;

		printWindow.document.write(`
			<!DOCTYPE html>
			<html>
			<head>
				<meta charset="utf-8">
				<title>${image.fileName}</title>
				<style>
					body { font-family: Consolas, Monaco, 'Courier New', monospace; padding: 40px; line-height: 1.6; }
					pre { white-space: pre-wrap; word-wrap: break-word; }
				</style>
			</head>
			<body>
				<pre>${image.extractedText.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
			</body>
			</html>
		`);
		printWindow.document.close();
		printWindow.focus();
		setTimeout(() => {
			printWindow.print();
		}, 250);
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

	async function handleCancel() {
		if (!image) return;
		isCancelling = true;
		try {
			const response = await fetch(`/api/ocr/${data.imageId}/cancel`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ userId: image.userId })
			});

			if (!response.ok) {
				const err = (await response.json()) as { error?: string };
				throw new Error(err.error || 'Failed to cancel');
			}

			// WebSocket will receive the 'cancelled' message
		} catch (e) {
			console.error('Failed to cancel:', e);
			error = e instanceof Error ? e.message : 'Failed to cancel processing';
		} finally {
			isCancelling = false;
		}
	}

	async function handleRescan() {
		if (!image) return;
		isRescanning = true;
		try {
			// Use the rescan mutation
			const result = await trpc.images.rescan.mutate({
				id: image.id,
				customPrompt: rescanPrompt.trim() || undefined
			});

			// Reset local state
			image = {
				...image,
				status: 'pending',
				extractedText: null,
				errorMessage: null,
				processingTimeMs: null,
				customPrompt: rescanPrompt.trim() || image.customPrompt
			};

			isRescanDialogOpen = false;
			rescanPrompt = '';

			// Connect WebSocket and trigger processing
			connectWebSocket();

			// Trigger processing after a short delay to let WS connect
			setTimeout(async () => {
				try {
					const response = await fetch(result.processUrl, {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify(result.processPayload)
					});

					if (!response.ok) {
						const err = await response.json();
						console.error('[Rescan] Failed:', err);
					}
				} catch (e) {
					console.error('[Rescan] Error:', e);
				}
			}, 500);
		} catch (e) {
			console.error('Failed to rescan:', e);
			error = e instanceof Error ? e.message : 'Failed to rescan image';
		} finally {
			isRescanning = false;
		}
	}

	function openRescanDialog() {
		rescanPrompt = image?.customPrompt || '';
		isRescanDialogOpen = true;
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
			case 'cancelled':
				return 'text-orange-500';
			default:
				return 'text-muted-foreground';
		}
	}
</script>

<div class="flex min-h-screen flex-col bg-background">
	<!-- Header -->
	<header
		class="sticky top-0 z-40 border-b bg-background/95 backdrop-blur-md supports-[backdrop-filter]:bg-background/60"
	>
		<div class="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:h-16 sm:px-6">
			<div class="flex items-center gap-2 sm:gap-4">
				<Button
					variant="ghost"
					size="sm"
					onclick={() => goto('/dashboard')}
					class="-ml-2 h-8 gap-1.5 px-2 sm:h-9 sm:gap-2 sm:px-3"
				>
					<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M10 19l-7-7m0 0l7-7m-7 7h18"
						/>
					</svg>
					<span class="hidden sm:inline">Back</span>
				</Button>
				<Separator orientation="vertical" class="hidden h-5 sm:block" />
				<div class="flex items-center gap-2">
					<h1 class="max-w-[120px] truncate text-sm font-medium sm:max-w-xs md:max-w-md">
						{image?.fileName || 'Loading...'}
					</h1>
					{#if wsConnected}
						<span
							class="flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-[10px] font-medium text-green-600 dark:text-green-400"
						>
							<span class="h-1.5 w-1.5 animate-pulse rounded-full bg-green-500"></span>
							Live
						</span>
					{/if}
				</div>
			</div>
			<div class="flex items-center gap-1.5 sm:gap-2">
				{#if image}
					<!-- Cancel button - shown during processing -->
					{#if image.status === 'processing'}
						<Button
							variant="outline"
							size="sm"
							onclick={handleCancel}
							disabled={isCancelling}
							class="h-8 gap-1.5 px-2.5 text-xs sm:h-9 sm:px-3 sm:text-sm"
						>
							{#if isCancelling}
								<div
									class="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
								></div>
							{:else}
								<svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M6 18L18 6M6 6l12 12"
									/>
								</svg>
							{/if}
							Cancel
						</Button>
					{/if}

					<!-- Rescan button - shown for completed/failed/cancelled -->
					{#if image.status === 'completed' || image.status === 'failed' || image.status === 'cancelled'}
						<Button
							variant="outline"
							size="sm"
							onclick={openRescanDialog}
							class="h-8 gap-1.5 px-2.5 text-xs sm:h-9 sm:px-3 sm:text-sm"
						>
							<svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
								/>
							</svg>
							Rescan
						</Button>
					{/if}

					<Button
						variant="outline"
						size="sm"
						onclick={() => (isDeleteDialogOpen = true)}
						class="h-8 gap-1.5 px-2.5 text-xs text-destructive hover:text-destructive sm:h-9 sm:px-3 sm:text-sm"
					>
						<svg
							class="h-3.5 w-3.5 sm:h-4 sm:w-4"
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
						Delete
					</Button>
				{/if}
			</div>
		</div>
	</header>

	<!-- Main Content -->
	<main class="flex-1">
		<div class="mx-auto max-w-6xl px-4 py-4 sm:py-6">
			{#if isLoading}
				<div class="flex h-64 items-center justify-center">
					<div class="flex flex-col items-center gap-3">
						<div
							class="h-8 w-8 animate-spin rounded-full border-3 border-primary/30 border-t-primary"
						></div>
						<p class="text-sm text-muted-foreground">Loading image...</p>
					</div>
				</div>
			{:else if error}
				<div
					class="flex h-64 flex-col items-center justify-center gap-4 rounded-xl border border-destructive/20 bg-destructive/5"
				>
					<div class="rounded-full bg-destructive/10 p-3">
						<svg
							class="h-6 w-6 text-destructive"
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
					<p class="text-sm text-destructive">{error}</p>
					<Button onclick={loadImage} variant="outline" size="sm">Try again</Button>
				</div>
			{:else if image}
				<!-- Mobile: Stack vertically, Desktop: Side by side -->
				<div class="flex flex-col gap-4 lg:flex-row lg:gap-6">
					<!-- Left Column: Image + Details -->
					<div class="w-full space-y-4 lg:w-80 lg:flex-shrink-0">
						<!-- Image Preview Card -->
						<Card.Root class="overflow-hidden shadow-sm">
							<div class="relative">
								<img
									src={image.originalUrl}
									alt={image.fileName}
									class="aspect-auto w-full object-contain p-3 sm:p-4"
									style="max-height: 280px;"
								/>
							</div>
						</Card.Root>

						<!-- Metadata Card - Collapsible on mobile -->
						<Card.Root class="shadow-sm">
							<Card.Header class="pb-2 pt-3 sm:pb-3 sm:pt-4">
								<Card.Title
									class="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground"
								>
									<svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
										/>
									</svg>
									Details
								</Card.Title>
							</Card.Header>
							<Card.Content class="space-y-2.5 pb-3 text-sm sm:pb-4">
								<div class="flex items-center justify-between py-0.5">
									<span class="text-muted-foreground">Status</span>
									<span
										class="flex items-center gap-1.5 font-medium {getStatusColor(image.status)}"
									>
										{#if image.status === 'processing'}
											<div class="h-2 w-2 animate-pulse rounded-full bg-yellow-500"></div>
										{:else if image.status === 'completed'}
											<svg
												class="h-3.5 w-3.5"
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
										{:else if image.status === 'failed'}
											<svg
												class="h-3.5 w-3.5"
												fill="none"
												viewBox="0 0 24 24"
												stroke="currentColor"
											>
												<path
													stroke-linecap="round"
													stroke-linejoin="round"
													stroke-width="2"
													d="M6 18L18 6M6 6l12 12"
												/>
											</svg>
										{:else if image.status === 'cancelled'}
											<svg
												class="h-3.5 w-3.5"
												fill="none"
												viewBox="0 0 24 24"
												stroke="currentColor"
											>
												<path
													stroke-linecap="round"
													stroke-linejoin="round"
													stroke-width="2"
													d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
												/>
											</svg>
										{/if}
										{image.status.charAt(0).toUpperCase() + image.status.slice(1)}
									</span>
								</div>
								<Separator class="my-2" />
								<div class="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-1 sm:gap-y-2.5">
									<div class="flex flex-col gap-0.5 sm:flex-row sm:justify-between">
										<span class="text-xs text-muted-foreground sm:text-sm">Created</span>
										<span class="text-xs font-medium sm:text-sm">{formatDate(image.createdAt)}</span
										>
									</div>
									<div class="flex flex-col gap-0.5 sm:flex-row sm:justify-between">
										<span class="text-xs text-muted-foreground sm:text-sm">Size</span>
										<span class="text-xs font-medium sm:text-sm"
											>{formatFileSize(image.fileSizeBytes)}</span
										>
									</div>
									<div class="flex flex-col gap-0.5 sm:flex-row sm:justify-between">
										<span class="text-xs text-muted-foreground sm:text-sm">Type</span>
										<span class="text-xs font-medium sm:text-sm"
											>{image.mimeType.split('/')[1].toUpperCase()}</span
										>
									</div>
									{#if image.width && image.height}
										<div class="flex flex-col gap-0.5 sm:flex-row sm:justify-between">
											<span class="text-xs text-muted-foreground sm:text-sm">Dimensions</span>
											<span class="text-xs font-medium sm:text-sm"
												>{image.width} x {image.height}</span
											>
										</div>
									{/if}
									{#if image.processingTimeMs}
										<div class="flex flex-col gap-0.5 sm:flex-row sm:justify-between">
											<span class="text-xs text-muted-foreground sm:text-sm">Process Time</span>
											<span class="text-xs font-medium sm:text-sm"
												>{(image.processingTimeMs / 1000).toFixed(2)}s</span
											>
										</div>
									{/if}
									{#if image.confidence}
										<div class="flex flex-col gap-0.5 sm:flex-row sm:justify-between">
											<span class="text-xs text-muted-foreground sm:text-sm">Confidence</span>
											<span class="text-xs font-medium sm:text-sm"
												>{(image.confidence * 100).toFixed(0)}%</span
											>
										</div>
									{/if}
									{#if image.language}
										<div class="flex flex-col gap-0.5 sm:flex-row sm:justify-between">
											<span class="text-xs text-muted-foreground sm:text-sm">Language</span>
											<span class="text-xs font-medium sm:text-sm">{image.language}</span>
										</div>
									{/if}
								</div>
							</Card.Content>
						</Card.Root>
					</div>

					<!-- Right Column: Result Viewer -->
					<div class="min-w-0 flex-1">
						<Card.Root class="flex h-full flex-col shadow-sm p-0">
							<!-- Compact header with copy button -->
							<div class="flex items-center justify-between border-b px-3 py-1.5 sm:px-4 sm:py-2">
								<div class="flex items-center gap-1.5">
									<svg
										class="h-3 w-3 text-primary sm:h-3.5 sm:w-3.5"
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
									<span class="text-xs font-medium sm:text-sm">Extracted Text</span>
								</div>
								{#if image.extractedText && image.status === 'completed'}
									<div class="flex items-center gap-0.5 sm:gap-1">
										<Button
											variant="ghost"
											size="sm"
											onclick={copyToClipboard}
											class="h-6 gap-1 px-1.5 text-[10px] sm:h-7 sm:gap-1.5 sm:px-2 sm:text-xs"
										>
											{#if copied}
												<svg
													class="h-3 w-3 text-green-500"
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
												<span class="font-medium text-green-600">Copied!</span>
											{:else}
												<svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
													<path
														stroke-linecap="round"
														stroke-linejoin="round"
														stroke-width="2"
														d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
													/>
												</svg>
												<span class="font-medium">Copy</span>
											{/if}
										</Button>
										<div class="h-4 w-px bg-border"></div>
										<Button
											variant="ghost"
											size="sm"
											onclick={downloadAsTxt}
											class="h-6 px-1.5 text-[10px] sm:h-7 sm:px-2 sm:text-xs"
											title="Download as TXT"
										>
											<span class="font-medium">.txt</span>
										</Button>
										<Button
											variant="ghost"
											size="sm"
											onclick={downloadAsDocx}
											class="h-6 px-1.5 text-[10px] sm:h-7 sm:px-2 sm:text-xs"
											title="Download as DOC"
										>
											<span class="font-medium">.doc</span>
										</Button>
										<Button
											variant="ghost"
											size="sm"
											onclick={downloadAsPdf}
											class="h-6 px-1.5 text-[10px] sm:h-7 sm:px-2 sm:text-xs"
											title="Download as PDF"
										>
											<span class="font-medium">.pdf</span>
										</Button>
									</div>
								{/if}
							</div>

							<div class="flex-1 p-3 sm:p-4">
								{#if image.status === 'pending'}
									<div
										class="flex h-full min-h-[200px] flex-col items-center justify-center gap-3 sm:min-h-[280px]"
									>
										<div class="relative">
											<div
												class="h-10 w-10 animate-spin rounded-full border-3 border-primary/20 border-t-primary sm:h-12 sm:w-12"
											></div>
											<div class="absolute inset-0 flex items-center justify-center">
												<svg
													class="h-3.5 w-3.5 animate-pulse text-primary sm:h-4 sm:w-4"
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
										<p class="animate-pulse text-xs text-muted-foreground sm:text-sm">
											Waiting to process...
										</p>
									</div>
								{:else if image.status === 'processing'}
									<div class="flex h-full min-h-[200px] flex-col sm:min-h-[280px]">
										{#if image.extractedText}
											<!-- Show text streaming in real-time -->
											<div class="mb-2 flex items-center justify-between gap-2 sm:mb-3">
												<div class="flex items-center gap-2">
													<div class="h-2 w-2 animate-pulse rounded-full bg-yellow-500"></div>
													<span class="text-xs font-medium text-yellow-600 dark:text-yellow-400">
														Extracting text...
													</span>
												</div>
												<Button
													variant="destructive"
													size="sm"
													onclick={handleCancel}
													disabled={isCancelling}
													class="h-7 gap-1 px-2 text-xs sm:h-8 sm:gap-1.5 sm:px-2.5"
												>
													{#if isCancelling}
														<div
															class="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent sm:h-3.5 sm:w-3.5"
														></div>
													{:else}
														<svg
															class="h-3 w-3 sm:h-3.5 sm:w-3.5"
															fill="none"
															viewBox="0 0 24 24"
															stroke="currentColor"
														>
															<path
																stroke-linecap="round"
																stroke-linejoin="round"
																stroke-width="2"
																d="M6 18L18 6M6 6l12 12"
															/>
														</svg>
													{/if}
													Cancel
												</Button>
											</div>
											<div
												class="prose prose-sm dark:prose-invert max-w-none p-0 flex-1 whitespace-pre-wrap font-mono text-xs leading-relaxed sm:text-sm"
											>
												{image.extractedText}<span class="animate-pulse text-primary">|</span>
											</div>
										{:else}
											<!-- No text yet, show loading spinner with cancel button -->
											<div class="flex flex-1 flex-col items-center justify-center gap-3 sm:gap-4">
												<div class="relative">
													<div
														class="h-10 w-10 animate-spin rounded-full border-3 border-primary/20 border-t-primary sm:h-12 sm:w-12"
													></div>
													<div class="absolute inset-0 flex items-center justify-center">
														<svg
															class="h-3.5 w-3.5 animate-pulse text-primary sm:h-4 sm:w-4"
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
												<p class="animate-pulse text-xs text-muted-foreground sm:text-sm">
													Analyzing document...
												</p>
												<Button
													variant="destructive"
													size="sm"
													onclick={handleCancel}
													disabled={isCancelling}
													class="mt-1 h-8 gap-1.5 text-xs sm:mt-2 sm:h-9 sm:text-sm"
												>
													{#if isCancelling}
														<div
															class="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
														></div>
													{:else}
														<svg
															class="h-3.5 w-3.5"
															fill="none"
															viewBox="0 0 24 24"
															stroke="currentColor"
														>
															<path
																stroke-linecap="round"
																stroke-linejoin="round"
																stroke-width="2"
																d="M6 18L18 6M6 6l12 12"
															/>
														</svg>
													{/if}
													Cancel Processing
												</Button>
											</div>
										{/if}
									</div>
								{:else if image.status === 'failed'}
									<div
										class="flex h-full min-h-[200px] flex-col items-center justify-center gap-3 sm:min-h-[280px] sm:gap-4"
									>
										<div class="rounded-full bg-destructive/10 p-3 sm:p-4">
											<svg
												class="h-6 w-6 text-destructive sm:h-8 sm:w-8"
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
											<p class="text-sm font-medium text-destructive sm:text-base">
												Processing Failed
											</p>
											{#if image.errorMessage}
												<p class="mt-1 max-w-sm px-4 text-xs text-muted-foreground sm:text-sm">
													{image.errorMessage}
												</p>
											{/if}
										</div>
										<Button
											variant="outline"
											size="sm"
											onclick={openRescanDialog}
											class="h-8 gap-1.5 text-xs sm:h-9 sm:text-sm"
										>
											<svg
												class="h-3.5 w-3.5"
												fill="none"
												viewBox="0 0 24 24"
												stroke="currentColor"
											>
												<path
													stroke-linecap="round"
													stroke-linejoin="round"
													stroke-width="2"
													d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
												/>
											</svg>
											Try Again
										</Button>
									</div>
								{:else if image.status === 'cancelled'}
									<div
										class="flex h-full min-h-[200px] flex-col items-center justify-center gap-3 sm:min-h-[280px] sm:gap-4"
									>
										<div class="rounded-full bg-orange-500/10 p-3 sm:p-4">
											<svg
												class="h-6 w-6 text-orange-500 sm:h-8 sm:w-8"
												fill="none"
												viewBox="0 0 24 24"
												stroke="currentColor"
											>
												<path
													stroke-linecap="round"
													stroke-linejoin="round"
													stroke-width="2"
													d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
												/>
											</svg>
										</div>
										<div class="text-center">
											<p class="text-sm font-medium text-orange-500 sm:text-base">
												Processing Cancelled
											</p>
											<p class="mt-1 px-4 text-xs text-muted-foreground sm:text-sm">
												{#if image.extractedText}
													Partial text was extracted before cancellation.
												{:else}
													No text was extracted before cancellation.
												{/if}
											</p>
										</div>
										<Button
											variant="outline"
											size="sm"
											onclick={openRescanDialog}
											class="h-8 gap-1.5 text-xs sm:h-9 sm:text-sm"
										>
											<svg
												class="h-3.5 w-3.5"
												fill="none"
												viewBox="0 0 24 24"
												stroke="currentColor"
											>
												<path
													stroke-linecap="round"
													stroke-linejoin="round"
													stroke-width="2"
													d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
												/>
											</svg>
											Rescan
										</Button>
										{#if image.extractedText}
											<div class="mt-3 w-full border-t pt-3 sm:mt-4 sm:pt-4">
												<p class="mb-2 text-xs font-medium text-muted-foreground">Partial Text:</p>
												<div
													class="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap font-mono text-xs leading-relaxed sm:text-sm"
												>
													{image.extractedText}
												</div>
											</div>
										{/if}
									</div>
								{:else if !image.extractedText}
									<div
										class="flex h-full min-h-[200px] flex-col items-center justify-center gap-3 text-muted-foreground/50 sm:min-h-[280px]"
									>
										<svg
											class="h-10 w-10 opacity-20 sm:h-12 sm:w-12"
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
										<p class="text-xs sm:text-sm">No text was extracted from this image.</p>
									</div>
								{:else}
									<!-- Completed state with extracted text -->
									<div
										class="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap font-mono text-xs leading-relaxed sm:text-sm"
									>
										{image.extractedText}
									</div>
								{/if}
							</div>

							{#if image.customPrompt}
								<div class="border-t px-3 py-2 sm:px-4 sm:py-3">
									<p class="text-[10px] text-muted-foreground sm:text-xs">
										<span class="font-medium">Custom prompt:</span>
										<span class="italic">{image.customPrompt}</span>
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
	<Dialog.Content class="max-w-[calc(100vw-2rem)] sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title class="text-base sm:text-lg">Delete Image</Dialog.Title>
			<Dialog.Description class="text-xs sm:text-sm">
				Are you sure you want to delete this image? This action cannot be undone.
			</Dialog.Description>
		</Dialog.Header>
		<Dialog.Footer class="flex-col-reverse gap-2 sm:flex-row sm:gap-2">
			<Button
				variant="outline"
				onclick={() => (isDeleteDialogOpen = false)}
				disabled={isDeleting}
				class="w-full sm:w-auto"
			>
				Cancel
			</Button>
			<Button
				variant="destructive"
				onclick={handleDelete}
				disabled={isDeleting}
				class="w-full sm:w-auto"
			>
				{#if isDeleting}
					<div
						class="mr-2 h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
					></div>
				{/if}
				Delete
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

<!-- Rescan Dialog -->
<Dialog.Root bind:open={isRescanDialogOpen}>
	<Dialog.Content class="max-w-[calc(100vw-2rem)] sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title class="text-base sm:text-lg">Rescan Image</Dialog.Title>
			<Dialog.Description class="text-xs sm:text-sm">
				Run OCR on this image again. You can optionally modify the custom prompt.
			</Dialog.Description>
		</Dialog.Header>
		<div class="py-3 sm:py-4">
			<Label for="rescan-prompt" class="text-xs font-medium sm:text-sm"
				>Custom Prompt (optional)</Label
			>
			<Textarea
				id="rescan-prompt"
				bind:value={rescanPrompt}
				placeholder="Add specific instructions for text extraction..."
				class="mt-1.5 min-h-[80px] text-sm sm:mt-2 sm:min-h-[100px]"
			/>
			<p class="mt-1.5 text-[10px] text-muted-foreground sm:mt-2 sm:text-xs">
				Leave empty to use the default extraction prompt.
			</p>
		</div>
		<Dialog.Footer class="flex-col-reverse gap-2 sm:flex-row sm:gap-2">
			<Button
				variant="outline"
				onclick={() => (isRescanDialogOpen = false)}
				disabled={isRescanning}
				class="w-full sm:w-auto"
			>
				Cancel
			</Button>
			<Button onclick={handleRescan} disabled={isRescanning} class="w-full sm:w-auto">
				{#if isRescanning}
					<div
						class="mr-2 h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
					></div>
				{/if}
				Rescan
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
