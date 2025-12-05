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
}

// Message types for WebSocket communication
type WSMessage =
	| { type: 'connected' }
	| { type: 'status'; status: 'processing' | 'completed' | 'failed' | 'cancelled' }
	| { type: 'chunk'; text: string }
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
		if (this.isProcessing) {
			return new Response(JSON.stringify({ error: 'Already processing' }), {
				status: 409,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		try {
			const body = (await request.json()) as ProcessRequest;
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

		console.log('[OCRSession] Starting OCR for image:', job.imageId);

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

			// Get image from R2
			console.log('[OCRSession] Fetching image from R2:', job.imageKey);
			const object = await this.env.R2_BUCKET.get(job.imageKey);
			if (!object) {
				throw new Error('Image not found in R2: ' + job.imageKey);
			}

			// Get image bytes and check if resizing is needed
			let imageBytes = new Uint8Array(await object.arrayBuffer());
			const contentType = object.httpMetadata?.contentType || 'image/jpeg';

			// Check image dimensions from custom metadata (stored during upload)
			const originalWidth = parseInt(object.customMetadata?.width || '0', 10);
			const originalHeight = parseInt(object.customMetadata?.height || '0', 10);
			const MAX_DIMENSION = 1500;

			// If image is too large, resize it
			if (originalWidth > MAX_DIMENSION || originalHeight > MAX_DIMENSION) {
				console.log(
					`[OCRSession] Image too large (${originalWidth}x${originalHeight}), resizing...`
				);
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
					// Continue with original image if resize fails
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
			// Use chunks to avoid call stack issues with large images
			const chunkSize = 32768;
			let binary = '';
			for (let i = 0; i < bytes.length; i += chunkSize) {
				const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
				binary += String.fromCharCode(...chunk);
			}
			const imageBase64 = btoa(binary);

			console.log('[OCRSession] Image converted to base64, length:', imageBase64.length);

			// Check if cancelled after image fetch
			if (this.isCancelled) {
				console.log('[OCRSession] Processing cancelled after image fetch');
				return;
			}

			// Call Ollama with streaming - use instance abort controller
			const OLLAMA_ENDPOINT = 'https://ollama.itsocr.com';
			const timeoutId = setTimeout(() => this.abortController?.abort(), 300000); // 5 min timeout

			let response: Response;
			try {
				response = await fetch(OLLAMA_ENDPOINT + '/api/generate', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						model: 'minicpm-v',
						prompt: job.prompt,
						images: [imageBase64],
						stream: true,
						options: {
							temperature: 0,
							num_predict: 4096
						}
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
			let chunkCount = 0;
			let repetitionDetected = false;

			try {
				while (true) {
					// Check for cancellation during streaming
					if (this.isCancelled) {
						console.log('[OCRSession] Processing cancelled during streaming');
						break;
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
								this.extractedText += chunk.response;
								chunkCount++;

								// Broadcast chunk to all connected WebSockets
								this.broadcast({ type: 'chunk', text: chunk.response });
							}
						} catch {
							// Skip unparseable lines
						}
					}

					// Check for repetition every 10 chunks
					if (
						chunkCount % 10 === 0 &&
						chunkCount > 0 &&
						this.detectRepetition(this.extractedText)
					) {
						console.log('[OCRSession] Repetition detected, stopping stream');
						repetitionDetected = true;
						break;
					}
				}
			} finally {
				reader.releaseLock();
			}

			// If cancelled, don't proceed with completion
			if (this.isCancelled) {
				console.log('[OCRSession] Processing was cancelled, not completing');
				return;
			}

			// Trim repetition if detected
			if (repetitionDetected) {
				this.extractedText = this.trimRepetition(this.extractedText);
			}

			// Process remaining buffer
			if (!repetitionDetected && buffer.trim()) {
				try {
					const chunk = JSON.parse(buffer.trim()) as { response?: string };
					if (chunk.response) {
						this.extractedText += chunk.response;
						this.broadcast({ type: 'chunk', text: chunk.response });
					}
				} catch {
					// Ignore
				}
			}

			// Complete successfully
			this.processingTimeMs = Date.now() - startTime;
			this.status = 'completed';
			this.isProcessing = false;

			const finalText = this.extractedText.trim();

			// Save to database
			await db.execute({
				sql: 'UPDATE scanned_image SET status = ?, extracted_text = ?, processing_time_ms = ?, updated_at = ? WHERE id = ?',
				args: ['completed', finalText, this.processingTimeMs, Date.now(), job.imageId]
			});

			console.log(
				'[OCRSession] Completed. Chunks:',
				chunkCount,
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

	private detectRepetition(text: string): boolean {
		if (text.length < 50) return false;

		const tail = text.slice(-500);
		for (let len = 20; len <= 150; len++) {
			if (tail.length < len * 2) continue;

			const phrase = tail.slice(-len);
			const rest = tail.slice(0, -len);

			let count = 0;
			let pos = rest.indexOf(phrase);
			while (pos !== -1) {
				count++;
				pos = rest.indexOf(phrase, pos + 1);
			}

			if (count >= 2) {
				return true;
			}
		}
		return false;
	}

	private trimRepetition(text: string): string {
		let bestCutPoint = text.length;

		for (let len = 20; len <= 150; len++) {
			if (text.length < len * 2) continue;

			for (let start = 0; start < text.length - len * 2; start++) {
				const phrase = text.slice(start, start + len);
				const nextOccurrence = text.indexOf(phrase, start + len);

				if (nextOccurrence !== -1 && nextOccurrence < bestCutPoint) {
					bestCutPoint = nextOccurrence;
					break;
				}
			}

			if (bestCutPoint < text.length) break;
		}

		return bestCutPoint < text.length ? text.slice(0, bestCutPoint).trim() : text;
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
