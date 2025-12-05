/// <reference types="@cloudflare/workers-types" />

/**
 * Dashboard Sessions Durable Object
 *
 * Manages WebSocket connections for real-time dashboard updates.
 * Each user gets their own DO instance identified by their userId.
 * Efficiently closes connections when no images are processing.
 */

interface Env {
	DATABASE_URL: string;
	DATABASE_AUTH_TOKEN: string;
}

// Message types for dashboard WebSocket
type DashboardWSMessage =
	| { type: 'connected'; processingCount: number }
	| { type: 'image-update'; imageId: string; status: string; extractedText: string }
	| { type: 'no-processing' };

interface ImageUpdate {
	imageId: string;
	status: string;
	extractedText: string;
}

export class DashboardSessions implements DurableObject {
	private state: DurableObjectState;
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	private env: Env;

	// Track which images are currently processing
	private processingImages: Set<string> = new Set();

	constructor(state: DurableObjectState, env: Env) {
		this.state = state;
		this.env = env;
	}

	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);

		if (url.pathname === '/websocket') {
			return this.handleWebSocket(request);
		}

		if (url.pathname === '/image-update') {
			return this.handleImageUpdate(request);
		}

		if (url.pathname === '/register-processing') {
			return this.handleRegisterProcessing(request);
		}

		if (url.pathname === '/status') {
			return this.handleStatus();
		}

		return new Response('Not found', { status: 404 });
	}

	private async handleWebSocket(request: Request): Promise<Response> {
		const upgradeHeader = request.headers.get('Upgrade');
		if (upgradeHeader !== 'websocket') {
			return new Response('Expected WebSocket upgrade', { status: 426 });
		}

		const pair = new WebSocketPair();
		const [client, server] = Object.values(pair);

		this.state.acceptWebSocket(server);

		// Send initial state
		const message: DashboardWSMessage = {
			type: 'connected',
			processingCount: this.processingImages.size
		};
		server.send(JSON.stringify(message));

		return new Response(null, { status: 101, webSocket: client });
	}

	private async handleImageUpdate(request: Request): Promise<Response> {
		try {
			const update = (await request.json()) as ImageUpdate;

			// Update processing set
			if (update.status === 'processing') {
				this.processingImages.add(update.imageId);
			} else {
				this.processingImages.delete(update.imageId);
			}

			// Broadcast to all connected WebSockets
			const message: DashboardWSMessage = {
				type: 'image-update',
				imageId: update.imageId,
				status: update.status,
				extractedText: update.extractedText
			};

			this.broadcast(message);

			// If no more processing images, notify clients
			if (this.processingImages.size === 0) {
				this.broadcast({ type: 'no-processing' });
			}

			return new Response(JSON.stringify({ success: true }), {
				headers: { 'Content-Type': 'application/json' }
			});
		} catch {
			return new Response(JSON.stringify({ error: 'Invalid request' }), {
				status: 400,
				headers: { 'Content-Type': 'application/json' }
			});
		}
	}

	private async handleRegisterProcessing(request: Request): Promise<Response> {
		try {
			const { imageId, action } = (await request.json()) as {
				imageId: string;
				action: 'add' | 'remove';
			};

			if (action === 'add') {
				this.processingImages.add(imageId);
			} else {
				this.processingImages.delete(imageId);
			}

			return new Response(JSON.stringify({ success: true, count: this.processingImages.size }), {
				headers: { 'Content-Type': 'application/json' }
			});
		} catch {
			return new Response(JSON.stringify({ error: 'Invalid request' }), {
				status: 400,
				headers: { 'Content-Type': 'application/json' }
			});
		}
	}

	private async handleStatus(): Promise<Response> {
		const websockets = this.state.getWebSockets();
		return new Response(
			JSON.stringify({
				connectedClients: websockets.length,
				processingImages: Array.from(this.processingImages),
				processingCount: this.processingImages.size
			}),
			{ headers: { 'Content-Type': 'application/json' } }
		);
	}

	private broadcast(message: DashboardWSMessage) {
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

	// WebSocket event handlers for Hibernation API
	async webSocketMessage(_ws: WebSocket, _message: string | ArrayBuffer) {
		// Dashboard clients don't send messages, they only receive
	}

	async webSocketClose(_ws: WebSocket, _code: number, _reason: string, _wasClean: boolean) {
		// Clean up handled automatically by Hibernation API
	}

	async webSocketError(_ws: WebSocket, error: unknown) {
		console.error('[DashboardSessions] WebSocket error:', error);
	}
}
