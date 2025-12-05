// Default OCR prompt for text extraction (hardcoded, not saved to DB)
export const DEFAULT_OCR_PROMPT = `Extract all text from this image exactly as it appears. Preserve the original formatting and line breaks. Only output the text, nothing else.`;

// Model configuration
export const OCR_MODEL = 'minicpm-v';
export const OCR_MAX_TOKENS = 4096;

/**
 * Build the full prompt by combining default prompt with user's custom prompt
 */
export function buildPrompt(customPrompt?: string | null): string {
	if (!customPrompt?.trim()) {
		return DEFAULT_OCR_PROMPT;
	}
	return `${DEFAULT_OCR_PROMPT}\n\nAdditional instructions: ${customPrompt.trim()}`;
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
				options: {
					temperature: 0,
					num_predict: OCR_MAX_TOKENS
				}
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
