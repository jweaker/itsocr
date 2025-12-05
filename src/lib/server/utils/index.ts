/**
 * Shared utility functions
 */

/**
 * Generate a unique ID using crypto.randomUUID
 */
export function generateId(): string {
	return crypto.randomUUID();
}

/**
 * Get current timestamp
 */
export function now(): Date {
	return new Date();
}

/**
 * Get the start and end dates for the current month period
 */
export function getMonthPeriod(date: Date = new Date()): { start: Date; end: Date } {
	const start = new Date(date.getFullYear(), date.getMonth(), 1);
	const end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
	return { start, end };
}

/**
 * Get file extension from filename
 */
export function getFileExtension(fileName: string): string {
	return fileName.split('.').pop() || 'jpg';
}
