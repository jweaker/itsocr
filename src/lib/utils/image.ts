/**
 * Image utilities for client-side processing
 */

/**
 * Maximum dimension for image resizing before upload
 */
export const MAX_IMAGE_DIMENSION = 1920;

/**
 * Maximum file size for upload (50MB)
 */
export const MAX_FILE_SIZE = 50 * 1024 * 1024;

/**
 * Allowed MIME types for upload
 */
export const ALLOWED_MIME_TYPES = [
	'image/jpeg',
	'image/png',
	'image/gif',
	'image/webp',
	'image/heic',
	'image/heif',
	'image/tiff',
	'image/bmp'
] as const;

export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

/**
 * Check if a MIME type is allowed
 */
export function isAllowedMimeType(mimeType: string): mimeType is AllowedMimeType {
	return ALLOWED_MIME_TYPES.includes(mimeType as AllowedMimeType);
}

/**
 * Resize an image to fit within max dimensions while maintaining aspect ratio
 * Returns a Blob with the resized image
 */
export async function resizeImage(
	file: File,
	maxDimension: number = MAX_IMAGE_DIMENSION,
	quality: number = 0.85
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
