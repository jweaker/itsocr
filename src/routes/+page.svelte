<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { Input } from '$lib/components/ui/input';
	import { Textarea } from '$lib/components/ui/textarea';
	import { Label } from '$lib/components/ui/label';
	import ThemeToggle from '$lib/components/ThemeToggle.svelte';

	let title = $state('');
	let message = $state('');
	let mobileMenuOpen = $state(false);

	function handleMailto() {
		const subject = encodeURIComponent(title || 'Message from ItsOCR');
		const body = encodeURIComponent(message || '');
		const mailto = `mailto:ahmedxshaheed@gmail.com?subject=${subject}&body=${body}`;
		if (typeof window !== 'undefined') window.location.href = mailto;
	}

	const features = [
		{
			title: 'AI-Powered Extraction',
			desc: 'Vision model extracts text from images with formatting preserved.'
		},
		{
			title: 'Custom Prompts',
			desc: 'Add instructions like "Extract invoice total" or "Focus on handwritten text".'
		},
		{
			title: 'Real-time Streaming',
			desc: "Watch text appear as it's extracted via WebSocket."
		},
		{
			title: 'Drag, Drop, or Paste',
			desc: 'Upload via file picker, drag-and-drop, or paste from clipboard.'
		}
	];

	const pricingTiers = [
		{
			name: 'Free',
			price: '$0',
			period: '/month',
			desc: '10 images/month, 5MB max',
			highlight: false
		},
		{
			name: 'Pro',
			price: '$9.99',
			period: '/month',
			desc: '500 images/month, 20MB max',
			highlight: true
		},
		{
			name: 'Enterprise',
			price: '$49.99',
			period: '/month',
			desc: 'Unlimited images, 50MB max',
			highlight: false
		}
	];

	const navLinks = [
		{ href: '#features', label: 'Features' },
		{ href: '#pricing', label: 'Pricing' },
		{ href: '#contact', label: 'Contact' }
	];
</script>

<svelte:head>
	<title>ItsOCR - Extract text from images</title>
	<meta
		name="description"
		content="AI-powered OCR with real-time streaming. Upload, extract, done."
	/>
</svelte:head>

<div class="flex min-h-screen flex-col bg-background text-foreground">
	<!-- Navbar -->
	<header class="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-sm">
		<nav class="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
			<a href="/" class="flex items-center gap-2">
				<div
					class="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary sm:h-8 sm:w-8"
				>
					<svg class="h-4 w-4 sm:h-5 sm:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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

			<!-- Desktop nav -->
			<div class="hidden items-center gap-4 md:flex">
				{#each navLinks as link}
					<a
						href={link.href}
						class="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
					>
						{link.label}
					</a>
				{/each}
				<ThemeToggle showLabel />
				<a href="/login">
					<Button>Get Started</Button>
				</a>
			</div>

			<!-- Mobile menu button -->
			<button
				type="button"
				class="inline-flex items-center justify-center rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground md:hidden"
				aria-expanded={mobileMenuOpen}
				aria-controls="mobile-menu"
				onclick={() => (mobileMenuOpen = !mobileMenuOpen)}
			>
				<span class="sr-only">Open main menu</span>
				{#if mobileMenuOpen}
					<svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M6 18L18 6M6 6l12 12"
						/>
					</svg>
				{:else}
					<svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M4 6h16M4 12h16M4 18h16"
						/>
					</svg>
				{/if}
			</button>
		</nav>

		<!-- Mobile menu -->
		{#if mobileMenuOpen}
			<div id="mobile-menu" class="border-t bg-background md:hidden">
				<div class="space-y-1 px-4 py-3">
					{#each navLinks as link}
						<a
							href={link.href}
							class="block rounded-md px-3 py-2 text-base font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
							onclick={() => (mobileMenuOpen = false)}
						>
							{link.label}
						</a>
					{/each}
					<div class="flex items-center justify-between px-3 py-2">
						<span class="text-sm text-muted-foreground">Theme</span>
						<ThemeToggle />
					</div>
					<a href="/login" class="block">
						<Button class="w-full">Get Started</Button>
					</a>
				</div>
			</div>
		{/if}
	</header>

	<main>
		<!-- Hero Section -->
		<section class="mx-auto max-w-6xl px-4 py-16 text-center sm:px-6 md:py-24">
			<h1 class="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
				Image to text, instantly
			</h1>
			<p class="mx-auto mt-6 max-w-xl text-lg text-muted-foreground">
				Upload an image, get the text. Use custom prompts to extract exactly what you need.
			</p>
			<div class="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
				<a href="/login">
					<Button size="lg" class="min-w-[160px]">Get Started Free</Button>
				</a>
			</div>
		</section>

		<!-- Features Section -->
		<section id="features" class="scroll-mt-20 py-16">
			<div class="mx-auto max-w-6xl px-4 sm:px-6">
				<h2 class="text-2xl font-semibold sm:text-3xl">Features</h2>
				<div class="mt-8 grid gap-4 sm:grid-cols-2">
					{#each features as feature}
						<Card.Root
							class="transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md"
						>
							<Card.Header>
								<Card.Title class="text-lg">{feature.title}</Card.Title>
							</Card.Header>
							<Card.Content>
								<p class="text-sm text-muted-foreground">{feature.desc}</p>
							</Card.Content>
						</Card.Root>
					{/each}
				</div>
			</div>
		</section>

		<!-- Pricing Section -->
		<section id="pricing" class="scroll-mt-20 border-t py-16">
			<div class="mx-auto max-w-6xl px-4 sm:px-6">
				<h2 class="text-2xl font-semibold sm:text-3xl">Pricing</h2>
				<div class="mt-8 grid gap-4 md:grid-cols-3">
					{#each pricingTiers as tier}
						<Card.Root
							class={tier.highlight
								? 'relative border-primary shadow-lg ring-1 ring-primary'
								: 'border-border'}
						>
							{#if tier.highlight}
								<div
									class="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground"
								>
									Most Popular
								</div>
							{/if}
							<Card.Header class="text-center">
								<Card.Title class="text-lg text-primary">{tier.name}</Card.Title>
								<div class="mt-2">
									<span class="text-4xl font-bold">{tier.price}</span>
									{#if tier.period}
										<span class="text-muted-foreground">{tier.period}</span>
									{/if}
								</div>
								<Card.Description>{tier.desc}</Card.Description>
							</Card.Header>
							<Card.Footer>
								<a href="/login" class="w-full">
									<Button class="w-full" variant={tier.highlight ? 'default' : 'outline'}>
										Get Started
									</Button>
								</a>
							</Card.Footer>
						</Card.Root>
					{/each}
				</div>
			</div>
		</section>

		<!-- Contact Section -->
		<section id="contact" class="scroll-mt-20 py-16">
			<div class="mx-auto max-w-6xl px-4 sm:px-6">
				<h2 class="text-2xl font-semibold sm:text-3xl">Contact</h2>
				<div class="mt-8 grid gap-6 lg:grid-cols-2">
					<Card.Root>
						<Card.Content class="pt-6">
							<form
								class="space-y-4"
								onsubmit={(e) => {
									e.preventDefault();
									handleMailto();
								}}
							>
								<div class="space-y-2">
									<Label for="title">Subject</Label>
									<Input
										id="title"
										type="text"
										placeholder="What's this about?"
										bind:value={title}
									/>
								</div>
								<div class="space-y-2">
									<Label for="message">Message</Label>
									<Textarea
										id="message"
										rows={4}
										placeholder="How can we help?"
										bind:value={message}
									/>
								</div>
								<Button type="submit" class="w-full">Send Message</Button>
							</form>
						</Card.Content>
					</Card.Root>

					<Card.Root class="flex flex-col justify-center">
						<Card.Header>
							<Card.Title>Get in touch</Card.Title>
							<Card.Description>We usually respond within a day.</Card.Description>
						</Card.Header>
						<Card.Content class="space-y-4">
							<div class="flex items-start gap-3 text-sm">
								<svg
									class="mt-0.5 h-5 w-5 shrink-0 text-primary"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
									/>
								</svg>
								<div>
									<p class="font-medium">Email</p>
									<p class="text-muted-foreground">support@itsocr.com</p>
								</div>
							</div>
							<div class="flex items-start gap-3 text-sm">
								<svg
									class="mt-0.5 h-5 w-5 shrink-0 text-primary"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
									/>
								</svg>
								<div>
									<p class="font-medium">Hours</p>
									<p class="text-muted-foreground">Sun-Thu, 9am-6pm (UTC)</p>
								</div>
							</div>
							<div class="flex items-start gap-3 text-sm">
								<svg
									class="mt-0.5 h-5 w-5 shrink-0 text-primary"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
									/>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
									/>
								</svg>
								<div>
									<p class="font-medium">Address</p>
									<p class="text-muted-foreground">308 Negra Arroyo Lane, Albuquerque, NM 87104</p>
								</div>
							</div>
						</Card.Content>
					</Card.Root>
				</div>
			</div>
		</section>
	</main>

	<!-- Footer -->
	<footer class="border-t py-8">
		<div class="mx-auto max-w-6xl px-4 sm:px-6">
			<div class="flex flex-col items-center justify-between gap-4 sm:flex-row">
				<p class="text-sm text-muted-foreground">
					&copy; {new Date().getFullYear()} ItsOCR. All rights reserved.
				</p>
				<div class="flex gap-6 text-sm text-muted-foreground">
					<a href="/privacy" class="hover:text-foreground">Privacy</a>
					<a href="/terms" class="hover:text-foreground">Terms</a>
				</div>
			</div>
		</div>
	</footer>
</div>
