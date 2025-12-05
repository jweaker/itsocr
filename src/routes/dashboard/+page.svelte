<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { signOut } from '$lib/auth/client';
	import { trpc } from '$lib/trpc/client';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import * as Dialog from '$lib/components/ui/dialog';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import * as Avatar from '$lib/components/ui/avatar';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Textarea } from '$lib/components/ui/textarea';
	import { Separator } from '$lib/components/ui/separator';

	interface Props {
		data: {
			user: {
				id: string;
				name: string;
				email: string;
				image?: string | null;
			};
		};
	}

	let { data }: Props = $props();

	// Dashboard state
	let stats = $state<{
		totalImages: number;
		imagesThisMonth: number;
		usage: { used: number; limit: number; percentage: number };
		plan: { id: string; name: string; imagesPerMonth: number };
		recentImages: Array<{
			id: string;
			fileName: string;
			originalUrl: string;
			status: string;
			extractedText: string | null;
			createdAt: Date;
		}>;
	} | null>(null);

	let images = $state<
		Array<{
			id: string;
			fileName: string;
			originalUrl: string;
			thumbnailUrl: string | null;
			status: string;
			extractedText: string | null;
			createdAt: Date;
			mimeType: string;
		}>
	>([]);

	let isLoading = $state(true);
	let error = $state<string | null>(null);

	// Upload modal state
	let isUploadOpen = $state(false);
	let uploadFile = $state<File | null>(null);
	let uploadPreview = $state<string | null>(null);
	let customPrompt = $state('');
	let isUploading = $state(false);
	let uploadError = $state<string | null>(null);

	// Pagination
	let nextCursor = $state<string | undefined>(undefined);
	let hasMore = $state(false);
	let isLoadingMore = $state(false);

	// Polling for pending images
	let pollInterval = $state<ReturnType<typeof setInterval> | null>(null);

	onMount(() => {
		loadDashboard();

		// Cleanup polling on unmount
		return () => {
			if (pollInterval) {
				clearInterval(pollInterval);
			}
		};
	});

	// Check if there are any pending/processing images
	function hasPendingImages(): boolean {
		return images.some((img) => img.status === 'pending' || img.status === 'processing');
	}

	// Start/stop polling based on pending images
	function updatePolling() {
		if (hasPendingImages() && !pollInterval) {
			// Start polling every 3 seconds
			pollInterval = setInterval(async () => {
				try {
					const [statsData, imagesData] = await Promise.all([
						trpc.dashboard.getStats.query(),
						trpc.images.list.query({ limit: 20 })
					]);
					stats = statsData;
					images = imagesData.images;
					nextCursor = imagesData.nextCursor;
					hasMore = !!imagesData.nextCursor;

					// Stop polling if no more pending images
					if (!hasPendingImages() && pollInterval) {
						clearInterval(pollInterval);
						pollInterval = null;
					}
				} catch (e) {
					console.error('Polling failed:', e);
				}
			}, 3000);
		} else if (!hasPendingImages() && pollInterval) {
			// Stop polling if no pending images
			clearInterval(pollInterval);
			pollInterval = null;
		}
	}

	async function loadDashboard() {
		isLoading = true;
		error = null;
		try {
			const [statsData, imagesData] = await Promise.all([
				trpc.dashboard.getStats.query(),
				trpc.images.list.query({ limit: 20 })
			]);
			stats = statsData;
			images = imagesData.images;
			nextCursor = imagesData.nextCursor;
			hasMore = !!imagesData.nextCursor;

			// Start polling if there are pending images
			updatePolling();
		} catch (e) {
			console.error('Failed to load dashboard:', e);
			error = e instanceof Error ? e.message : 'Failed to load dashboard';
		} finally {
			isLoading = false;
		}
	}

	async function loadMoreImages() {
		if (!nextCursor || isLoadingMore) return;
		isLoadingMore = true;
		try {
			const data = await trpc.images.list.query({ limit: 20, cursor: nextCursor });
			images = [...images, ...data.images];
			nextCursor = data.nextCursor;
			hasMore = !!data.nextCursor;
		} catch (e) {
			console.error('Failed to load more images:', e);
		} finally {
			isLoadingMore = false;
		}
	}

	function handleFileSelect(event: Event) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];
		if (file) {
			uploadFile = file;
			uploadPreview = URL.createObjectURL(file);
			uploadError = null;
		}
	}

	function handleDrop(event: DragEvent) {
		event.preventDefault();
		const file = event.dataTransfer?.files?.[0];
		if (file && file.type.startsWith('image/')) {
			uploadFile = file;
			uploadPreview = URL.createObjectURL(file);
			uploadError = null;
		}
	}

	function handleDragOver(event: DragEvent) {
		event.preventDefault();
	}

	async function handleUpload() {
		if (!uploadFile) return;

		isUploading = true;
		uploadError = null;

		try {
			// 1. Get upload URL
			const { imageId, imageKey, uploadUrl } = await trpc.images.getUploadUrl.mutate({
				fileName: uploadFile.name,
				mimeType: uploadFile.type as any,
				fileSizeBytes: uploadFile.size
			});

			// 2. Upload to R2
			const uploadResponse = await fetch(uploadUrl, {
				method: 'PUT',
				body: uploadFile,
				headers: {
					'Content-Type': uploadFile.type
				}
			});

			if (!uploadResponse.ok) {
				throw new Error('Failed to upload image');
			}

			// 3. Create image record and queue OCR
			await trpc.images.create.mutate({
				imageId,
				imageKey,
				fileName: uploadFile.name,
				mimeType: uploadFile.type as any,
				fileSizeBytes: uploadFile.size,
				customPrompt: customPrompt || undefined
			});

			// 4. Close modal and navigate to image page
			closeUploadModal();
			goto(`/image/${imageId}`);
		} catch (e) {
			console.error('Upload failed:', e);
			uploadError = e instanceof Error ? e.message : 'Upload failed';
		} finally {
			isUploading = false;
		}
	}

	function closeUploadModal() {
		isUploadOpen = false;
		uploadFile = null;
		uploadPreview = null;
		customPrompt = '';
		uploadError = null;
	}

	function openUploadModal() {
		isUploadOpen = true;
	}

	async function handleSignOut() {
		await signOut();
		goto('/login');
	}

	function formatDate(date: Date | string) {
		const d = new Date(date);
		return d.toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}

	function getStatusColor(status: string) {
		switch (status) {
			case 'completed':
				return 'bg-green-500';
			case 'processing':
				return 'bg-yellow-500 animate-pulse';
			case 'failed':
				return 'bg-red-500';
			default:
				return 'bg-muted-foreground';
		}
	}

	function getStatusLabel(status: string) {
		return status.charAt(0).toUpperCase() + status.slice(1);
	}

	function getUserInitials(name: string) {
		return name
			.split(' ')
			.map((n) => n[0])
			.join('')
			.toUpperCase()
			.slice(0, 2);
	}
</script>

<div class="flex min-h-screen flex-col bg-background">
	<!-- Header -->
	<header class="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-sm">
		<div class="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
			<div class="flex items-center gap-3">
				<a href="/" class="flex items-center gap-2">
					<div
						class="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary"
					>
						<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
							/>
						</svg>
					</div>
					<span class="text-lg font-semibold">ItsOCR</span>
				</a>
			</div>

			<div class="flex items-center gap-4">
				<DropdownMenu.Root>
					<DropdownMenu.Trigger>
						<Button variant="ghost" class="relative h-9 w-9 rounded-full">
							<Avatar.Root class="h-9 w-9">
								{#if data.user.image}
									<Avatar.Image src={data.user.image} alt={data.user.name} />
								{/if}
								<Avatar.Fallback class="bg-primary/10 text-primary">
									{getUserInitials(data.user.name)}
								</Avatar.Fallback>
							</Avatar.Root>
						</Button>
					</DropdownMenu.Trigger>
					<DropdownMenu.Content align="end" class="w-56">
						<DropdownMenu.Label>
							<div class="flex flex-col space-y-1">
								<p class="text-sm font-medium">{data.user.name}</p>
								<p class="text-xs text-muted-foreground">{data.user.email}</p>
							</div>
						</DropdownMenu.Label>
						<DropdownMenu.Separator />
						<DropdownMenu.Item onclick={handleSignOut}>
							<svg class="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
								/>
							</svg>
							Sign out
						</DropdownMenu.Item>
					</DropdownMenu.Content>
				</DropdownMenu.Root>
			</div>
		</div>
	</header>

	<!-- Main Content -->
	<main class="flex-1">
		<div class="mx-auto max-w-7xl px-4 py-8 sm:px-6">
			{#if isLoading}
				<div class="flex h-64 items-center justify-center">
					<div class="flex flex-col items-center gap-4">
						<div
							class="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"
						></div>
						<p class="text-sm text-muted-foreground">Loading dashboard...</p>
					</div>
				</div>
			{:else if error}
				<div class="flex h-64 flex-col items-center justify-center gap-4">
					<p class="text-destructive">{error}</p>
					<Button onclick={loadDashboard}>Try again</Button>
				</div>
			{:else}
				<!-- Header with New Scan Button -->
				<div class="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
					<div>
						<h1 class="text-3xl font-bold tracking-tight">Dashboard</h1>
						<p class="mt-1 text-muted-foreground">Manage your documents and extractions.</p>
					</div>
					<Button onclick={openUploadModal} size="lg" class="gap-2 shadow-lg">
						<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M12 4v16m8-8H4"
							/>
						</svg>
						New Scan
					</Button>
				</div>

				<!-- Stats Grid -->
				{#if stats}
					<div class="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
						<Card.Root>
							<Card.Content class="flex items-center justify-between p-6">
								<div>
									<p class="text-sm font-medium text-muted-foreground">Total Scans</p>
									<p class="text-2xl font-bold">{stats.totalImages}</p>
								</div>
								<div class="rounded-full bg-primary/10 p-3 text-primary">
									<svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
										/>
									</svg>
								</div>
							</Card.Content>
						</Card.Root>

						<Card.Root>
							<Card.Content class="flex items-center justify-between p-6">
								<div>
									<p class="text-sm font-medium text-muted-foreground">This Month</p>
									<p class="text-2xl font-bold">{stats.imagesThisMonth}</p>
								</div>
								<div class="rounded-full bg-secondary p-3 text-secondary-foreground">
									<svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
										/>
									</svg>
								</div>
							</Card.Content>
						</Card.Root>

						<Card.Root>
							<Card.Content class="flex items-center justify-between p-6">
								<div>
									<p class="text-sm font-medium text-muted-foreground">Usage</p>
									<p class="text-2xl font-bold">
										{stats.usage.used}
										{#if stats.usage.limit !== -1}
											<span class="text-sm font-normal text-muted-foreground"
												>/ {stats.usage.limit}</span
											>
										{/if}
									</p>
									{#if stats.usage.limit !== -1}
										<div class="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
											<div
												class="h-full bg-primary transition-all"
												style="width: {Math.min(stats.usage.percentage, 100)}%"
											></div>
										</div>
									{/if}
								</div>
								<div class="rounded-full bg-muted p-3 text-muted-foreground">
									<svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
										/>
									</svg>
								</div>
							</Card.Content>
						</Card.Root>

						<Card.Root>
							<Card.Content class="flex items-center justify-between p-6">
								<div>
									<p class="text-sm font-medium text-muted-foreground">Plan</p>
									<p class="text-2xl font-bold">{stats.plan.name}</p>
								</div>
								<div class="rounded-full bg-green-500/10 p-3 text-green-500">
									<svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
										/>
									</svg>
								</div>
							</Card.Content>
						</Card.Root>
					</div>
				{/if}

				<!-- Recent Scans -->
				<div class="space-y-4">
					<div class="flex items-center justify-between">
						<h2 class="text-xl font-semibold">Recent Scans</h2>
					</div>

					{#if images.length === 0}
						<div
							class="flex flex-col items-center justify-center rounded-xl border-2 border-dashed bg-muted/5 p-12"
						>
							<div class="mb-4 rounded-full bg-background p-4 shadow-sm">
								<svg
									class="h-8 w-8 text-muted-foreground"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
									/>
								</svg>
							</div>
							<h3 class="text-lg font-medium">No documents yet</h3>
							<p class="mt-1 max-w-sm text-center text-sm text-muted-foreground">
								Upload an image to extract text, data, or markdown instantly.
							</p>
							<Button onclick={openUploadModal} class="mt-6">Create your first scan</Button>
						</div>
					{:else}
						<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
							{#each images as image (image.id)}
								<a href="/image/{image.id}" class="group">
									<Card.Root
										class="cursor-pointer overflow-hidden transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md"
									>
										<!-- Image Preview -->
										<div class="relative aspect-video overflow-hidden border-b bg-muted/30">
											<img
												src={image.originalUrl}
												alt={image.fileName}
												class="h-full w-full object-cover opacity-90 transition-all duration-300 group-hover:scale-105 group-hover:opacity-100"
												loading="lazy"
											/>
											<div
												class="absolute right-2 top-2 opacity-0 transition-opacity group-hover:opacity-100"
											>
												<span
													class="rounded-md bg-background/90 px-2 py-1 text-xs font-medium shadow-sm backdrop-blur"
												>
													View Details
												</span>
											</div>
										</div>

										<!-- Card Content -->
										<Card.Content class="p-4">
											<div class="mb-2 flex items-start justify-between gap-2">
												<h4 class="truncate text-sm font-semibold" title={image.fileName}>
													{image.fileName}
												</h4>
											</div>

											<div class="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
												<svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
													<path
														stroke-linecap="round"
														stroke-linejoin="round"
														stroke-width="2"
														d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
													/>
												</svg>
												<span>{formatDate(image.createdAt)}</span>
											</div>

											<!-- Text Preview -->
											{#if image.extractedText}
												<div
													class="mb-3 line-clamp-2 rounded border bg-muted/20 p-2 font-mono text-xs text-muted-foreground"
												>
													{image.extractedText.slice(0, 150)}
												</div>
											{:else}
												<div
													class="mb-3 rounded border bg-muted/20 p-2 text-xs text-muted-foreground italic"
												>
													{image.status === 'processing' ? 'Processing...' : 'No text extracted'}
												</div>
											{/if}

											<!-- Status Badge -->
											<div class="flex items-center justify-between">
												<span
													class="inline-flex items-center gap-1.5 rounded-md bg-secondary px-2 py-1 text-xs font-medium"
												>
													<span class="h-1.5 w-1.5 rounded-full {getStatusColor(image.status)}"
													></span>
													{getStatusLabel(image.status)}
												</span>
											</div>
										</Card.Content>
									</Card.Root>
								</a>
							{/each}
						</div>

						{#if hasMore}
							<div class="flex justify-center pt-4">
								<Button variant="outline" onclick={loadMoreImages} disabled={isLoadingMore}>
									{#if isLoadingMore}
										<div
											class="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
										></div>
									{/if}
									Load more
								</Button>
							</div>
						{/if}
					{/if}
				</div>
			{/if}
		</div>
	</main>
</div>

<!-- Upload Modal -->
<Dialog.Root bind:open={isUploadOpen}>
	<Dialog.Content class="sm:max-w-lg">
		<Dialog.Header>
			<Dialog.Title>New OCR Scan</Dialog.Title>
			<Dialog.Description>Upload an image to extract text using AI-powered OCR.</Dialog.Description>
		</Dialog.Header>

		<div class="space-y-4 py-4">
			<!-- File Upload Area -->
			<div
				role="button"
				tabindex="0"
				class="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors {uploadFile
					? 'border-primary/50 bg-primary/5'
					: 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50'}"
				onclick={() => document.getElementById('file-upload')?.click()}
				onkeydown={(e) => e.key === 'Enter' && document.getElementById('file-upload')?.click()}
				ondrop={handleDrop}
				ondragover={handleDragOver}
			>
				<input
					id="file-upload"
					type="file"
					accept="image/*"
					class="hidden"
					onchange={handleFileSelect}
					disabled={isUploading}
				/>

				{#if uploadPreview}
					<div class="relative w-full">
						<img
							src={uploadPreview}
							alt="Preview"
							class="max-h-48 w-full rounded-md object-contain"
						/>
						<div
							class="absolute right-2 top-2 flex items-center gap-1 rounded-md bg-background/90 px-2 py-1 text-xs font-medium shadow-sm"
						>
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
							{uploadFile?.name}
						</div>
					</div>
				{:else}
					<div class="mb-4 rounded-full bg-muted p-4">
						<svg
							class="h-8 w-8 text-muted-foreground"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
							/>
						</svg>
					</div>
					<p class="text-sm font-medium">Click or drag to upload</p>
					<p class="mt-1 text-xs text-muted-foreground">JPG, PNG, WebP, HEIC up to 50MB</p>
				{/if}
			</div>

			<!-- Custom Prompt -->
			<div class="space-y-2">
				<Label for="custom-prompt">Custom Instructions (Optional)</Label>
				<Textarea
					id="custom-prompt"
					placeholder="e.g., Extract invoice total and date, Focus on handwritten text..."
					rows={3}
					bind:value={customPrompt}
					disabled={isUploading}
				/>
				<p class="text-xs text-muted-foreground">
					Add specific instructions to improve OCR accuracy for your document.
				</p>
			</div>

			{#if uploadError}
				<div class="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
					{uploadError}
				</div>
			{/if}
		</div>

		<Dialog.Footer class="gap-2 sm:gap-0">
			<Button variant="outline" onclick={closeUploadModal} disabled={isUploading}>Cancel</Button>
			<Button onclick={handleUpload} disabled={!uploadFile || isUploading}>
				{#if isUploading}
					<div
						class="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
					></div>
					Uploading...
				{:else}
					<svg class="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
						/>
					</svg>
					Start OCR
				{/if}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
