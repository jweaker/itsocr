<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import {
		Dialog,
		DialogContent,
		DialogDescription,
		DialogFooter,
		DialogHeader,
		DialogTitle
	} from '$lib/components/ui/dialog';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { trpc } from '$lib/trpc/client';

	// Token state
	interface ApiToken {
		id: string;
		name: string;
		tokenPrefix: string;
		lastUsedAt: string | null;
		expiresAt: string | null;
		revokedAt: string | null;
		createdAt: string;
		isActive: boolean;
	}

	let tokens = $state<ApiToken[]>([]);
	let isLoading = $state(true);
	let error = $state<string | null>(null);

	// Create token dialog
	let showCreateDialog = $state(false);
	let newTokenName = $state('');
	let newTokenExpiry = $state<number | null>(null);
	let isCreating = $state(false);

	// New token display
	let newlyCreatedToken = $state<string | null>(null);
	let showNewTokenDialog = $state(false);

	// Revoke dialog
	let showRevokeDialog = $state(false);
	let tokenToRevoke = $state<ApiToken | null>(null);
	let isRevoking = $state(false);

	// Check if user has API access (now available to all plans)
	const hasApiAccess = $derived(true);

	// Load tokens on mount
	$effect(() => {
		loadTokens();
	});

	async function loadTokens() {
		try {
			isLoading = true;
			error = null;
			tokens = await trpc.tokens.list.query();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load tokens';
		} finally {
			isLoading = false;
		}
	}

	async function createToken() {
		if (!newTokenName.trim()) return;

		try {
			isCreating = true;
			const result = await trpc.tokens.create.mutate({
				name: newTokenName.trim(),
				expiresInDays: newTokenExpiry ?? undefined
			});

			// Show the new token
			newlyCreatedToken = result.token;
			showCreateDialog = false;
			showNewTokenDialog = true;

			// Reset form
			newTokenName = '';
			newTokenExpiry = null;

			// Reload tokens
			await loadTokens();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to create token';
		} finally {
			isCreating = false;
		}
	}

	async function revokeToken() {
		if (!tokenToRevoke) return;

		try {
			isRevoking = true;
			await trpc.tokens.revoke.mutate({ id: tokenToRevoke.id });
			showRevokeDialog = false;
			tokenToRevoke = null;
			await loadTokens();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to revoke token';
		} finally {
			isRevoking = false;
		}
	}

	function copyToClipboard(text: string) {
		navigator.clipboard.writeText(text);
	}

	function formatDate(dateStr: string | null): string {
		if (!dateStr) return 'Never';
		return new Date(dateStr).toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}
</script>

<svelte:head>
	<title>Settings - itsOCR</title>
</svelte:head>

<div class="min-h-screen bg-background">
	<!-- Header -->
	<header class="border-b bg-card">
		<div class="container mx-auto flex h-16 items-center justify-between px-4">
			<div class="flex items-center gap-4">
				<a href="/dashboard" class="text-xl font-bold">itsOCR</a>
				<span class="text-muted-foreground">/</span>
				<span class="text-muted-foreground">Settings</span>
			</div>
			<div class="flex items-center gap-4">
				<a href="/dashboard">
					<Button variant="ghost">Back to Dashboard</Button>
				</a>
			</div>
		</div>
	</header>

	<!-- Main content -->
	<main class="container mx-auto max-w-4xl px-4 py-8">
		<h1 class="mb-8 text-3xl font-bold">API Access Tokens</h1>

		{#if !hasApiAccess}
			<!-- Upgrade prompt -->
			<div class="rounded-lg border border-amber-500/50 bg-amber-500/10 p-6">
				<h2 class="mb-2 text-lg font-semibold">API Access Not Available</h2>
				<p class="mb-4 text-muted-foreground">
					API access is only available on the Enterprise plan. Upgrade to get programmatic access to
					the OCR service.
				</p>
				<Button>Upgrade to Enterprise</Button>
			</div>
		{:else}
			<!-- API Tokens section -->
			<div class="space-y-6">
				<div class="flex items-center justify-between">
					<div>
						<h2 class="text-lg font-semibold">Your API Tokens</h2>
						<p class="text-sm text-muted-foreground">
							Use these tokens to authenticate API requests. Keep them secret!
						</p>
					</div>
					<Button onclick={() => (showCreateDialog = true)}>Create New Token</Button>
				</div>

				{#if error}
					<div class="rounded-lg border border-red-500/50 bg-red-500/10 p-4 text-red-600">
						{error}
					</div>
				{/if}

				{#if isLoading}
					<div class="py-8 text-center text-muted-foreground">Loading tokens...</div>
				{:else if tokens.length === 0}
					<div class="rounded-lg border border-dashed p-8 text-center">
						<p class="mb-4 text-muted-foreground">No API tokens yet</p>
						<Button onclick={() => (showCreateDialog = true)}>Create Your First Token</Button>
					</div>
				{:else}
					<div class="space-y-4">
						{#each tokens as token}
							<div
								class="flex items-center justify-between rounded-lg border p-4"
								class:opacity-50={!token.isActive}
							>
								<div class="space-y-1">
									<div class="flex items-center gap-2">
										<span class="font-medium">{token.name}</span>
										{#if !token.isActive}
											<span class="rounded bg-red-500/10 px-2 py-0.5 text-xs text-red-600">
												{token.revokedAt ? 'Revoked' : 'Expired'}
											</span>
										{/if}
									</div>
									<div class="font-mono text-sm text-muted-foreground">
										{token.tokenPrefix}...
									</div>
									<div class="text-xs text-muted-foreground">
										Created {formatDate(token.createdAt)}
										{#if token.lastUsedAt}
											&bull; Last used {formatDate(token.lastUsedAt)}
										{/if}
										{#if token.expiresAt}
											&bull; Expires {formatDate(token.expiresAt)}
										{/if}
									</div>
								</div>
								{#if token.isActive}
									<Button
										variant="destructive"
										size="sm"
										onclick={() => {
											tokenToRevoke = token;
											showRevokeDialog = true;
										}}
									>
										Revoke
									</Button>
								{/if}
							</div>
						{/each}
					</div>
				{/if}

				<!-- API Documentation link -->
				<div class="mt-8 rounded-lg border bg-muted/50 p-6">
					<h3 class="mb-2 font-semibold">API Documentation</h3>
					<p class="mb-4 text-sm text-muted-foreground">
						Learn how to use the API to integrate OCR into your applications.
					</p>
					<a href="/docs/api">
						<Button variant="outline">View Documentation</Button>
					</a>
				</div>
			</div>
		{/if}
	</main>
</div>

<!-- Create Token Dialog -->
<Dialog bind:open={showCreateDialog}>
	<DialogContent>
		<DialogHeader>
			<DialogTitle>Create API Token</DialogTitle>
			<DialogDescription>
				Create a new API token for programmatic access. The token will only be shown once.
			</DialogDescription>
		</DialogHeader>

		<div class="space-y-4 py-4">
			<div class="space-y-2">
				<Label for="token-name">Token Name</Label>
				<Input
					id="token-name"
					placeholder="e.g., Production Server"
					bind:value={newTokenName}
					disabled={isCreating}
				/>
			</div>

			<div class="space-y-2">
				<Label for="token-expiry">Expiration (optional)</Label>
				<select
					id="token-expiry"
					class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
					bind:value={newTokenExpiry}
					disabled={isCreating}
				>
					<option value={null}>Never expires</option>
					<option value={7}>7 days</option>
					<option value={30}>30 days</option>
					<option value={90}>90 days</option>
					<option value={365}>1 year</option>
				</select>
			</div>
		</div>

		<DialogFooter>
			<Button variant="outline" onclick={() => (showCreateDialog = false)} disabled={isCreating}>
				Cancel
			</Button>
			<Button onclick={createToken} disabled={!newTokenName.trim() || isCreating}>
				{isCreating ? 'Creating...' : 'Create Token'}
			</Button>
		</DialogFooter>
	</DialogContent>
</Dialog>

<!-- New Token Display Dialog -->
<Dialog bind:open={showNewTokenDialog}>
	<DialogContent>
		<DialogHeader>
			<DialogTitle>Token Created Successfully</DialogTitle>
			<DialogDescription>Copy this token now. You won't be able to see it again!</DialogDescription>
		</DialogHeader>

		<div class="py-4">
			<div class="rounded-lg bg-muted p-4">
				<code class="block break-all font-mono text-sm">{newlyCreatedToken}</code>
			</div>
			<Button
				class="mt-4 w-full"
				onclick={() => {
					if (newlyCreatedToken) copyToClipboard(newlyCreatedToken);
				}}
			>
				Copy to Clipboard
			</Button>
		</div>

		<DialogFooter>
			<Button
				onclick={() => {
					showNewTokenDialog = false;
					newlyCreatedToken = null;
				}}
			>
				Done
			</Button>
		</DialogFooter>
	</DialogContent>
</Dialog>

<!-- Revoke Token Dialog -->
<Dialog bind:open={showRevokeDialog}>
	<DialogContent>
		<DialogHeader>
			<DialogTitle>Revoke Token</DialogTitle>
			<DialogDescription>
				Are you sure you want to revoke "{tokenToRevoke?.name}"? This action cannot be undone.
			</DialogDescription>
		</DialogHeader>

		<DialogFooter>
			<Button variant="outline" onclick={() => (showRevokeDialog = false)} disabled={isRevoking}>
				Cancel
			</Button>
			<Button variant="destructive" onclick={revokeToken} disabled={isRevoking}>
				{isRevoking ? 'Revoking...' : 'Revoke Token'}
			</Button>
		</DialogFooter>
	</DialogContent>
</Dialog>
