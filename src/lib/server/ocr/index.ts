// Model configuration
export const OCR_MODEL = 'llama3.2-vision:latest';
export const OCR_MAX_TOKENS = 16384;
export const OCR_CONTEXT_SIZE = 16384;

// Parallel processing configuration for PDFs
export const PDF_PARALLEL_PAGES = 4; // Process 4 pages at a time on A5000

// Ollama options optimized for OCR accuracy and preventing repetition/commentary
export const OCR_OPTIONS = {
	temperature: 0, // Deterministic output for accuracy
	num_predict: 8192, // Hard cap - enough for most documents (~6k words)
	num_ctx: OCR_CONTEXT_SIZE,
	num_gpu: 999,
	main_gpu: 0,
	num_thread: 8,
	repeat_penalty: 1.8, // Stronger penalty to stop repetition loops
	repeat_last_n: 512, // Longer lookback to catch repetitive patterns
	top_k: 5, // Tighter token selection for deterministic OCR
	top_p: 0.5 // Much tighter sampling to prevent hallucinations/commentary
};

/**
 * Build the OCR prompt based on whether custom instructions are provided
 */
export function buildPrompt(customPrompt?: string | null): string {
	const custom = customPrompt?.trim();

	// Strict prompt to prevent model commentary and repetition
	const basePrompt = `OCR task: Extract all visible text from this image verbatim. Rules: Output ONLY the extracted text. Do NOT add commentary, explanations, notes, or observations. Do NOT repeat content. Stop when all text is extracted.`;

	if (!custom) {
		return basePrompt;
	}

	// Custom prompt is appended to base prompt
	return `${basePrompt}

Additional instructions: ${custom}`;
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
