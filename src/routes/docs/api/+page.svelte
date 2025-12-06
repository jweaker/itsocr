<script lang="ts">
	import { Button } from '$lib/components/ui/button';
</script>

<svelte:head>
	<title>API Documentation - itsOCR</title>
</svelte:head>

<div class="min-h-screen bg-background">
	<!-- Header -->
	<header class="border-b bg-card">
		<div class="container mx-auto flex h-16 items-center justify-between px-4">
			<div class="flex items-center gap-4">
				<a href="/dashboard" class="text-xl font-bold">itsOCR</a>
				<span class="text-muted-foreground">/</span>
				<span class="text-muted-foreground">API Documentation</span>
			</div>
			<div class="flex items-center gap-4">
				<a href="/settings">
					<Button variant="outline">Manage API Tokens</Button>
				</a>
				<a href="/dashboard">
					<Button variant="ghost">Dashboard</Button>
				</a>
			</div>
		</div>
	</header>

	<!-- Main content -->
	<main class="container mx-auto max-w-4xl px-4 py-8">
		<h1 class="mb-2 text-3xl font-bold">API Documentation</h1>
		<p class="mb-8 text-muted-foreground">
			Use the itsOCR API to extract text from images programmatically.
		</p>

		<!-- Authentication -->
		<section class="mb-12">
			<h2 class="mb-4 text-2xl font-semibold">Authentication</h2>
			<p class="mb-4 text-muted-foreground">
				All API requests require authentication using a Bearer token. You can create API tokens in
				your <a href="/settings" class="text-primary underline">Settings</a>.
			</p>
			<div class="rounded-lg bg-muted p-4">
				<code class="text-sm">Authorization: Bearer itsocr_your_token_here</code>
			</div>
		</section>

		<!-- Base URL -->
		<section class="mb-12">
			<h2 class="mb-4 text-2xl font-semibold">Base URL</h2>
			<div class="rounded-lg bg-muted p-4">
				<code class="text-sm">https://itsocr.com/api/v1</code>
			</div>
		</section>

		<!-- OCR Endpoint -->
		<section class="mb-12">
			<h2 class="mb-4 text-2xl font-semibold">OCR Endpoint</h2>

			<div class="mb-6 rounded-lg border p-6">
				<div class="mb-4 flex items-center gap-3">
					<span class="rounded bg-green-500/20 px-2 py-1 text-sm font-semibold text-green-600"
						>POST</span
					>
					<code class="text-sm">/ocr</code>
				</div>

				<p class="mb-4 text-muted-foreground">
					Extract text from an image. Supports JPEG, PNG, GIF, WebP, and other common image formats.
				</p>

				<h3 class="mb-2 font-semibold">Request</h3>
				<p class="mb-2 text-sm text-muted-foreground">Content-Type: multipart/form-data</p>

				<div class="mb-4 overflow-x-auto rounded-lg bg-muted p-4">
					<table class="w-full text-sm">
						<thead>
							<tr class="border-b">
								<th class="pb-2 text-left">Field</th>
								<th class="pb-2 text-left">Type</th>
								<th class="pb-2 text-left">Required</th>
								<th class="pb-2 text-left">Description</th>
							</tr>
						</thead>
						<tbody>
							<tr class="border-b">
								<td class="py-2 font-mono">file</td>
								<td class="py-2">File</td>
								<td class="py-2">Yes</td>
								<td class="py-2">The image file to process</td>
							</tr>
							<tr>
								<td class="py-2 font-mono">prompt</td>
								<td class="py-2">String</td>
								<td class="py-2">No</td>
								<td class="py-2">Custom prompt for OCR (overrides default)</td>
							</tr>
						</tbody>
					</table>
				</div>

				<h3 class="mb-2 font-semibold">Response</h3>
				<div class="overflow-x-auto rounded-lg bg-zinc-900 p-4">
					<pre class="text-sm text-zinc-100">{`{
  "success": true,
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "text": "Extracted text from the image...",
  "processingTimeMs": 1234,
  "fileName": "document.jpg",
  "fileSize": 102400,
  "mimeType": "image/jpeg"
}`}</pre>
				</div>
			</div>
		</section>

		<!-- Example -->
		<section class="mb-12">
			<h2 class="mb-4 text-2xl font-semibold">Example</h2>

			<h3 class="mb-2 font-semibold">cURL</h3>
			<div class="overflow-x-auto rounded-lg bg-zinc-900 p-4">
				<pre class="text-sm text-zinc-100">{`curl -X POST https://itsocr.com/api/v1/ocr \\
  -H "Authorization: Bearer itsocr_your_token_here" \\
  -F "file=@document.jpg"`}</pre>
			</div>

			<h3 class="mb-2 mt-6 font-semibold">JavaScript / Node.js</h3>
			<div class="overflow-x-auto rounded-lg bg-zinc-900 p-4">
				<pre class="text-sm text-zinc-100">{`const formData = new FormData();
formData.append('file', fs.createReadStream('document.jpg'));

const response = await fetch('https://itsocr.com/api/v1/ocr', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer itsocr_your_token_here'
  },
  body: formData
});

const result = await response.json();
console.log(result.text);`}</pre>
			</div>

			<h3 class="mb-2 mt-6 font-semibold">Python</h3>
			<div class="overflow-x-auto rounded-lg bg-zinc-900 p-4">
				<pre class="text-sm text-zinc-100">{`import requests

with open('document.jpg', 'rb') as f:
    response = requests.post(
        'https://itsocr.com/api/v1/ocr',
        headers={'Authorization': 'Bearer itsocr_your_token_here'},
        files={'file': f}
    )

result = response.json()
print(result['text'])`}</pre>
			</div>
		</section>

		<!-- Error Responses -->
		<section class="mb-12">
			<h2 class="mb-4 text-2xl font-semibold">Error Responses</h2>

			<div class="overflow-x-auto rounded-lg bg-muted p-4">
				<table class="w-full text-sm">
					<thead>
						<tr class="border-b">
							<th class="pb-2 text-left">Status Code</th>
							<th class="pb-2 text-left">Description</th>
						</tr>
					</thead>
					<tbody>
						<tr class="border-b">
							<td class="py-2 font-mono">400</td>
							<td class="py-2">Bad request (missing file, invalid format, etc.)</td>
						</tr>
						<tr class="border-b">
							<td class="py-2 font-mono">401</td>
							<td class="py-2">Invalid or missing API token</td>
						</tr>
						<tr class="border-b">
							<td class="py-2 font-mono">429</td>
							<td class="py-2">Rate limit exceeded (monthly quota reached)</td>
						</tr>
						<tr>
							<td class="py-2 font-mono">500</td>
							<td class="py-2">Server error</td>
						</tr>
					</tbody>
				</table>
			</div>

			<div class="mt-4 overflow-x-auto rounded-lg bg-zinc-900 p-4">
				<pre class="text-sm text-zinc-100">{`{
  "success": false,
  "error": "Error message describing what went wrong"
}`}</pre>
			</div>
		</section>

		<!-- Rate Limits -->
		<section class="mb-12">
			<h2 class="mb-4 text-2xl font-semibold">Rate Limits</h2>
			<p class="mb-4 text-muted-foreground">
				API usage is subject to your plan's monthly limits. Check your current usage in the
				<a href="/dashboard" class="text-primary underline">Dashboard</a>.
			</p>

			<div class="overflow-x-auto rounded-lg bg-muted p-4">
				<table class="w-full text-sm">
					<thead>
						<tr class="border-b">
							<th class="pb-2 text-left">Plan</th>
							<th class="pb-2 text-left">Images/Month</th>
							<th class="pb-2 text-left">Max File Size</th>
						</tr>
					</thead>
					<tbody>
						<tr class="border-b">
							<td class="py-2">Free</td>
							<td class="py-2">10</td>
							<td class="py-2">5 MB</td>
						</tr>
						<tr class="border-b">
							<td class="py-2">Pro</td>
							<td class="py-2">500</td>
							<td class="py-2">20 MB</td>
						</tr>
						<tr>
							<td class="py-2">Enterprise</td>
							<td class="py-2">Unlimited</td>
							<td class="py-2">50 MB</td>
						</tr>
					</tbody>
				</table>
			</div>
		</section>

		<!-- Support -->
		<section>
			<h2 class="mb-4 text-2xl font-semibold">Need Help?</h2>
			<p class="text-muted-foreground">
				If you have questions or need assistance, please contact us at
				<a href="mailto:support@itsocr.com" class="text-primary underline">support@itsocr.com</a>.
			</p>
		</section>
	</main>
</div>
