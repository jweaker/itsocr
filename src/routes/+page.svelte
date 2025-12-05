<script lang="ts">
	import { Button } from '$lib/components/ui/button';

	let title = '';
	let message = '';
	let darkMode = true;
	let mounted = false;

	function handleMailto() {
		const subject = encodeURIComponent(title || 'Message from ItsOCR landing');
		const body = encodeURIComponent(message || '');
		const mailto = `mailto:ahmedxshaheed@gmail.com?subject=${subject}&body=${body}`;
		// Using location assignment to open user's mail client
		if (typeof window !== 'undefined') window.location.href = mailto;
	}
</script>

<svelte:head>
	<style>
		html {
			scroll-behavior: smooth;
		}
		@keyframes floaty {
			0% {
				transform: translateY(0);
			}
			50% {
				transform: translateY(-8px);
			}
			100% {
				transform: translateY(0);
			}
		}
		@keyframes fadeUp {
			0% {
				opacity: 0;
				transform: translateY(12px);
			}
			100% {
				opacity: 1;
				transform: translateY(0);
			}
		}
		.animate-floaty {
			animation: floaty 6s ease-in-out infinite;
		}
		.animate-fade-up {
			animation: fadeUp 500ms ease forwards;
		}
	</style>
</svelte:head>

<main
	class="relative min-h-screen overflow-hidden bg-gradient-to-b from-slate-50 via-white to-slate-100 text-slate-900 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 dark:text-foreground"
>
	<!-- Decorative blobs -->
	<div class="pointer-events-none absolute inset-0 opacity-70">
		<div
			class="absolute left-[-10%] top-[-10%] h-64 w-64 rounded-full bg-primary/10 blur-3xl animate-floaty dark:bg-primary/20"
		></div>
		<div
			class="absolute bottom-[-10%] right-[-10%] h-72 w-72 rounded-full bg-indigo-400/15 blur-3xl animate-floaty dark:bg-indigo-500/20"
			style="animation-delay:1s"
		></div>
	</div>

	<!-- Navbar -->
	<nav
		class="sticky top-0 z-20 border-b border-primary/20 bg-white/70 backdrop-blur dark:border-primary/30 dark:bg-primary/15"
	>
		<div class="mx-auto flex max-w-6xl items-center justify-between px-6 py-3 md:py-4">
			<div class="flex items-center gap-3">
				<div class="text-lg font-semibold tracking-tight text-slate-900 dark:text-white">
					ItsOCR
				</div>
			</div>
			<div class="flex items-center gap-4 text-sm font-medium md:gap-6">
				<a href="#about" class="transition hover:text-primary">About</a>
				<a href="#features" class="transition hover:text-primary">Features</a>
				<a href="#pricing" class="transition hover:text-primary">Pricing</a>
				<a href="#contact" class="transition hover:text-primary">Contact</a>
				<a href="/login"><Button>Get Started</Button></a>
			</div>
		</div>
	</nav>

	<!-- Hero -->
	<section class="mx-auto flex max-w-6xl flex-col gap-6 px-6 pb-20 pt-16 text-center md:pt-24">
		<p class="text-sm font-semibold uppercase tracking-[0.2em] text-primary animate-fade-up">
			OCR made easy
		</p>
		<h1
			class="animate-fade-up text-4xl font-semibold leading-tight tracking-tight text-slate-900 dark:text-white md:text-5xl"
		>
			Transform images into structured data in seconds.
		</h1>
		<p class="animate-fade-up mx-auto max-w-3xl text-lg text-slate-600 dark:text-slate-200/80">
			Lightning-fast OCR with smart validation—ready for invoices, IDs, and receipts. Built for
			teams that need reliability without complexity.
		</p>
		<div class="animate-fade-up flex justify-center">
			<a href="/login">
				<Button
					size="lg"
					class="px-8 shadow-lg shadow-primary/20 transition hover:-translate-y-0.5 dark:shadow-primary/25"
					>Get Started</Button
				>
			</a>
		</div>
		<p class="animate-fade-up text-sm text-slate-600 dark:text-slate-200/70">
			No credit card required. Start processing your first document today.
		</p>
	</section>

	<!-- About -->
	<section id="about" class="mx-auto max-w-6xl scroll-mt-24 px-6 py-14">
		<div
			class="rounded-2xl border border-slate-200/80 bg-white/70 p-8 shadow-lg shadow-black/5 backdrop-blur dark:border-white/10 dark:bg-white/5 dark:shadow-black/10"
		>
			<h2 class="text-2xl font-semibold text-slate-900 dark:text-white">About</h2>
			<p class="mt-3 max-w-3xl text-base text-slate-700 dark:text-slate-200/80">
				Our platform brings enterprise-grade OCR to your workflows with a simple interface and fast
				setup. Upload images, configure your preferences, and ship clean text to your stack with
				confidence.
			</p>
		</div>
	</section>

	<!-- Features -->
	<section id="features" class="mx-auto max-w-6xl scroll-mt-24 px-6 py-14">
		<h2 class="text-2xl font-semibold text-slate-900 dark:text-white">Features</h2>
		<div class="mt-8 grid gap-6 md:grid-cols-2">
			{#each [{ title: 'Multi-language OCR', desc: 'Extract text in English, Arabic, and French with optimized models for each script.' }, { title: 'Smart validation', desc: 'Built-in checks for totals, dates, and IDs to reduce manual review.' }, { title: 'Flexible models', desc: 'Switch between LLaVA or your custom endpoint with a single toggle.' }, { title: 'Caching and history', desc: 'Reuse prior results, keep audit trails, and export whenever you need.' }, { title: 'Secure by default', desc: 'Encryption in transit and at rest with role-based access controls.' }, { title: 'Developer friendly', desc: 'Clean APIs, webhooks, and SDKs to fit into your existing automation.' }] as feature}
				<div
					class="rounded-xl border border-slate-200/80 bg-white/70 p-6 shadow-lg shadow-black/5 backdrop-blur transition hover:-translate-y-1 hover:border-primary/60 hover:shadow-primary/20 dark:border-white/10 dark:bg-white/5 dark:shadow-black/10"
				>
					<h3 class="text-lg font-semibold text-slate-900 dark:text-white">{feature.title}</h3>
					<p class="mt-2 text-sm text-slate-700 dark:text-slate-200/80">{feature.desc}</p>
				</div>
			{/each}
		</div>
	</section>

	<!-- Pricing -->
	<section id="pricing" class="mx-auto max-w-6xl scroll-mt-24 px-6 py-14">
		<h2 class="text-2xl font-semibold text-slate-900 dark:text-white">Pricing</h2>
		<div class="mt-8 grid gap-6 md:grid-cols-3">
			{#each [{ name: 'Free', price: '$0', desc: 'Up to 50 pages/month', features: ['Basic OCR', 'Email support', 'Community access'], highlight: false }, { name: 'Pro', price: '$49', desc: 'Up to 5k pages/month', features: ['Advanced OCR', 'Priority support', 'Custom webhooks'], highlight: true }, { name: 'Enterprise', price: "Let's talk", desc: 'Custom volume', features: ['Dedicated cluster', 'SSO and RBAC', 'Onboarding and training'], highlight: false }] as tier}
				<div
					class={`rounded-2xl border bg-white/70 p-6 shadow-lg shadow-black/5 backdrop-blur transition ${tier.highlight ? 'border-primary shadow-primary/20 ring-1 ring-primary/30' : 'border-slate-200/80 dark:border-white/10'} dark:bg-white/5 dark:shadow-black/10`}
				>
					<p class="text-sm font-semibold text-primary">{tier.name}</p>
					<div class="mt-2 text-3xl font-semibold text-slate-900 dark:text-white">{tier.price}</div>
					<p class="mt-1 text-sm text-slate-700 dark:text-slate-200/80">{tier.desc}</p>
					<ul class="mt-4 space-y-2 text-sm text-slate-800 dark:text-slate-200/90">
						{#each tier.features as item}
							<li class="flex items-start gap-2">
								<span class="mt-1 inline-block h-1.5 w-1.5 rounded-full bg-primary"></span>
								<span>{item}</span>
							</li>
						{/each}
					</ul>
					<div class="mt-6">
						<a href="/login">
							<Button class="w-full" variant={tier.highlight ? 'default' : 'outline'}
								>Choose plan</Button
							>
						</a>
					</div>
				</div>
			{/each}
		</div>
	</section>

	<!-- Contact -->
	<section id="contact" class="mx-auto max-w-6xl scroll-mt-24 px-6 py-14">
		<h2 class="text-2xl font-semibold text-slate-900 dark:text-white">Contact</h2>
		<div class="mt-6 grid gap-6 md:grid-cols-2">
			<div
				class="rounded-2xl border border-slate-200/80 bg-white/70 p-6 shadow-lg shadow-black/5 backdrop-blur dark:border-white/10 dark:bg-white/5 dark:shadow-black/10"
			>
				<form class="space-y-4" on:submit|preventDefault={handleMailto}>
					<div class="space-y-1">
						<label class="text-sm font-medium text-slate-900 dark:text-white" for="title"
							>Title</label
						>
						<input
							id="title"
							type="text"
							placeholder="Subject of your message"
							class="w-full rounded-lg border border-slate-200/80 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 dark:border-white/20 dark:bg-white/5 dark:text-white"
							bind:value={title}
						/>
					</div>
					<div class="space-y-1">
						<label class="text-sm font-medium text-slate-900 dark:text-white" for="message"
							>Message</label
						>
						<textarea
							id="message"
							rows="4"
							placeholder="How can we help?"
							class="w-full rounded-lg border border-slate-200/80 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 dark:border-white/20 dark:bg-white/5 dark:text-white"
							bind:value={message}
						></textarea>
					</div>
					<Button type="submit" class="w-full">Send email</Button>
				</form>
			</div>

			<div
				class="flex flex-col justify-center rounded-2xl border border-slate-200/80 bg-white/70 p-6 shadow-lg shadow-black/5 backdrop-blur dark:border-white/10 dark:bg-white/5 dark:shadow-black/10"
			>
				<h3 class="text-lg font-semibold text-slate-900 dark:text-white">We're here to help</h3>
				<p class="mt-2 text-sm text-slate-700 dark:text-slate-200/80">
					Questions about onboarding, pricing, or integrations? Drop us a line and our team will get
					back within one business day.
				</p>
				<div class="mt-4 space-y-2 text-sm text-slate-700 dark:text-slate-200/90">
					<p><strong>Email:</strong> support@example.com</p>
					<p><strong>Hours:</strong> Mon-Fri, 9am-6pm (UTC)</p>
				</div>
			</div>
		</div>
	</section>
</main>
