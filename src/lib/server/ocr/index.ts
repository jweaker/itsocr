// Model configuration
export const OCR_MODEL = 'llama3.2-vision:latest';
export const OCR_MAX_TOKENS = 16384;
export const OCR_CONTEXT_SIZE = 16384;

// Parallel processing configuration for PDFs
export const PDF_PARALLEL_PAGES = 4; // Process 4 pages at a time on A5000

// Ollama options optimized for OCR accuracy and completeness
export const OCR_OPTIONS = {
	temperature: 0, // Deterministic output for accuracy
	num_predict: OCR_MAX_TOKENS,
	num_ctx: OCR_CONTEXT_SIZE,
	num_gpu: 999,
	main_gpu: 0,
	num_thread: 8,
	repeat_penalty: 1.1, // Light penalty to avoid repetition without stopping early
	repeat_last_n: 64, // Shorter lookback to avoid false repetition detection
	top_k: 40, // Wider token selection to avoid early stopping
	top_p: 0.9, // Less restrictive sampling
	stop: [] // No stop sequences - extract all text
};

/**
 * Build the OCR prompt based on whether custom instructions are provided
 */
export function buildPrompt(customPrompt?: string | null): string {
	const custom = customPrompt?.trim();

	if (!custom) {
		// Simple, direct prompt that encourages complete extraction
		return `Extract all text from this image exactly as written. Include every word, number, and symbol. Preserve paragraphs and formatting. Do not stop until all visible text has been extracted.`;
	}

	// Custom prompt mode
	return custom;
}

/**
 * Response from Ollama API
 */
interface OllamaResponse {
	model: string;
	created_at: string;
	response: string;
	done: boolean;
	total_duration?: number;
	load_duration?: number;
	prompt_eval_duration?: number;
	eval_duration?: number;
}

/**
 * OCR result from processing an image
 */
export interface OCRResult {
	text: string;
	processingTimeMs: number;
	success: boolean;
	error?: string;
}

/**
 * Process an image with Ollama vision model for OCR
 */
export async function processImageWithOllama(
	ollamaEndpoint: string,
	imageBase64: string,
	prompt: string
): Promise<OCRResult> {
	const startTime = Date.now();

	try {
		const response = await fetch(`${ollamaEndpoint}/api/generate`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
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
			return {
				text: '',
				processingTimeMs: Date.now() - startTime,
				success: false,
				error: `Ollama API error: ${response.status} - ${errorText}`
			};
		}

		const data = (await response.json()) as OllamaResponse;

		return {
			text: data.response.trim(),
			processingTimeMs: Date.now() - startTime,
			success: true
		};
	} catch (error) {
		return {
			text: '',
			processingTimeMs: Date.now() - startTime,
			success: false,
			error: error instanceof Error ? error.message : 'Unknown error occurred'
		};
	}
}

/**
 * Fetch image from R2 and convert to base64
 * R2Bucket type comes from @cloudflare/workers-types
 */
export async function getImageAsBase64(
	bucket: { get: (key: string) => Promise<{ arrayBuffer: () => Promise<ArrayBuffer> } | null> },
	imageKey: string
): Promise<string> {
	const object = await bucket.get(imageKey);

	if (!object) {
		throw new Error(`Image not found in R2: ${imageKey}`);
	}

	const arrayBuffer = await object.arrayBuffer();
	const uint8Array = new Uint8Array(arrayBuffer);

	// Convert to base64
	let binary = '';
	for (let i = 0; i < uint8Array.length; i++) {
		binary += String.fromCharCode(uint8Array[i]);
	}

	return btoa(binary);
}
