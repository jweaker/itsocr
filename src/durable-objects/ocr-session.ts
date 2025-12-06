/// <reference types="@cloudflare/workers-types" />

/**
 * OCR Session Durable Object
 *
 * Manages WebSocket connections for real-time OCR streaming.
 * Each image processing session gets its own DO instance.
 */

import { createClient } from '@libsql/client/web';

interface Env {
	DATABASE_URL: string;
	DATABASE_AUTH_TOKEN: string;
	R2_BUCKET: R2Bucket;
	DASHBOARD_SESSIONS: DurableObjectNamespace;
}

interface ProcessRequest {
	imageId: string;
	userId: string;
	imageKey: string;
	prompt: string;
	isPdf?: boolean;
	pageCount?: number;
	pageImages?: string[] | null;
}

// Message types for WebSocket communication
type WSMessage =
	| { type: 'connected' }
	| { type: 'status'; status: 'processing' | 'completed' | 'failed' | 'cancelled' }
	| { type: 'chunk'; text: string }
	| { type: 'page-start'; pageNumber: number; totalPages: number }
	| { type: 'page-complete'; pageNumber: number; totalPages: number; text: string }
	| { type: 'complete'; text: string; processingTimeMs: number }
	| { type: 'error'; message: string }
	| { type: 'cancelled' }
	| { type: 'reconnected'; text: string; status: string };

export class OCRSession implements DurableObject {
	private state: DurableObjectState;
	private env: Env;
	private db: ReturnType<typeof createClient> | null = null;

	// Session state
	private imageId: string | null = null;
	private userId: string | null = null;
	private isProcessing = false;
	private isCancelled = false;
	private extractedText = '';
	private status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled' = 'pending';
	private processingTimeMs = 0;
	private abortController: AbortController | null = null;

	constructor(state: DurableObjectState, env: Env) {
		this.state = state;
		this.env = env;
	}

	private getDb() {
		if (!this.db) {
			this.db = createClient({
				url: this.env.DATABASE_URL,
				authToken: this.env.DATABASE_AUTH_TOKEN
			});
		}
		return this.db;
	}

	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);

		if (url.pathname === '/websocket') {
			return this.handleWebSocket(request);
		}

		if (url.pathname === '/process') {
			return this.handleProcess(request);
		}

		if (url.pathname === '/cancel') {
			return this.handleCancel(request);
		}

		if (url.pathname === '/reset') {
			return this.handleReset();
		}

		if (url.pathname === '/status') {
			return this.handleStatus();
		}

		return new Response('Not found', { status: 404 });
	}

	private async handleWebSocket(request: Request): Promise<Response> {
		// Check for WebSocket upgrade
		const upgradeHeader = request.headers.get('Upgrade');
		if (upgradeHeader !== 'websocket') {
			return new Response('Expected WebSocket upgrade', { status: 426 });
		}

		const pair = new WebSocketPair();
		const [client, server] = Object.values(pair);

		// Accept the WebSocket using Hibernation API
		this.state.acceptWebSocket(server);

		// Send initial state if reconnecting to an active session
		if (this.imageId) {
			const message: WSMessage =
				this.status === 'processing'
					? { type: 'reconnected', text: this.extractedText, status: 'processing' }
					: this.status === 'completed'
						? { type: 'reconnected', text: this.extractedText, status: 'completed' }
						: { type: 'connected' };
			server.send(JSON.stringify(message));
		} else {
			server.send(JSON.stringify({ type: 'connected' } as WSMessage));
		}

		return new Response(null, { status: 101, webSocket: client });
	}

	private async handleProcess(request: Request): Promise<Response> {
		console.log('[OCRSession] handleProcess called, isProcessing:', this.isProcessing);

		if (this.isProcessing) {
			console.log('[OCRSession] Already processing, rejecting');
			return new Response(JSON.stringify({ error: 'Already processing' }), {
				status: 409,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		try {
			const body = (await request.json()) as ProcessRequest;
			console.log('[OCRSession] Starting process for image:', body.imageId);

			this.imageId = body.imageId;
			this.userId = body.userId;
			this.isProcessing = true;
			this.isCancelled = false;
			this.status = 'processing';
			this.extractedText = '';
			this.abortController = new AbortController();

			// Start processing in the background
			// Use waitUntil to ensure the DO stays alive
			this.state.waitUntil(this.processOCR(body));

			return new Response(JSON.stringify({ success: true, status: 'processing' }), {
				headers: { 'Content-Type': 'application/json' }
			});
		} catch (error) {
			console.error('[OCRSession] handleProcess error:', error);
			return new Response(JSON.stringify({ error: 'Invalid request body' }), {
				status: 400,
				headers: { 'Content-Type': 'application/json' }
			});
		}
	}

	private async handleCancel(request: Request): Promise<Response> {
		if (!this.isProcessing) {
			return new Response(JSON.stringify({ error: 'Not processing' }), {
				status: 400,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		try {
			const body = (await request.json()) as { userId: string };

			// Abort the ongoing request
			this.isCancelled = true;
			if (this.abortController) {
				this.abortController.abort();
			}

			this.status = 'cancelled';
			this.isProcessing = false;

			const db = this.getDb();
			await db.execute({
				sql: 'UPDATE scanned_image SET status = ?, extracted_text = ?, updated_at = ? WHERE id = ?',
				args: ['cancelled', this.extractedText.trim() || null, Date.now(), this.imageId]
			});

			// Broadcast cancellation
			this.broadcast({ type: 'cancelled' });

			// Notify dashboard
			if (this.imageId) {
				await this.notifyDashboard(body.userId, this.imageId, 'cancelled', this.extractedText);
			}

			return new Response(JSON.stringify({ success: true, status: 'cancelled' }), {
				headers: { 'Content-Type': 'application/json' }
			});
		} catch (error) {
			return new Response(JSON.stringify({ error: 'Failed to cancel' }), {
				status: 500,
				headers: { 'Content-Type': 'application/json' }
			});
		}
	}

	private async handleReset(): Promise<Response> {
		// Reset session state for a new processing attempt
		this.isProcessing = false;
		this.isCancelled = false;
		this.extractedText = '';
		this.status = 'pending';
		this.processingTimeMs = 0;
		this.abortController = null;

		return new Response(JSON.stringify({ success: true }), {
			headers: { 'Content-Type': 'application/json' }
		});
	}

	private async handleStatus(): Promise<Response> {
		return new Response(
			JSON.stringify({
				imageId: this.imageId,
				status: this.status,
				isProcessing: this.isProcessing,
				textLength: this.extractedText.length,
				processingTimeMs: this.processingTimeMs
			}),
			{ headers: { 'Content-Type': 'application/json' } }
		);
	}

	private broadcast(message: WSMessage) {
		const json = JSON.stringify(message);
		const websockets = this.state.getWebSockets();
		for (const ws of websockets) {
			try {
				ws.send(json);
			} catch {
				// WebSocket might be closed
			}
		}
	}

	private async notifyDashboard(userId: string, imageId: string, status: string, text: string) {
		try {
			const dashboardId = this.env.DASHBOARD_SESSIONS.idFromName(userId);
			const dashboardStub = this.env.DASHBOARD_SESSIONS.get(dashboardId);

			await dashboardStub.fetch(
				new Request('https://do/image-update', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ imageId, status, extractedText: text })
				})
			);
		} catch (error) {
			console.error('[OCRSession] Failed to notify dashboard:', error);
		}
	}

	private async processOCR(job: ProcessRequest): Promise<void> {
		const startTime = Date.now();
		const db = this.getDb();
		const PAGE_DELIMITER = '\n\n---PAGE_BREAK---\n\n';

		console.log('[OCRSession] Starting OCR for image:', job.imageId, 'isPdf:', job.isPdf);

		try {
			// Check if cancelled before starting
			if (this.isCancelled) {
				console.log('[OCRSession] Processing cancelled before start');
				return;
			}

			// Update status to processing
			await db.execute({
				sql: 'UPDATE scanned_image SET status = ?, updated_at = ? WHERE id = ?',
				args: ['processing', Date.now(), job.imageId]
			});

			this.broadcast({ type: 'status', status: 'processing' });
			await this.notifyDashboard(job.userId, job.imageId, 'processing', '');

			// Determine which images to process
			const imagesToProcess: string[] = [];
			if (job.isPdf && job.pageImages && job.pageImages.length > 0) {
				// For PDFs, process each page image
				imagesToProcess.push(...job.pageImages);
			} else {
				// For regular images, process the single image
				imagesToProcess.push(job.imageKey);
			}

			const totalPages = imagesToProcess.length;
			const pageTexts: string[] = [];

			// Process each page sequentially
			for (let pageIndex = 0; pageIndex < totalPages; pageIndex++) {
				const imageKey = imagesToProcess[pageIndex];
				const pageNumber = pageIndex + 1;

				// Check for cancellation
				if (this.isCancelled) {
					console.log('[OCRSession] Processing cancelled before page', pageNumber);
					return;
				}

				// Broadcast page start for multi-page documents
				if (totalPages > 1) {
					this.broadcast({ type: 'page-start', pageNumber, totalPages });
				}

				console.log(`[OCRSession] Processing page ${pageNumber}/${totalPages}: ${imageKey}`);

				// Process this page
				const pageText = await this.processPage(imageKey, job.prompt);
				pageTexts.push(pageText);

				// Broadcast page completion for multi-page documents
				if (totalPages > 1) {
					this.broadcast({ type: 'page-complete', pageNumber, totalPages, text: pageText });
				}

				// Update extractedText with concatenated text so far
				this.extractedText = pageTexts.join(PAGE_DELIMITER);
			}

			// If cancelled during processing, don't complete
			if (this.isCancelled) {
				console.log('[OCRSession] Processing was cancelled, not completing');
				return;
			}

			// Complete successfully
			this.processingTimeMs = Date.now() - startTime;
			this.status = 'completed';
			this.isProcessing = false;

			// Final text is all pages joined with delimiter
			const finalText = pageTexts.join(PAGE_DELIMITER);

			// Save to database
			await db.execute({
				sql: 'UPDATE scanned_image SET status = ?, extracted_text = ?, processing_time_ms = ?, updated_at = ? WHERE id = ?',
				args: ['completed', finalText, this.processingTimeMs, Date.now(), job.imageId]
			});

			console.log(
				'[OCRSession] Completed.',
				'Pages:',
				totalPages,
				'Text length:',
				finalText.length,
				'Time:',
				this.processingTimeMs,
				'ms'
			);

			// Broadcast completion
			this.broadcast({
				type: 'complete',
				text: finalText,
				processingTimeMs: this.processingTimeMs
			});

			// Notify dashboard
			await this.notifyDashboard(job.userId, job.imageId, 'completed', finalText);
		} catch (error) {
			this.processingTimeMs = Date.now() - startTime;
			this.status = 'failed';
			this.isProcessing = false;

			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			console.error('[OCRSession] OCR failed:', errorMessage);

			// Save error to database
			try {
				await db.execute({
					sql: 'UPDATE scanned_image SET status = ?, error_message = ?, processing_time_ms = ?, updated_at = ? WHERE id = ?',
					args: [
						'failed',
						errorMessage.substring(0, 1000),
						this.processingTimeMs,
						Date.now(),
						job.imageId
					]
				});
			} catch (dbError) {
				console.error('[OCRSession] Failed to update DB with error:', dbError);
			}

			// Broadcast error
			this.broadcast({ type: 'error', message: errorMessage });

			// Notify dashboard
			await this.notifyDashboard(job.userId, job.imageId, 'failed', '');
		}
	}

	/**
	 * Process a single page/image and return the extracted text
	 */
	private async processPage(imageKey: string, prompt: string): Promise<string> {
		// Get image from R2
		console.log('[OCRSession] Fetching image from R2:', imageKey);
		const object = await this.env.R2_BUCKET.get(imageKey);
		if (!object) {
			throw new Error('Image not found in R2: ' + imageKey);
		}

		// Get image bytes and check if resizing is needed
		let imageBytes = new Uint8Array(await object.arrayBuffer());
		const contentType = object.httpMetadata?.contentType || 'image/jpeg';

		// Check image dimensions from custom metadata (stored during upload)
		const originalWidth = parseInt(object.customMetadata?.width || '0', 10);
		const originalHeight = parseInt(object.customMetadata?.height || '0', 10);
		const MAX_DIMENSION = 1024;

		// If image is too large, resize it
		if (originalWidth > MAX_DIMENSION || originalHeight > MAX_DIMENSION) {
			console.log(`[OCRSession] Image too large (${originalWidth}x${originalHeight}), resizing...`);
			try {
				imageBytes = await this.resizeImage(
					imageBytes,
					contentType,
					originalWidth,
					originalHeight,
					MAX_DIMENSION
				);
				console.log(`[OCRSession] Image resized, new size: ${imageBytes.length} bytes`);
			} catch (resizeError) {
				console.warn('[OCRSession] Failed to resize image, using original:', resizeError);
			}
		} else if (imageBytes.length > 5 * 1024 * 1024) {
			// If no dimensions but file is > 5MB, try to resize anyway
			console.log(
				`[OCRSession] Image file large (${imageBytes.length} bytes), attempting resize...`
			);
			try {
				imageBytes = await this.resizeImage(imageBytes, contentType, 0, 0, MAX_DIMENSION);
				console.log(`[OCRSession] Image resized, new size: ${imageBytes.length} bytes`);
			} catch (resizeError) {
				console.warn('[OCRSession] Failed to resize image, using original:', resizeError);
			}
		}

		// Convert to base64 using optimized approach
		const bytes = imageBytes;
		const chunkSize = 32768;
		let binary = '';
		for (let i = 0; i < bytes.length; i += chunkSize) {
			const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
			binary += String.fromCharCode(...chunk);
		}
		const imageBase64 = btoa(binary);

		console.log('[OCRSession] Image converted to base64, length:', imageBase64.length);

		// Check if cancelled
		if (this.isCancelled) {
			throw new Error('Processing cancelled');
		}

		// Call Ollama with streaming - using llama3.2-vision for OCR
		const OLLAMA_ENDPOINT = 'https://ollama.itsocr.com';
		const timeoutId = setTimeout(() => this.abortController?.abort(), 300000); // 5 min timeout

		let response: Response;
		try {
			response = await fetch(OLLAMA_ENDPOINT + '/api/generate', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					model: 'llama3.2-vision:latest',
					prompt: prompt,
					images: [imageBase64],
					stream: true,
					options: {
						temperature: 0,
						num_predict: 8192, // Enough for full page of text
						num_ctx: 8192, // Larger context for better document understanding
						num_gpu: 999, // Offload all layers to GPU (Metal on M2)
						main_gpu: 0
					},
					keep_alive: '30m' // Keep model loaded for 30 minutes
				}),
				signal: this.abortController?.signal
			});
		} finally {
			clearTimeout(timeoutId);
		}

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error('Ollama API error: ' + response.status + ' - ' + errorText);
		}

		// Stream the response
		const reader = response.body?.getReader();
		if (!reader) {
			throw new Error('No response body from Ollama');
		}

		const decoder = new TextDecoder();
		let buffer = '';
		let pageText = '';

		try {
			while (true) {
				// Check for cancellation during streaming
				if (this.isCancelled) {
					console.log('[OCRSession] Processing cancelled during streaming');
					throw new Error('Processing cancelled');
				}

				const { done, value } = await reader.read();
				if (done) break;

				buffer += decoder.decode(value, { stream: true });
				const lines = buffer.split('\n');
				buffer = lines.pop() || '';

				for (const line of lines) {
					const trimmedLine = line.trim();
					if (!trimmedLine) continue;

					try {
						const chunk = JSON.parse(trimmedLine) as { response?: string; done?: boolean };
						if (chunk.response) {
							pageText += chunk.response;

							// Broadcast chunk to all connected WebSockets
							this.broadcast({ type: 'chunk', text: chunk.response });
						}
					} catch {
						// Skip unparseable lines
					}
				}
			}
		} finally {
			reader.releaseLock();
		}

		// Process remaining buffer (no post-processing, just get the last chunk)
		if (buffer.trim()) {
			try {
				const chunk = JSON.parse(buffer.trim()) as { response?: string };
				if (chunk.response) {
					pageText += chunk.response;
					this.broadcast({ type: 'chunk', text: chunk.response });
				}
			} catch {
				// Ignore
			}
		}

		return pageText.trim();
	}

	/**
	 * Log image size info for debugging
	 * Note: Workers don't have native image resizing capability.
	 * For production, consider:
	 * 1. Resize on upload (client-side or via Cloudflare Images)
	 * 2. Use Cloudflare Image Resizing with public URLs
	 * 3. Use a WASM-based image library
	 */
	private async resizeImage(
		imageBytes: Uint8Array<ArrayBuffer>,
		_contentType: string,
		width: number,
		height: number,
		maxDimension: number
	): Promise<Uint8Array<ArrayBuffer>> {
		// Log what we would resize to
		if (width > 0 && height > 0) {
			const scale = maxDimension / Math.max(width, height);
			const newWidth = Math.round(width * scale);
			const newHeight = Math.round(height * scale);
			console.log(
				`[OCRSession] Image resize would be: ${width}x${height} -> ${newWidth}x${newHeight}`
			);
		}

		// Workers don't have native image processing capability
		// Return original bytes - the model can handle large images, just slower
		console.log(
			`[OCRSession] Using original image (${(imageBytes.length / 1024 / 1024).toFixed(2)}MB)`
		);
		return imageBytes;
	}

	// WebSocket event handlers for Hibernation API
	async webSocketMessage(_ws: WebSocket, _message: string | ArrayBuffer) {
		// Handle incoming messages from clients (if needed)
		// Currently we only send messages, not receive
	}

	async webSocketClose(_ws: WebSocket, _code: number, _reason: string, _wasClean: boolean) {
		// Clean up when WebSocket closes
		console.log('[OCRSession] WebSocket closed');
	}

	async webSocketError(_ws: WebSocket, error: unknown) {
		console.error('[OCRSession] WebSocket error:', error);
	}
}
