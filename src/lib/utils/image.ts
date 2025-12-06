/**
 * Image utilities for client-side processing
 */

/**
 * Maximum dimension for image resizing before upload
 * 1024px is optimal for OCR - fast processing while maintaining text readability
 */
export const MAX_IMAGE_DIMENSION = 1024;

/**
 * Maximum file size for upload (50MB)
 */
export const MAX_FILE_SIZE = 50 * 1024 * 1024;

/**
 * JPEG quality for resized images (higher = better text clarity for OCR)
 */
export const IMAGE_QUALITY = 0.9;

/**
 * Allowed image MIME types for upload
 */
export const ALLOWED_IMAGE_MIME_TYPES = [
	'image/jpeg',
	'image/png',
	'image/gif',
	'image/webp',
	'image/heic',
	'image/heif',
	'image/tiff',
	'image/bmp'
] as const;

/**
 * PDF MIME type
 */
export const PDF_MIME_TYPE = 'application/pdf' as const;

/**
 * All allowed MIME types (images + PDF)
 */
export const ALLOWED_MIME_TYPES = [...ALLOWED_IMAGE_MIME_TYPES, PDF_MIME_TYPE] as const;

export type AllowedImageMimeType = (typeof ALLOWED_IMAGE_MIME_TYPES)[number];
export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

/**
 * Check if a MIME type is an allowed image type
 */
export function isAllowedImageMimeType(mimeType: string): mimeType is AllowedImageMimeType {
	return ALLOWED_IMAGE_MIME_TYPES.includes(mimeType as AllowedImageMimeType);
}

/**
 * Check if a MIME type is allowed (image or PDF)
 */
export function isAllowedMimeType(mimeType: string): mimeType is AllowedMimeType {
	return ALLOWED_MIME_TYPES.includes(mimeType as AllowedMimeType);
}

/**
 * Check if a MIME type is PDF
 */
export function isPdfMimeType(mimeType: string): boolean {
	return mimeType === PDF_MIME_TYPE;
}

/**
 * Resize an image to fit within max dimensions while maintaining aspect ratio
 * Returns a Blob with the resized image
 */
export async function resizeImage(
	file: File,
	maxDimension: number = MAX_IMAGE_DIMENSION,
	quality: number = IMAGE_QUALITY
): Promise<{ blob: Blob; width: number; height: number }> {
	return new Promise((resolve, reject) => {
		const img = new Image();
		const url = URL.createObjectURL(file);

		img.onload = () => {
			URL.revokeObjectURL(url);

			let { width, height } = img;

			// Check if resizing is needed
			if (width <= maxDimension && height <= maxDimension) {
				// No resize needed, but still get dimensions
				file.arrayBuffer().then((buffer) => {
					resolve({
						blob: new Blob([buffer], { type: file.type }),
						width,
						height
					});
				});
				return;
			}

			// Calculate new dimensions
			if (width > height) {
				height = Math.round((height / width) * maxDimension);
				width = maxDimension;
			} else {
				width = Math.round((width / height) * maxDimension);
				height = maxDimension;
			}

			// Create canvas and resize
			const canvas = document.createElement('canvas');
			canvas.width = width;
			canvas.height = height;

			const ctx = canvas.getContext('2d');
			if (!ctx) {
				reject(new Error('Failed to get canvas context'));
				return;
			}

			// Use high-quality image smoothing
			ctx.imageSmoothingEnabled = true;
			ctx.imageSmoothingQuality = 'high';
			ctx.drawImage(img, 0, 0, width, height);

			// Determine output type - use JPEG for non-PNG to reduce size
			const outputType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';

			canvas.toBlob(
				(blob) => {
					if (blob) {
						resolve({ blob, width, height });
					} else {
						reject(new Error('Failed to create blob from canvas'));
					}
				},
				outputType,
				quality
			);
		};

		img.onerror = () => {
			URL.revokeObjectURL(url);
			reject(new Error('Failed to load image'));
		};

		img.src = url;
	});
}

/**
 * Get image dimensions from a File
 */
export async function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
	return new Promise((resolve, reject) => {
		const img = new Image();
		const url = URL.createObjectURL(file);

		img.onload = () => {
			URL.revokeObjectURL(url);
			resolve({ width: img.width, height: img.height });
		};

		img.onerror = () => {
			URL.revokeObjectURL(url);
			reject(new Error('Failed to load image'));
		};

		img.src = url;
	});
}

/**
 * Extract file from clipboard paste event
 */
export function getImageFromClipboard(event: ClipboardEvent): File | null {
	const items = event.clipboardData?.items;
	if (!items) return null;

	for (const item of items) {
		if (item.type.startsWith('image/')) {
			const file = item.getAsFile();
			if (file) return file;
		}
	}

	return null;
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Format date for display
 */
export function formatDate(date: Date | string | number): string {
	const d = new Date(date);
	return d.toLocaleDateString('en-US', {
		month: 'short',
		day: 'numeric',
		year: 'numeric'
	});
}

/**
 * Format date with time
 */
export function formatDateTime(date: Date | string | number): string {
	const d = new Date(date);
	return d.toLocaleDateString('en-US', {
		month: 'short',
		day: 'numeric',
		year: 'numeric',
		hour: '2-digit',
		minute: '2-digit'
	});
}

/**
 * PDF page extraction result
 */
export interface PdfPageResult {
	pageNumber: number;
	blob: Blob;
	width: number;
	height: number;
}

/**
 * Result from processing a PDF file
 */
export interface PdfProcessResult {
	pageCount: number;
	pages: PdfPageResult[];
}

/**
 * Extract pages from a PDF file as images
 * Uses pdf.js to render each page to a canvas
 *
 * @param file The PDF file to process
 * @param maxDimension Maximum dimension for the rendered page images
 * @param quality JPEG quality for the rendered images
 * @returns Array of page blobs with dimensions
 */
export async function extractPdfPages(
	file: File,
	maxDimension: number = MAX_IMAGE_DIMENSION,
	quality: number = IMAGE_QUALITY
): Promise<PdfProcessResult> {
	// Dynamically import pdf.js
	const pdfjsLib = await import('pdfjs-dist');

	// Configure the worker - use CDN for the worker script
	const pdfjsVersion = pdfjsLib.version;
	pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsVersion}/pdf.worker.min.mjs`;

	// Load the PDF document
	const arrayBuffer = await file.arrayBuffer();
	const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

	const pageCount = pdf.numPages;
	const pages: PdfPageResult[] = [];

	// Process each page sequentially
	for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
		const page = await pdf.getPage(pageNum);

		// Get the original viewport at scale 1
		const originalViewport = page.getViewport({ scale: 1 });

		// Calculate scale to fit within maxDimension
		const maxOriginalDimension = Math.max(originalViewport.width, originalViewport.height);
		const scale = maxOriginalDimension > maxDimension ? maxDimension / maxOriginalDimension : 1;

		// Create scaled viewport
		const viewport = page.getViewport({ scale });

		// Create canvas for rendering
		const canvas = document.createElement('canvas');
		canvas.width = Math.round(viewport.width);
		canvas.height = Math.round(viewport.height);

		const ctx = canvas.getContext('2d');
		if (!ctx) {
			throw new Error(`Failed to get canvas context for page ${pageNum}`);
		}

		// Render the page
		await page.render({
			canvasContext: ctx,
			viewport,
			canvas
		}).promise;

		// Convert canvas to blob
		const blob = await new Promise<Blob>((resolve, reject) => {
			canvas.toBlob(
				(b) => {
					if (b) {
						resolve(b);
					} else {
						reject(new Error(`Failed to create blob for page ${pageNum}`));
					}
				},
				'image/jpeg',
				quality
			);
		});

		pages.push({
			pageNumber: pageNum,
			blob,
			width: canvas.width,
			height: canvas.height
		});
	}

	return {
		pageCount,
		pages
	};
}
