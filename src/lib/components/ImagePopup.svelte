<script lang="ts">
	import {
		Dialog,
		DialogContent,
		DialogDescription,
		DialogFooter,
		DialogHeader,
		DialogTitle
	} from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Textarea } from '$lib/components/ui/textarea';
	import { Label } from '$lib/components/ui/label';
	import { Switch } from '$lib/components/ui/switch';
	import { Tabs, TabsList, TabsTrigger, TabsContent } from '$lib/components/ui/tabs';
	import { Select, SelectContent, SelectItem, SelectTrigger } from '$lib/components/ui/select';

	interface Props {
		open?: boolean;
		imageUrl?: string;
		imageAlt?: string;
	}

	let { open = $bindable(false), imageUrl = '', imageAlt = '' }: Props = $props();

	const maxImagesPerUser = 5;
	let usedImages = $state(0);

	let activeTab = $state('new');
	let title = $state('');
	let description = $state('');
	let tags = $state('');

	let file: File | null = $state(null);
	let filePreview: string | null = $state(null);

	let language = $state('en');
	let model = $state('llava');
	let runOcr = $state(true);
	let saveToHistory = $state(true);

	let cacheMode = $state('auto');
	let accessToken = $state('');

	const languageLabels: Record<string, string> = { en: 'English', ar: 'Arabic', fr: 'French' };
	const modelLabels: Record<string, string> = {
		llava: 'Ollama LLaVA',
		custom: 'Custom model'
	};
	const cacheModeLabels: Record<string, string> = {
		auto: 'Auto - use cached result if available',
		force: 'Force - always reprocess the image'
	};

	function handleFileChange(event: Event) {
		const target = event.currentTarget as HTMLInputElement;
		const nextFile = target.files?.[0];
		if (!nextFile) return;

		file = nextFile;
		const reader = new FileReader();
		reader.onload = () => (filePreview = reader.result as string);
		reader.readAsDataURL(nextFile);
	}

	function handleSubmit() {
		if (usedImages < maxImagesPerUser) usedImages += 1;
		open = false;
	}
</script>

<Dialog bind:open>
	<DialogContent class="sm:max-w-2xl">
		<DialogHeader>
			<DialogTitle>New Image</DialogTitle>
			<DialogDescription>
				Create a new OCR job: upload an image, configure options, and caching behavior.
			</DialogDescription>
		</DialogHeader>

		<Tabs bind:value={activeTab} class="mt-4 w-full">
			<TabsList class="grid w-full grid-cols-4">
				<TabsTrigger value="new">New</TabsTrigger>
				<TabsTrigger value="upload">Upload</TabsTrigger>
				<TabsTrigger value="options">Options</TabsTrigger>
				<TabsTrigger value="custom">Custom</TabsTrigger>
			</TabsList>

			<TabsContent value="new" class="mt-4 space-y-4">
				<div class="space-y-2">
					<Label for="title">Title</Label>
					<Input
						id="title"
						placeholder="Example: Invoice scan, Passport front side"
						bind:value={title}
					/>
				</div>

				<div class="space-y-2">
					<Label for="description">Description</Label>
					<Textarea
						id="description"
						rows={3}
						placeholder="Short description of the image or document..."
						bind:value={description}
					/>
				</div>

				<div class="space-y-2">
					<Label for="tags">Tags</Label>
					<Input id="tags" placeholder="finance, contract, id, ..." bind:value={tags} />
				</div>
			</TabsContent>

			<TabsContent value="upload" class="mt-4 space-y-4">
				<div
					class="flex flex-col items-center justify-center rounded-lg border border-dashed p-6 text-center"
				>
					<p class="text-sm font-medium">Drag &amp; drop an image here</p>
					<p class="mt-1 text-xs text-muted-foreground">PNG, JPG - up to 5MB</p>

					<div class="mt-4 w-full">
						<input
							type="file"
							accept="image/*"
							onchange={handleFileChange}
							class="w-full cursor-pointer rounded-md border px-3 py-2 text-sm file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-2 file:text-sm file:font-medium file:text-foreground hover:file:bg-secondary/80"
						/>
					</div>
				</div>

				{#if filePreview || imageUrl}
					<div class="space-y-2">
						<Label>Preview</Label>
						<img
							src={filePreview ?? imageUrl}
							alt={imageAlt || 'Selected image'}
							class="max-h-64 w-auto rounded-md border object-contain"
						/>
					</div>
				{/if}

				<p class="text-xs text-muted-foreground">
					You have used {usedImages} / {maxImagesPerUser} uploads in this demo.
				</p>
			</TabsContent>

			<TabsContent value="options" class="mt-4 space-y-4">
				<div class="grid gap-4 md:grid-cols-2">
					<div class="space-y-2">
						<Label>OCR Language</Label>
						<div class="w-full">
							<Select bind:value={language} type="single">
								<SelectTrigger class="w-full">
									<span data-slot="select-value" class="truncate">
										{languageLabels[language] ?? 'Select language'}
									</span>
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="en">English</SelectItem>
									<SelectItem value="ar">Arabic</SelectItem>
									<SelectItem value="fr">French</SelectItem>
								</SelectContent>
							</Select>
						</div>
					</div>

					<div class="space-y-2">
						<Label>Model</Label>
						<div class="w-full">
							<Select bind:value={model} type="single">
								<SelectTrigger class="w-full">
									<span data-slot="select-value" class="truncate">
										{modelLabels[model] ?? 'Select model'}
									</span>
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="llava">Ollama LLaVA</SelectItem>
									<SelectItem value="custom">Custom model</SelectItem>
								</SelectContent>
							</Select>
						</div>
					</div>
				</div>

				<div class="flex items-center justify-between rounded-lg border p-3">
					<div class="space-y-0.5">
						<Label>Run OCR immediately</Label>
						<p class="text-xs text-muted-foreground">
							If disabled, the image will be stored but not processed yet.
						</p>
					</div>
					<Switch bind:checked={runOcr} />
				</div>

				<div class="flex items-center justify-between rounded-lg border p-3">
					<div class="space-y-0.5">
						<Label>Save to history</Label>
						<p class="text-xs text-muted-foreground">
							Keep this image and its extracted text in the user dashboard.
						</p>
					</div>
					<Switch bind:checked={saveToHistory} />
				</div>
			</TabsContent>

			<TabsContent value="custom" class="mt-4 space-y-4">
				<div class="space-y-2">
					<Label>Cache mode</Label>
					<div class="w-full">
						<Select bind:value={cacheMode} type="single">
							<SelectTrigger class="w-full">
								<span data-slot="select-value" class="truncate">
									{cacheModeLabels[cacheMode] ?? 'Select cache behavior'}
								</span>
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="auto">Auto - use cached result if available</SelectItem>
								<SelectItem value="force">Force - always reprocess the image</SelectItem>
							</SelectContent>
						</Select>
					</div>
				</div>

				<div class="space-y-2">
					<Label>Access token (optional)</Label>
					<Input placeholder="Paste an access token..." bind:value={accessToken} />
					<p class="text-xs text-muted-foreground">
						Tokens can be generated from the Access Tokens page.
					</p>
				</div>

				<div class="rounded-md border bg-muted/50 p-3 text-xs text-muted-foreground">
					<strong>Rate limiting</strong><br />
					Each IP address can upload up to 5 images in the demo environment.
				</div>
			</TabsContent>
		</Tabs>

		<DialogFooter class="mt-6 flex justify-end gap-2">
			<Button variant="outline" on:click={() => (open = false)}>Cancel</Button>
			<Button on:click={handleSubmit}>Create &amp; Run OCR</Button>
		</DialogFooter>
	</DialogContent>
</Dialog>
