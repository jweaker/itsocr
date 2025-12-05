/**
 * Post-build script to inject queue handler into the generated _worker.js
 *
 * The SvelteKit Cloudflare adapter generates a worker with only a `fetch` handler.
 * This script adds a `queue` handler for processing OCR jobs.
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const workerPath = join(__dirname, '../.svelte-kit/cloudflare/_worker.js');

// Read the generated worker
let workerCode = readFileSync(workerPath, 'utf-8');

// Queue handler code to inject
const queueHandlerCode = `
// ============================================================================
// Queue Handler for OCR Processing (injected by scripts/inject-queue-handler.js)
// ============================================================================

async function handleQueue(batch, env) {
  const { createClient } = await import('@libsql/client/web');
  const { drizzle } = await import('drizzle-orm/libsql');

  const client = createClient({
    url: env.DATABASE_URL,
    authToken: env.DATABASE_AUTH_TOKEN
  });
  const db = drizzle(client);

  for (const message of batch.messages) {
    const job = message.body;
    const startTime = Date.now();

    try {
      // Update status to processing
      await db.run({
        sql: 'UPDATE scanned_image SET status = ?, updated_at = ? WHERE id = ?',
        args: ['processing', Date.now(), job.imageId]
      });

      // Get image from R2
      const object = await env.R2_BUCKET.get(job.imageKey);
      if (!object) {
        throw new Error('Image not found in R2: ' + job.imageKey);
      }

      // Convert to base64 efficiently using Uint8Array
      const arrayBuffer = await object.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      
      // Use chunked approach for large images to avoid call stack issues
      const CHUNK_SIZE = 0x8000; // 32KB chunks
      let binary = '';
      for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
        const chunk = bytes.subarray(i, Math.min(i + CHUNK_SIZE, bytes.length));
        binary += String.fromCharCode.apply(null, chunk);
      }
      const imageBase64 = btoa(binary);

      // Process with Ollama (with timeout)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 min timeout
      
      let response;
      try {
        response = await fetch(env.OLLAMA_ENDPOINT + '/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'llava:latest',
            prompt: job.prompt,
            images: [imageBase64],
            stream: false
          }),
          signal: controller.signal
        });
      } finally {
        clearTimeout(timeoutId);
      }

      const processingTimeMs = Date.now() - startTime;

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error('Ollama API error: ' + response.status + ' - ' + errorText);
      }

      const data = await response.json();
      const extractedText = data.response?.trim() || '';

      // Update with successful result
      await db.run({
        sql: 'UPDATE scanned_image SET status = ?, extracted_text = ?, processing_time_ms = ?, updated_at = ? WHERE id = ?',
        args: ['completed', extractedText, processingTimeMs, Date.now(), job.imageId]
      });

      message.ack();
    } catch (error) {
      const processingTimeMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      console.error('OCR processing failed for image ' + job.imageId + ':', errorMessage);

      // Update status to failed with error details
      await db.run({
        sql: 'UPDATE scanned_image SET status = ?, error_message = ?, processing_time_ms = ?, updated_at = ? WHERE id = ?',
        args: ['failed', errorMessage.substring(0, 1000), processingTimeMs, Date.now(), job.imageId]
      });

      // Only retry for transient errors, not for permanent failures
      const isTransient = errorMessage.includes('timeout') || 
                          errorMessage.includes('network') ||
                          errorMessage.includes('ECONNREFUSED') ||
                          errorMessage.includes('503') ||
                          errorMessage.includes('429');
      
      if (isTransient) {
        message.retry();
      } else {
        message.ack(); // Don't retry permanent failures
      }
    }
  }
}
`;

// Find the export statement and modify it to include the queue handler
const exportMatch = workerCode.match(/export\s*\{\s*worker_default\s+as\s+default\s*\}\s*;?\s*$/);

if (!exportMatch) {
	console.error('Could not find export statement in worker');
	process.exit(1);
}

// Insert queue handler before the export and modify the default export
workerCode = workerCode.replace(
	/var\s+worker_default\s*=\s*\{/,
	queueHandlerCode + '\nvar worker_default = {\n  queue: handleQueue,'
);

// Write the modified worker
writeFileSync(workerPath, workerCode);

console.log('✓ Queue handler injected into _worker.js');
