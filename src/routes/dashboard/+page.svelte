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
	import ThemeToggle from '$lib/components/ThemeToggle.svelte';
	import {
		resizeImage,
		getImageFromClipboard,
		isAllowedMimeType,
		MAX_FILE_SIZE,
		formatFileSize
	} from '$lib/utils/image';

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
		totalScans: number;
		scansThisMonth: number;
		usage: { used: number; limit: number; percentage: number };
		plan: { id: string; name: string; imagesPerMonth: number };
		recentImages: Array<{
			id: string;
			fileName: string;
			originalUrl: string;
			status: string;
			extractedText: string | null;
			createdAt: string;
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
			createdAt: string;
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

	// Search
	let searchQuery = $state('');
	let searchInput = $state('');
	let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;
	let isSearching = $state(false);

	// Infinite scroll
	let loadMoreTrigger = $state<HTMLDivElement | null>(null);
	let observer: IntersectionObserver | null = null;

	// WebSocket for real-time updates
	let dashboardWs = $state<WebSocket | null>(null);

	// Delete confirmation state
	let deleteImageId = $state<string | null>(null);
	let isDeleteOpen = $state(false);
	let isDeleting = $state(false);

	// Bulk selection state
	let selectedIds = $state<Set<string>>(new Set());
	let isSelectionMode = $state(false);
	let isBulkDeleting = $state(false);
	let isBulkDeleteOpen = $state(false);
	let isExporting = $state(false);

	// Derived state for selection
	let selectedCount = $derived(selectedIds.size);
	let allSelected = $derived(images.length > 0 && selectedIds.size === images.length);
	let someSelected = $derived(selectedIds.size > 0 && selectedIds.size < images.length);

	onMount(() => {
		loadDashboard();

		// Listen for paste events
		const handlePaste = (e: ClipboardEvent) => {
			const file = getImageFromClipboard(e);
			if (file) {
				e.preventDefault();
				processUploadFile(file);
				if (!isUploadOpen) {
					isUploadOpen = true;
				}
			}
		};

		document.addEventListener('paste', handlePaste);

		// Setup IntersectionObserver for infinite scroll
		observer = new IntersectionObserver(
			(entries) => {
				const entry = entries[0];
				if (entry?.isIntersecting && hasMore && !isLoadingMore && !isLoading) {
					loadMoreImages();
				}
			},
			{ rootMargin: '100px' }
		);

		// Cleanup on unmount
		return () => {
			document.removeEventListener('paste', handlePaste);
			if (dashboardWs) {
				dashboardWs.close();
				dashboardWs = null;
			}
			if (observer) {
				observer.disconnect();
				observer = null;
			}
			if (searchDebounceTimer) {
				clearTimeout(searchDebounceTimer);
			}
		};
	});

	// Watch for loadMoreTrigger element and observe it
	$effect(() => {
		if (loadMoreTrigger && observer) {
			observer.observe(loadMoreTrigger);
			return () => {
				if (loadMoreTrigger && observer) {
					observer.unobserve(loadMoreTrigger);
				}
			};
		}
	});

	// Debounced search effect
	function handleSearchInput(value: string) {
		searchInput = value;

		if (searchDebounceTimer) {
			clearTimeout(searchDebounceTimer);
		}

		searchDebounceTimer = setTimeout(() => {
			if (searchInput !== searchQuery) {
				searchQuery = searchInput;
				performSearch();
			}
		}, 150); // Fast 150ms debounce
	}

	async function performSearch() {
		isSearching = true;
		// Reset pagination when searching
		nextCursor = undefined;
		hasMore = false;

		try {
			const imagesData = await trpc.images.list.query({
				limit: 20,
				search: searchQuery || undefined
			});
			images = imagesData.images;
			nextCursor = imagesData.nextCursor;
			hasMore = !!imagesData.nextCursor;

			// Reconnect WebSocket if needed (for pending images in search results)
			connectDashboardWs();
		} catch (e) {
			console.error('Search failed:', e);
		} finally {
			isSearching = false;
		}
	}

	function clearSearch() {
		searchInput = '';
		searchQuery = '';
		if (searchDebounceTimer) {
			clearTimeout(searchDebounceTimer);
		}
		performSearch();
	}

	// Check if there are any pending/processing images
	function hasPendingImages(): boolean {
		return images.some((img) => img.status === 'pending' || img.status === 'processing');
	}

	// Connect to dashboard WebSocket for real-time updates
	function connectDashboardWs() {
		if (dashboardWs || !hasPendingImages()) return;

		const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
		const wsUrl = `${protocol}//${window.location.host}/api/dashboard/ws`;

		console.log('[Dashboard] Connecting to WebSocket:', wsUrl);
		const ws = new WebSocket(wsUrl);

		ws.onopen = () => {
			console.log('[Dashboard] WebSocket connected');
		};

		ws.onmessage = (event) => {
			try {
				const message = JSON.parse(event.data);
				console.log('[Dashboard] WebSocket message:', message.type);

				switch (message.type) {
					case 'connected':
						console.log('[Dashboard] Processing count:', message.processingCount);
						break;

					case 'image-update':
						// Update the image in our list (only if it exists - might be filtered by search)
						const imageExists = images.some((img) => img.id === message.imageId);
						if (imageExists) {
							images = images.map((img) => {
								if (img.id === message.imageId) {
									return {
										...img,
										status: message.status,
										extractedText: message.extractedText || img.extractedText
									};
								}
								return img;
							});
						}

						// Also update stats if needed
						if (
							message.status === 'completed' ||
							message.status === 'failed' ||
							message.status === 'cancelled'
						) {
							// Refresh stats to get updated counts
							trpc.dashboard.getStats.query().then((statsData) => {
								stats = statsData;
							});
						}
						break;

					case 'no-processing':
						// All images done, close WebSocket
						console.log('[Dashboard] No more processing images, closing WebSocket');
						ws.close();
						dashboardWs = null;
						break;
				}
			} catch (e) {
				console.error('[Dashboard] Failed to parse WebSocket message:', e);
			}
		};

		ws.onclose = () => {
			console.log('[Dashboard] WebSocket closed');
			dashboardWs = null;
		};

		ws.onerror = (err) => {
			console.error('[Dashboard] WebSocket error:', err);
		};

		dashboardWs = ws;
	}

	async function loadDashboard() {
		isLoading = true;
		error = null;
		try {
			const [statsData, imagesData] = await Promise.all([
				trpc.dashboard.getStats.query(),
				trpc.images.list.query({ limit: 20, search: searchQuery || undefined })
			]);
			stats = statsData;
			images = imagesData.images;
			nextCursor = imagesData.nextCursor;
			hasMore = !!imagesData.nextCursor;

			// Connect to WebSocket if there are pending images
			connectDashboardWs();
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
			const data = await trpc.images.list.query({
				limit: 20,
				cursor: nextCursor,
				search: searchQuery || undefined
			});
			images = [...images, ...data.images];
			nextCursor = data.nextCursor;
			hasMore = !!data.nextCursor;

			// Connect WebSocket if new pending images loaded
			connectDashboardWs();
		} catch (e) {
			console.error('Failed to load more images:', e);
		} finally {
			isLoadingMore = false;
		}
	}

	async function processUploadFile(file: File) {
		// Validate file type
		if (!isAllowedMimeType(file.type)) {
			uploadError = 'Invalid file type. Please upload an image (JPG, PNG, WebP, HEIC, etc.)';
			return;
		}

		// Validate file size before resize
		if (file.size > MAX_FILE_SIZE) {
			uploadError = `File too large (${formatFileSize(file.size)}). Maximum size is ${formatFileSize(MAX_FILE_SIZE)}.`;
			return;
		}

		uploadError = null;

		try {
			// Resize image if needed
			const { blob, width, height } = await resizeImage(file);

			// Create a new File from the resized blob
			const resizedFile = new File([blob], file.name, { type: blob.type });

			uploadFile = resizedFile;
			uploadPreview = URL.createObjectURL(resizedFile);

			// Store dimensions for later use
			(uploadFile as any)._width = width;
			(uploadFile as any)._height = height;
		} catch (e) {
			console.error('Failed to process image:', e);
			// Fall back to original file
			uploadFile = file;
			uploadPreview = URL.createObjectURL(file);
		}
	}

	function handleFileSelect(event: Event) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];
		if (file) {
			processUploadFile(file);
		}
	}

	function handleDrop(event: DragEvent) {
		event.preventDefault();
		const file = event.dataTransfer?.files?.[0];
		if (file && file.type.startsWith('image/')) {
			processUploadFile(file);
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
			const width = (uploadFile as any)._width;
			const height = (uploadFile as any)._height;

			await trpc.images.create.mutate({
				imageId,
				imageKey,
				fileName: uploadFile.name,
				mimeType: uploadFile.type as any,
				fileSizeBytes: uploadFile.size,
				width: width ? Math.round(width) : undefined,
				height: height ? Math.round(height) : undefined,
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

	function openDeleteDialog(imageId: string, event: Event) {
		event.preventDefault();
		event.stopPropagation();
		deleteImageId = imageId;
		isDeleteOpen = true;
	}

	async function handleDelete() {
		if (!deleteImageId) return;

		isDeleting = true;
		try {
			await trpc.images.delete.mutate({ id: deleteImageId });
			images = images.filter((img) => img.id !== deleteImageId);
			isDeleteOpen = false;
			deleteImageId = null;
		} catch (e) {
			console.error('Failed to delete image:', e);
		} finally {
			isDeleting = false;
		}
	}

	function closeDeleteDialog() {
		isDeleteOpen = false;
		deleteImageId = null;
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
			case 'cancelled':
				return 'bg-orange-500';
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

	// Bulk selection functions
	function toggleSelectionMode() {
		isSelectionMode = !isSelectionMode;
		if (!isSelectionMode) {
			selectedIds = new Set();
		}
	}

	function toggleSelectAll() {
		if (allSelected) {
			selectedIds = new Set();
		} else {
			selectedIds = new Set(images.map((img) => img.id));
		}
	}

	function toggleSelect(id: string, event?: Event) {
		if (event) {
			event.preventDefault();
			event.stopPropagation();
		}
		const newSet = new Set(selectedIds);
		if (newSet.has(id)) {
			newSet.delete(id);
		} else {
			newSet.add(id);
		}
		selectedIds = newSet;
	}

	function openBulkDeleteDialog() {
		if (selectedIds.size === 0) return;
		isBulkDeleteOpen = true;
	}

	function closeBulkDeleteDialog() {
		isBulkDeleteOpen = false;
	}

	async function handleBulkDelete() {
		if (selectedIds.size === 0) return;

		isBulkDeleting = true;
		try {
			const idsToDelete = Array.from(selectedIds);
			await trpc.images.bulkDelete.mutate({ ids: idsToDelete });

			// Remove deleted images from list
			images = images.filter((img) => !selectedIds.has(img.id));

			// Clear selection
			selectedIds = new Set();
			isBulkDeleteOpen = false;
		} catch (e) {
			console.error('Failed to bulk delete:', e);
		} finally {
			isBulkDeleting = false;
		}
	}

	// Export functions
	async function exportSelected(format: 'json' | 'csv' | 'txt') {
		if (selectedIds.size === 0) return;

		isExporting = true;
		try {
			const selectedImages = images.filter((img) => selectedIds.has(img.id));
			let content: string;
			let filename: string;
			let mimeType: string;

			switch (format) {
				case 'json':
					content = JSON.stringify(
						selectedImages.map((img) => ({
							id: img.id,
							fileName: img.fileName,
							status: img.status,
							extractedText: img.extractedText,
							createdAt: img.createdAt
						})),
						null,
						2
					);
					filename = `ocr-export-${new Date().toISOString().split('T')[0]}.json`;
					mimeType = 'application/json';
					break;

				case 'csv':
					const headers = ['ID', 'File Name', 'Status', 'Extracted Text', 'Created At'];
					const rows = selectedImages.map((img) => [
						img.id,
						`"${(img.fileName || '').replace(/"/g, '""')}"`,
						img.status,
						`"${(img.extractedText || '').replace(/"/g, '""').replace(/\n/g, ' ')}"`,
						img.createdAt
					]);
					content = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
					filename = `ocr-export-${new Date().toISOString().split('T')[0]}.csv`;
					mimeType = 'text/csv';
					break;

				case 'txt':
					content = selectedImages
						.map((img) => {
							return `=== ${img.fileName} ===\nDate: ${formatDate(img.createdAt)}\nStatus: ${img.status}\n\n${img.extractedText || '(No text extracted)'}\n`;
						})
						.join('\n' + '='.repeat(50) + '\n\n');
					filename = `ocr-export-${new Date().toISOString().split('T')[0]}.txt`;
					mimeType = 'text/plain';
					break;
			}

			// Download the file
			const blob = new Blob([content], { type: mimeType });
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = filename;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			URL.revokeObjectURL(url);
		} catch (e) {
			console.error('Export failed:', e);
		} finally {
			isExporting = false;
		}
	}
</script>

<div class="flex min-h-screen flex-col bg-background">
	<!-- Header -->
	<header class="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-sm">
		<div class="mx-auto flex h-14 max-w-7xl items-center justify-between px-3 sm:h-16 sm:px-6">
			<div class="flex items-center gap-3 sm:gap-4">
				<a href="/" class="flex items-center gap-2">
					<div
						class="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary sm:h-8 sm:w-8"
					>
						<svg
							class="h-4 w-4 sm:h-5 sm:w-5"
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
					</div>
					<span class="text-base font-semibold sm:text-lg">ItsOCR</span>
				</a>
				<div class="hidden h-5 w-px bg-border sm:block"></div>
				<h1 class="hidden text-base font-medium text-muted-foreground sm:block">Dashboard</h1>
			</div>

			<div class="flex items-center gap-2 sm:gap-3">
				<Button onclick={openUploadModal} size="sm" class="gap-1.5">
					<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M12 4v16m8-8H4"
						/>
					</svg>
					<span class="hidden sm:inline">New Scan</span>
				</Button>
				<ThemeToggle showLabel />
				<DropdownMenu.Root>
					<DropdownMenu.Trigger>
						<Button variant="ghost" class="relative h-8 w-8 rounded-full sm:h-9 sm:w-9">
							<Avatar.Root class="h-8 w-8 sm:h-9 sm:w-9">
								{#if data.user.image}
									<Avatar.Image src={data.user.image} alt={data.user.name} />
								{/if}
								<Avatar.Fallback class="bg-primary/10 text-xs text-primary sm:text-sm">
									{getUserInitials(data.user.name)}
								</Avatar.Fallback>
							</Avatar.Root>
						</Button>
					</DropdownMenu.Trigger>
					<DropdownMenu.Content align="end" class="w-48 sm:w-56">
						<DropdownMenu.Label>
							<div class="flex flex-col space-y-1">
								<p class="text-sm font-medium">{data.user.name}</p>
								<p class="truncate text-xs text-muted-foreground">{data.user.email}</p>
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
		<div class="mx-auto max-w-7xl px-3 py-4 sm:px-6 sm:py-6">
			{#if isLoading}
				<div class="flex h-48 items-center justify-center sm:h-64">
					<div class="flex flex-col items-center gap-3">
						<div
							class="h-6 w-6 animate-spin rounded-full border-[3px] border-primary border-t-transparent sm:h-8 sm:w-8 sm:border-4"
						></div>
						<p class="text-xs text-muted-foreground sm:text-sm">Loading...</p>
					</div>
				</div>
			{:else if error}
				<div class="flex h-48 flex-col items-center justify-center gap-3 sm:h-64 sm:gap-4">
					<p class="text-sm text-destructive">{error}</p>
					<Button size="sm" onclick={loadDashboard}>Try again</Button>
				</div>
			{:else}
				<!-- Compact Stats Bar with Search -->
				{#if stats}
					<div
						class="mb-4 flex flex-col gap-3 rounded-lg border bg-card p-3 sm:mb-6 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4 sm:p-4"
					>
						<!-- Search (top on mobile, left on desktop) -->
						<div class="relative w-full sm:w-64 md:w-72 lg:w-80 xl:w-96">
							<svg
								class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
								/>
							</svg>
							<input
								type="text"
								placeholder="Search files or text..."
								class="h-9 w-full rounded-md border bg-background pl-9 pr-9 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
								value={searchInput}
								oninput={(e) => handleSearchInput(e.currentTarget.value)}
							/>
							{#if searchInput && !isSearching}
								<button
									type="button"
									class="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
									onclick={clearSearch}
									aria-label="Clear search"
								>
									<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M6 18L18 6M6 6l12 12"
										/>
									</svg>
								</button>
							{/if}
							{#if isSearching}
								<div
									class="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin rounded-full border-2 border-primary border-t-transparent"
								></div>
							{/if}
						</div>

						<!-- Spacer -->
						<div class="hidden flex-1 sm:block"></div>

						<!-- Stats (bottom on mobile, right on desktop) -->
						<div class="flex flex-wrap items-center gap-x-3 gap-y-1 sm:gap-x-4">
							<div class="flex items-center gap-1.5">
								<span class="text-xs text-muted-foreground">Total Scans</span>
								<span class="text-sm font-semibold">{stats.totalScans}</span>
							</div>
							<div class="h-3 w-px bg-border sm:h-4"></div>
							<div class="flex items-center gap-1.5">
								<span class="text-xs text-muted-foreground">This Month</span>
								<span class="text-sm font-semibold">{stats.scansThisMonth}</span>
							</div>
							<div class="h-3 w-px bg-border sm:h-4"></div>
							<div class="flex items-center gap-1.5">
								<span class="text-xs text-muted-foreground">Plan</span>
								<span class="text-sm font-semibold capitalize">{stats.plan.name}</span>
							</div>
						</div>
					</div>
				{/if}

				<!-- Recent Scans -->
				<div>
					<div class="mb-3 flex items-center justify-between sm:mb-4">
						<h2 class="text-base font-semibold sm:text-lg">
							{#if searchQuery}
								Search Results
							{:else}
								Recent Scans
							{/if}
						</h2>
						<div class="flex items-center gap-2">
							{#if searchQuery && images.length > 0}
								<span class="text-xs text-muted-foreground sm:text-sm">
									{images.length}{hasMore ? '+' : ''} result{images.length !== 1 ? 's' : ''}
								</span>
							{/if}
							{#if images.length > 0}
								<Button
									variant={isSelectionMode ? 'secondary' : 'ghost'}
									size="sm"
									onclick={toggleSelectionMode}
									class="h-7 gap-1.5 px-2 text-xs"
								>
									{#if isSelectionMode}
										<svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												stroke-width="2"
												d="M6 18L18 6M6 6l12 12"
											/>
										</svg>
										Cancel
									{:else}
										<svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												stroke-width="2"
												d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
											/>
										</svg>
										Select
									{/if}
								</Button>
							{/if}
						</div>
					</div>

					<!-- Bulk Actions Toolbar -->
					{#if isSelectionMode && images.length > 0}
						<div
							class="mb-4 flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 p-2 sm:gap-3 sm:p-3"
						>
							<button
								type="button"
								class="flex items-center gap-1.5 rounded px-2 py-1 text-xs hover:bg-muted sm:text-sm"
								onclick={toggleSelectAll}
							>
								<div
									class="flex h-4 w-4 items-center justify-center rounded border {allSelected
										? 'border-primary bg-primary'
										: someSelected
											? 'border-primary bg-primary/50'
											: 'border-muted-foreground'}"
								>
									{#if allSelected}
										<svg
											class="h-3 w-3 text-primary-foreground"
											fill="none"
											viewBox="0 0 24 24"
											stroke="currentColor"
										>
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												stroke-width="3"
												d="M5 13l4 4L19 7"
											/>
										</svg>
									{:else if someSelected}
										<svg
											class="h-3 w-3 text-primary-foreground"
											fill="none"
											viewBox="0 0 24 24"
											stroke="currentColor"
										>
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												stroke-width="3"
												d="M20 12H4"
											/>
										</svg>
									{/if}
								</div>
								{allSelected ? 'Deselect all' : 'Select all'}
							</button>

							<div class="h-4 w-px bg-border"></div>

							<span class="text-xs text-muted-foreground sm:text-sm">
								{selectedCount} selected
							</span>

							{#if selectedCount > 0}
								<div class="h-4 w-px bg-border"></div>

								<!-- Export dropdown -->
								<DropdownMenu.Root>
									<DropdownMenu.Trigger>
										<Button
											variant="outline"
											size="sm"
											class="h-7 gap-1.5 px-2 text-xs"
											disabled={isExporting}
										>
											{#if isExporting}
												<div
													class="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent"
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
														d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
													/>
												</svg>
											{/if}
											Export
										</Button>
									</DropdownMenu.Trigger>
									<DropdownMenu.Content align="start">
										<DropdownMenu.Item onclick={() => exportSelected('json')}>
											<svg
												class="mr-2 h-4 w-4"
												fill="none"
												viewBox="0 0 24 24"
												stroke="currentColor"
											>
												<path
													stroke-linecap="round"
													stroke-linejoin="round"
													stroke-width="2"
													d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
												/>
											</svg>
											Export as JSON
										</DropdownMenu.Item>
										<DropdownMenu.Item onclick={() => exportSelected('csv')}>
											<svg
												class="mr-2 h-4 w-4"
												fill="none"
												viewBox="0 0 24 24"
												stroke="currentColor"
											>
												<path
													stroke-linecap="round"
													stroke-linejoin="round"
													stroke-width="2"
													d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
												/>
											</svg>
											Export as CSV
										</DropdownMenu.Item>
										<DropdownMenu.Item onclick={() => exportSelected('txt')}>
											<svg
												class="mr-2 h-4 w-4"
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
											Export as TXT
										</DropdownMenu.Item>
									</DropdownMenu.Content>
								</DropdownMenu.Root>

								<Button
									variant="destructive"
									size="sm"
									class="h-7 gap-1.5 px-2 text-xs"
									onclick={openBulkDeleteDialog}
								>
									<svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
					{/if}

					{#if images.length === 0}
						<div
							class="flex flex-col items-center justify-center rounded-lg border-2 border-dashed bg-muted/5 px-4 py-10 sm:rounded-xl sm:p-12"
						>
							{#if searchQuery}
								<!-- No search results -->
								<div class="mb-3 rounded-full bg-muted p-3 sm:mb-4 sm:p-4">
									<svg
										class="h-6 w-6 text-muted-foreground sm:h-8 sm:w-8"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
										/>
									</svg>
								</div>
								<h3 class="text-base font-medium sm:text-lg">No results found</h3>
								<p
									class="mt-1 max-w-xs text-center text-xs text-muted-foreground sm:max-w-sm sm:text-sm"
								>
									No documents match "<span class="font-medium">{searchQuery}</span>". Try a
									different search term.
								</p>
								<Button variant="outline" onclick={clearSearch} size="sm" class="mt-4 sm:mt-6">
									Clear search
								</Button>
							{:else}
								<!-- No documents yet -->
								<div class="mb-3 rounded-full bg-muted p-3 sm:mb-4 sm:p-4">
									<svg
										class="h-6 w-6 text-muted-foreground sm:h-8 sm:w-8"
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
								<h3 class="text-base font-medium sm:text-lg">No documents yet</h3>
								<p
									class="mt-1 max-w-xs text-center text-xs text-muted-foreground sm:max-w-sm sm:text-sm"
								>
									Upload an image to extract text instantly.
								</p>
								<Button onclick={openUploadModal} size="sm" class="mt-4 sm:mt-6">
									Create your first scan
								</Button>
							{/if}
						</div>
					{:else}
						<div
							class="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4"
							style="contain: layout style;"
						>
							{#each images as image (image.id)}
								{@const isSelected = selectedIds.has(image.id)}
								<a
									href={isSelectionMode ? undefined : `/image/${image.id}`}
									class="group {isSelectionMode ? 'cursor-pointer' : ''}"
									onclick={(e) => {
										if (isSelectionMode) {
											e.preventDefault();
											toggleSelect(image.id);
										}
									}}
									style="content-visibility: auto; contain-intrinsic-size: auto 280px;"
								>
									<div
										class="overflow-hidden rounded-lg border bg-card transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md {isSelected
											? 'ring-2 ring-primary border-primary'
											: ''}"
									>
										<!-- Image Preview -->
										<div class="relative aspect-video overflow-hidden bg-muted/30">
											<img
												src={image.thumbnailUrl || image.originalUrl}
												alt={image.fileName}
												class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
												loading="lazy"
												decoding="async"
												fetchpriority="low"
											/>

											<!-- Selection checkbox (selection mode) -->
											{#if isSelectionMode}
												<button
													type="button"
													class="absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded border-2 transition-all {isSelected
														? 'border-primary bg-primary'
														: 'border-white/80 bg-white/80 hover:border-primary'}"
													onclick={(e) => toggleSelect(image.id, e)}
													aria-label={isSelected ? 'Deselect image' : 'Select image'}
												>
													{#if isSelected}
														<svg
															class="h-4 w-4 text-primary-foreground"
															fill="none"
															viewBox="0 0 24 24"
															stroke="currentColor"
														>
															<path
																stroke-linecap="round"
																stroke-linejoin="round"
																stroke-width="3"
																d="M5 13l4 4L19 7"
															/>
														</svg>
													{/if}
												</button>
											{/if}

											<!-- Delete button (normal mode) -->
											{#if !isSelectionMode}
												<button
													type="button"
													class="absolute right-2 top-2 rounded-md bg-background/90 p-1.5 text-muted-foreground opacity-0 backdrop-blur transition-all hover:bg-destructive hover:text-destructive-foreground group-hover:opacity-100"
													onclick={(e) => openDeleteDialog(image.id, e)}
													aria-label="Delete image"
												>
													<svg
														class="h-4 w-4"
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
												</button>
											{/if}
										</div>

										<!-- Card Content -->
										<div class="p-3 sm:p-4">
											<div class="mb-1.5 flex items-start justify-between gap-2">
												<h4 class="truncate text-sm font-medium" title={image.fileName}>
													{image.fileName}
												</h4>
											</div>

											<div class="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
												<span>{formatDate(image.createdAt)}</span>
												<span class="inline-flex items-center gap-1">
													<span class="h-1.5 w-1.5 rounded-full {getStatusColor(image.status)}"
													></span>
													{getStatusLabel(image.status)}
												</span>
											</div>

											<!-- Text Preview -->
											{#if image.extractedText}
												<div
													class="line-clamp-2 rounded border bg-muted/30 p-2 font-mono text-xs text-muted-foreground"
												>
													{image.extractedText.slice(0, 120)}
												</div>
											{:else}
												<div
													class="rounded border bg-muted/30 p-2 text-xs italic text-muted-foreground"
												>
													{#if image.status === 'processing'}
														Processing...
													{:else if image.status === 'pending'}
														Pending...
													{:else if image.status === 'cancelled'}
														Cancelled
													{:else if image.status === 'failed'}
														Failed
													{:else}
														No text extracted
													{/if}
												</div>
											{/if}
										</div>
									</div>
								</a>
							{/each}
						</div>

						<!-- Infinite scroll trigger -->
						{#if hasMore}
							<div bind:this={loadMoreTrigger} class="flex justify-center py-6">
								{#if isLoadingMore}
									<div class="flex items-center gap-2 text-sm text-muted-foreground">
										<div
											class="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent"
										></div>
										Loading more...
									</div>
								{/if}
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
				<div
					class="flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive"
				>
					<svg
						class="mt-0.5 h-4 w-4 flex-shrink-0"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
						/>
					</svg>
					{uploadError}
				</div>
			{/if}
		</div>

		<Dialog.Footer>
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

<!-- Delete Confirmation Dialog -->
<Dialog.Root bind:open={isDeleteOpen}>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<div
				class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10"
			>
				<svg class="h-6 w-6 text-destructive" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
					/>
				</svg>
			</div>
			<Dialog.Title class="text-center">Delete Image</Dialog.Title>
			<Dialog.Description class="text-center">
				Are you sure you want to delete this image? This action cannot be undone.
			</Dialog.Description>
		</Dialog.Header>
		<Dialog.Footer class="mt-4 sm:justify-center">
			<Button variant="outline" onclick={closeDeleteDialog} disabled={isDeleting} class="min-w-24">
				Cancel
			</Button>
			<Button variant="destructive" onclick={handleDelete} disabled={isDeleting} class="min-w-24">
				{#if isDeleting}
					<div
						class="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
					></div>
					Deleting...
				{:else}
					<svg class="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
						/>
					</svg>
					Delete
				{/if}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

<!-- Bulk Delete Confirmation Dialog -->
<Dialog.Root bind:open={isBulkDeleteOpen}>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<div
				class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10"
			>
				<svg class="h-6 w-6 text-destructive" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
					/>
				</svg>
			</div>
			<Dialog.Title class="text-center"
				>Delete {selectedCount} Image{selectedCount !== 1 ? 's' : ''}</Dialog.Title
			>
			<Dialog.Description class="text-center">
				Are you sure you want to delete {selectedCount} selected image{selectedCount !== 1
					? 's'
					: ''}? This action cannot be undone.
			</Dialog.Description>
		</Dialog.Header>
		<Dialog.Footer class="mt-4 sm:justify-center">
			<Button
				variant="outline"
				onclick={closeBulkDeleteDialog}
				disabled={isBulkDeleting}
				class="min-w-24"
			>
				Cancel
			</Button>
			<Button
				variant="destructive"
				onclick={handleBulkDelete}
				disabled={isBulkDeleting}
				class="min-w-24"
			>
				{#if isBulkDeleting}
					<div
						class="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
					></div>
					Deleting...
				{:else}
					<svg class="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
						/>
					</svg>
					Delete {selectedCount}
				{/if}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
