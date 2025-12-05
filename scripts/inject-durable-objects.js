/**
 * Post-build script to inject Durable Objects into the generated _worker.js
 *
 * The SvelteKit Cloudflare adapter generates a worker with only a `fetch` handler.
 * This script bundles and exports the Durable Object classes so they can be used by Cloudflare.
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { build } from 'esbuild';

const __dirname = dirname(fileURLToPath(import.meta.url));
const workerPath = join(__dirname, '../.svelte-kit/cloudflare/_worker.js');
const durableObjectsDir = join(__dirname, '../src/durable-objects');

// Bundle both Durable Object classes
async function bundleDurableObjects() {
	// Bundle OCRSession
	const ocrSessionResult = await build({
		entryPoints: [join(durableObjectsDir, 'ocr-session.ts')],
		bundle: true,
		format: 'esm',
		platform: 'browser',
		target: 'es2022',
		write: false,
		minify: false,
		external: ['@libsql/client/web']
	});

	// Bundle DashboardSessions
	const dashboardSessionsResult = await build({
		entryPoints: [join(durableObjectsDir, 'dashboard-sessions.ts')],
		bundle: true,
		format: 'esm',
		platform: 'browser',
		target: 'es2022',
		write: false,
		minify: false,
		external: ['@libsql/client/web']
	});

	// Strip the export statements from bundled code (we'll add them ourselves)
	const stripExports = (code) => code.replace(/export\s*\{\s*\w+\s*\}\s*;?\s*$/gm, '').trim();

	return {
		ocrSession: stripExports(ocrSessionResult.outputFiles[0].text),
		dashboardSessions: stripExports(dashboardSessionsResult.outputFiles[0].text)
	};
}

async function main() {
	// Read the generated worker
	let workerCode = readFileSync(workerPath, 'utf-8');

	// Bundle the Durable Objects
	const { ocrSession, dashboardSessions } = await bundleDurableObjects();

	// Create the injected code block
	const injectedCode = `
// ============================================================================
// Durable Objects (injected by scripts/inject-durable-objects.js)
// ============================================================================

// --- OCRSession Durable Object ---
${ocrSession}

// --- DashboardSessions Durable Object ---
${dashboardSessions}
`;

	// Find the export statement and inject the DO code before it
	// Also add the DO classes to the exports
	const exportMatch = workerCode.match(/export\s*\{\s*worker_default\s+as\s+default\s*\}\s*;?\s*$/);

	if (!exportMatch) {
		console.error('Could not find export statement in worker');
		process.exit(1);
	}

	// Insert DO code before the export statement
	workerCode = workerCode.replace(
		exportMatch[0],
		injectedCode + '\nexport { OCRSession, DashboardSessions, worker_default as default };'
	);

	// Write the modified worker
	writeFileSync(workerPath, workerCode);

	console.log('✓ Durable Objects injected into _worker.js');
}

main().catch((err) => {
	console.error('Failed to inject Durable Objects:', err);
	process.exit(1);
});
