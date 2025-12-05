<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { Input } from '$lib/components/ui/input';
	import { Textarea } from '$lib/components/ui/textarea';
	import { Label } from '$lib/components/ui/label';
	import { Separator } from '$lib/components/ui/separator';

	let title = $state('');
	let message = $state('');
	let mobileMenuOpen = $state(false);

	function handleMailto() {
		const subject = encodeURIComponent(title || 'Message from ItsOCR landing');
		const body = encodeURIComponent(message || '');
		const mailto = `mailto:ahmedxshaheed@gmail.com?subject=${subject}&body=${body}`;
		if (typeof window !== 'undefined') window.location.href = mailto;
	}

	const features = [
		{
			title: 'Multi-language OCR',
			desc: 'Extract text in English, Arabic, and French with optimized models for each script.'
		},
		{
			title: 'Smart Validation',
			desc: 'Built-in checks for totals, dates, and IDs to reduce manual review.'
		},
		{
			title: 'Flexible Models',
			desc: 'Switch between LLaVA or your custom endpoint with a single toggle.'
		},
		{
			title: 'Caching & History',
			desc: 'Reuse prior results, keep audit trails, and export whenever you need.'
		},
		{
			title: 'Secure by Default',
			desc: 'Encryption in transit and at rest with role-based access controls.'
		},
		{
			title: 'Developer Friendly',
			desc: 'Clean APIs, webhooks, and SDKs to fit into your existing automation.'
		}
	];

	const pricingTiers = [
		{
			name: 'Free',
			price: '$0',
			period: '/month',
			desc: 'Up to 50 pages/month',
			features: ['Basic OCR', 'Email support', 'Community access'],
			highlight: false
		},
		{
			name: 'Pro',
			price: '$49',
			period: '/month',
			desc: 'Up to 5k pages/month',
			features: ['Advanced OCR', 'Priority support', 'Custom webhooks'],
			highlight: true
		},
		{
			name: 'Enterprise',
			price: "Let's talk",
			period: '',
			desc: 'Custom volume',
			features: ['Dedicated cluster', 'SSO and RBAC', 'Onboarding & training'],
			highlight: false
		}
	];

	const navLinks = [
		{ href: '#about', label: 'About' },
		{ href: '#features', label: 'Features' },
		{ href: '#pricing', label: 'Pricing' },
		{ href: '#contact', label: 'Contact' }
	];
</script>

<svelte:head>
	<title>ItsOCR - Transform images into structured data</title>
	<meta
		name="description"
		content="Lightning-fast OCR with smart validation. Ready for invoices, IDs, and receipts."
	/>
</svelte:head>

<div class="relative min-h-screen bg-background text-foreground">
	<!-- Decorative background -->
	<div class="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
		<div
			class="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-primary/5 blur-3xl dark:bg-primary/10"
		></div>
		<div
			class="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-primary/5 blur-3xl dark:bg-primary/10"
		></div>
	</div>

	<!-- Navbar -->
	<header class="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-sm">
		<nav class="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
			<a href="/" class="text-xl font-semibold tracking-tight">ItsOCR</a>

			<!-- Desktop nav -->
			<div class="hidden items-center gap-6 md:flex">
				{#each navLinks as link}
					<a
						href={link.href}
						class="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
					>
						{link.label}
					</a>
				{/each}
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
					<Separator class="my-2" />
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
			<p class="text-sm font-semibold uppercase tracking-widest text-primary">OCR made easy</p>
			<h1 class="mt-4 text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
				Transform images into<br />
				<span class="text-primary">structured data</span> in seconds.
			</h1>
			<p class="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
				Lightning-fast OCR with smart validation. Ready for invoices, IDs, and receipts. Built for
				teams that need reliability without complexity.
			</p>
			<div class="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
				<a href="/login">
					<Button size="lg" class="min-w-[160px]">Get Started Free</Button>
				</a>
				<a href="#features">
					<Button size="lg" variant="outline" class="min-w-[160px]">Learn More</Button>
				</a>
			</div>
			<p class="mt-4 text-sm text-muted-foreground">
				No credit card required. Start processing your first document today.
			</p>
		</section>

		<!-- About Section -->
		<section id="about" class="scroll-mt-20 bg-muted/30 py-16">
			<div class="mx-auto max-w-6xl px-4 sm:px-6">
				<Card.Root class="border-0 bg-transparent shadow-none">
					<Card.Header class="px-0">
						<Card.Title class="text-2xl font-semibold sm:text-3xl">About</Card.Title>
					</Card.Header>
					<Card.Content class="px-0">
						<p class="max-w-3xl text-lg text-muted-foreground">
							Our platform brings enterprise-grade OCR to your workflows with a simple interface and
							fast setup. Upload images, configure your preferences, and ship clean text to your
							stack with confidence. Whether you're processing invoices, receipts, or identity
							documents, we've got you covered.
						</p>
					</Card.Content>
				</Card.Root>
			</div>
		</section>

		<!-- Features Section -->
		<section id="features" class="scroll-mt-20 py-16">
			<div class="mx-auto max-w-6xl px-4 sm:px-6">
				<h2 class="text-2xl font-semibold sm:text-3xl">Features</h2>
				<div class="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
		<section id="pricing" class="scroll-mt-20 bg-muted/30 py-16">
			<div class="mx-auto max-w-6xl px-4 sm:px-6">
				<div class="text-center">
					<h2 class="text-2xl font-semibold sm:text-3xl">Simple, transparent pricing</h2>
					<p class="mt-2 text-muted-foreground">Choose the plan that fits your needs</p>
				</div>
				<div class="mt-10 grid gap-6 md:grid-cols-3">
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
							<Card.Content>
								<ul class="space-y-3">
									{#each tier.features as item}
										<li class="flex items-center gap-2 text-sm">
											<svg
												class="h-4 w-4 shrink-0 text-primary"
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
											<span>{item}</span>
										</li>
									{/each}
								</ul>
							</Card.Content>
							<Card.Footer>
								<a href="/login" class="w-full">
									<Button class="w-full" variant={tier.highlight ? 'default' : 'outline'}>
										{tier.name === 'Enterprise' ? 'Contact Sales' : 'Get Started'}
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
				<h2 class="text-2xl font-semibold sm:text-3xl">Get in touch</h2>
				<div class="mt-8 grid gap-6 lg:grid-cols-2">
					<Card.Root>
						<Card.Header>
							<Card.Title>Send us a message</Card.Title>
							<Card.Description>We'll get back to you within one business day.</Card.Description>
						</Card.Header>
						<Card.Content>
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

					<Card.Root>
						<Card.Header>
							<Card.Title>We're here to help</Card.Title>
							<Card.Description>
								Questions about onboarding, pricing, or integrations?
							</Card.Description>
						</Card.Header>
						<Card.Content class="space-y-4">
							<p class="text-sm text-muted-foreground">
								Our team is ready to assist you with any questions about getting started, pricing
								plans, or technical integrations.
							</p>
							<Separator />
							<div class="space-y-3 text-sm">
								<div class="flex items-center gap-3">
									<svg
										class="h-5 w-5 text-muted-foreground"
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
									<span>support@itsocr.com</span>
								</div>
								<div class="flex items-center gap-3">
									<svg
										class="h-5 w-5 text-muted-foreground"
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
									<span>Mon-Fri, 9am-6pm (UTC)</span>
								</div>
							</div>
						</Card.Content>
					</Card.Root>
				</div>
			</div>
		</section>
	</main>

	<!-- Footer -->
	<footer class="border-t bg-muted/30 py-8">
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
