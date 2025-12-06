/**
 * Public API endpoint for OCR processing
 *
 * POST /api/v1/ocr
 * Authorization: Bearer <api_token>
 * Content-Type: multipart/form-data
 *
 * Body:
 * - file: The image file to process (required)
 * - prompt: Custom prompt for OCR (optional)
 */

import type { RequestHandler } from '@sveltejs/kit';
import { validateApiToken, apiError, apiSuccess } from '$lib/server/auth/api-token';
import { db } from '$lib/server/db';
import { scannedImage, getPlan } from '$lib/server/db/schema';
import { generateId } from '$lib/server/utils';
import { buildPrompt, OCR_MODEL, OCR_OPTIONS } from '$lib/server/ocr';
import { checkAndIncrementUsage } from '$lib/server/services/usage';

// Maximum file size (50MB)
const MAX_FILE_SIZE = 50 * 1024 * 1024;

// Allowed MIME types
const ALLOWED_MIME_TYPES = [
	'image/jpeg',
	'image/png',
	'image/gif',
	'image/webp',
	'image/heic',
	'image/heif',
	'image/tiff',
	'image/bmp'
];

// Ollama endpoint
const OLLAMA_ENDPOINT = 'https://ollama.itsocr.com';

export const POST: RequestHandler = async ({ request, platform }) => {
	// Validate API token
	const authHeader = request.headers.get('Authorization');
	const authResult = await validateApiToken(authHeader);

	if (!authResult.success || !authResult.user) {
		return apiError(authResult.error || 'Unauthorized', authResult.statusCode || 401);
	}

	const user = authResult.user;

	// Check usage limits
	const plan = getPlan(user.planId);
	const usageCheck = await checkAndIncrementUsage(user.id, 0); // Check only, don't increment yet

	if (!usageCheck.allowed) {
		return apiError(
			`Monthly limit reached. You have used ${usageCheck.currentUsage} of ${usageCheck.limit} images this month.`,
			429
		);
	}

	// Parse multipart form data
	let formData: FormData;
	try {
		formData = await request.formData();
	} catch {
		return apiError('Invalid request body. Expected multipart/form-data.', 400);
	}

	const file = formData.get('file');
	const customPrompt = formData.get('prompt');

	if (!file || !(file instanceof File)) {
		return apiError('Missing required field: file', 400);
	}

	// Validate file type
	if (!ALLOWED_MIME_TYPES.includes(file.type)) {
		return apiError(
			`Unsupported file type: ${file.type}. Allowed types: ${ALLOWED_MIME_TYPES.join(', ')}`,
			400
		);
	}

	// Validate file size
	if (file.size > MAX_FILE_SIZE) {
		return apiError(`File too large. Maximum size: ${MAX_FILE_SIZE / 1024 / 1024}MB`, 400);
	}

	// Check plan-specific file size limit
	const planMaxSize = plan.maxImageSizeMb * 1024 * 1024;
	if (file.size > planMaxSize) {
		return apiError(`File too large for your plan. Maximum size: ${plan.maxImageSizeMb}MB`, 400);
	}

	try {
		// Convert file to base64
		const arrayBuffer = await file.arrayBuffer();
		const bytes = new Uint8Array(arrayBuffer);
		const chunkSize = 32768;
		let binary = '';
		for (let i = 0; i < bytes.length; i += chunkSize) {
			const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
			binary += String.fromCharCode(...chunk);
		}
		const imageBase64 = btoa(binary);

		// Build prompt
		const prompt = buildPrompt(typeof customPrompt === 'string' ? customPrompt : null);

		// Call Ollama for OCR
		const startTime = Date.now();
		const response = await fetch(OLLAMA_ENDPOINT + '/api/generate', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				model: OCR_MODEL,
				prompt: prompt,
				images: [imageBase64],
				stream: false,
				options: OCR_OPTIONS,
				keep_alive: '30m'
			})
		});

		if (!response.ok) {
			const errorText = await response.text();
			console.error('[API OCR] Ollama error:', errorText);
			return apiError('OCR processing failed. Please try again.', 500);
		}

		const data = (await response.json()) as { response: string };
		const processingTimeMs = Date.now() - startTime;
		const extractedText = (data.response || '').trim();

		// Increment usage
		await checkAndIncrementUsage(user.id, file.size);

		// Optionally store in database if R2 is available
		const imageId = generateId();
		const now = new Date();

		if (platform?.env?.R2_BUCKET) {
			// Store image in R2
			const imageKey = `api/${user.id}/${imageId}.${file.name.split('.').pop() || 'jpg'}`;
			await platform.env.R2_BUCKET.put(imageKey, arrayBuffer, {
				httpMetadata: { contentType: file.type }
			});

			// Store record in database
			await db.insert(scannedImage).values({
				id: imageId,
				userId: user.id,
				fileName: file.name,
				imageKey,
				originalUrl: `/api/images/${imageKey}`,
				mimeType: file.type,
				fileSizeBytes: file.size,
				extractedText,
				processingTimeMs,
				status: 'completed',
				createdAt: now,
				updatedAt: now
			});
		}

		return apiSuccess({
			id: imageId,
			text: extractedText,
			processingTimeMs,
			fileName: file.name,
			fileSize: file.size,
			mimeType: file.type
		});
	} catch (error) {
		console.error('[API OCR] Error:', error);
		return apiError('An unexpected error occurred', 500);
	}
};

// Handle OPTIONS for CORS preflight
export const OPTIONS: RequestHandler = async () => {
	return new Response(null, {
		status: 204,
		headers: {
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'POST, OPTIONS',
			'Access-Control-Allow-Headers': 'Authorization, Content-Type',
			'Access-Control-Max-Age': '86400'
		}
	});
};
