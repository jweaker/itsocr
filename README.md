# ItsOCR

AI-powered OCR service built on Cloudflare Workers. Upload images and PDFs, extract text in real-time via streaming or REST API.

## Features

- **Image OCR**: Extract text from images (JPEG, PNG, WebP, GIF)
- **PDF Support**: Multi-page PDF processing with parallel extraction
- **Real-time Streaming**: WebSocket-based streaming for instant feedback
- **REST API**: Programmatic access with API tokens for automation
- **Usage Tracking**: Per-plan limits with monthly quotas

## Stack

- **Runtime**: Cloudflare Workers + Durable Objects
- **Framework**: SvelteKit 2 / Svelte 5
- **Database**: Turso (LibSQL)
- **Storage**: Cloudflare R2
- **Auth**: Better Auth (email/password + OAuth)
- **OCR**: Ollama with Llama 3.2 Vision (self-hosted)
- **API**: tRPC + REST API

## Architecture

```
Client → SvelteKit → Durable Object → Ollama
                ↓           ↓
              Turso        R2
```

1. User uploads image → stored in R2
2. WebSocket connects to OCR Durable Object
3. DO fetches image, streams to Ollama, broadcasts chunks back
4. Result saved to Turso, displayed in real-time

## Prerequisites

- Node.js 20+
- pnpm
- Cloudflare account (Workers paid plan for Durable Objects)
- Turso database
- Ollama instance with `llama3.2-vision:latest` model

### Ollama Setup

Run Ollama with the vision model:

```bash
ollama pull llama3.2-vision:latest
ollama serve
```

Expose it via Cloudflare Tunnel or similar. The endpoint is configured in `src/durable-objects/ocr-session.ts`.

## Environment Variables

```bash
# Database (Turso)
DATABASE_URL="libsql://your-db.turso.io"
DATABASE_AUTH_TOKEN="your-token"

# Auth
BETTER_AUTH_SECRET="32-char-random-string"  # openssl rand -base64 32
BETTER_AUTH_BASE_URL="https://your-domain.com"

# Client-side
VITE_BETTER_AUTH_URL="https://your-domain.com"

# Optional: OAuth providers
BETTER_AUTH_GITHUB_CLIENT_ID=""
BETTER_AUTH_GITHUB_CLIENT_SECRET=""
BETTER_AUTH_GOOGLE_CLIENT_ID=""
BETTER_AUTH_GOOGLE_CLIENT_SECRET=""
```

For Cloudflare, set secrets via:

```bash
wrangler secret put DATABASE_URL
wrangler secret put DATABASE_AUTH_TOKEN
wrangler secret put BETTER_AUTH_SECRET
```

## Development

```bash
pnpm dev      # Vite with HMR (fast, but no Durable Objects)
pnpm preview  # Full Cloudflare environment (slower, but everything works)
```

- **`pnpm dev`**: Fast HMR for UI work. R2 works via platform proxy, but Durable Objects don't (Cloudflare limitation).
- **`pnpm preview`**: Builds and runs with wrangler. Full Cloudflare bindings including Durable Objects. Use for testing OCR/WebSockets.

## Database

```bash
pnpm db:generate  # Generate migration files
pnpm db:push      # Push schema to Turso
pnpm db:studio    # Open Drizzle Studio
```

## Deployment

```bash
pnpm build
wrangler deploy
```

The build process:

1. SvelteKit builds to `.svelte-kit/cloudflare/`
2. `scripts/inject-durable-objects.js` bundles DOs into `_worker.js`
3. Wrangler deploys to Cloudflare

## Project Structure

```
src/
├── durable-objects/
│   ├── ocr-session.ts        # OCR processing + WebSocket
│   └── dashboard-sessions.ts # Real-time dashboard updates
├── lib/
│   ├── server/
│   │   ├── auth/             # Better Auth + API token validation
│   │   ├── db/               # Drizzle schema
│   │   ├── trpc/             # tRPC routes
│   │   ├── ocr/              # OCR processing logic
│   │   └── services/usage.ts # Usage tracking
│   └── components/ui/        # shadcn-svelte
├── routes/
│   ├── api/
│   │   ├── v1/ocr/           # Public REST API
│   │   ├── ocr/[id]/         # OCR endpoints
│   │   ├── upload/           # R2 upload
│   │   └── trpc/             # tRPC handler
│   ├── dashboard/            # Main UI
│   ├── settings/             # API token management
│   ├── docs/api/             # API documentation
│   └── image/[image]/        # Image detail view
└── hooks.server.ts           # Auth middleware
```

## REST API

ItsOCR provides a REST API for programmatic access. Generate API tokens from the Settings page.

### Authentication

All API requests require a Bearer token:

```bash
curl -X POST https://your-domain.com/api/v1/ocr \
  -H "Authorization: Bearer your_api_token" \
  -F "file=@document.png"
```

### Endpoints

#### POST /api/v1/ocr

Extract text from an image or PDF.

**Request:**

- `file` (required): Image file (JPEG, PNG, WebP, GIF) or PDF
- Max file size depends on your plan

**Response:**

```json
{
	"success": true,
	"text": "Extracted text content...",
	"pages": 1
}
```

For PDFs, multiple pages are processed in parallel (4 at a time).

**Error Response:**

```json
{
	"success": false,
	"error": "Error message"
}
```

### Code Examples

**JavaScript (Node.js):**

```javascript
import fs from 'fs';

// Read file and create a Blob
const fileBuffer = fs.readFileSync('document.png');
const blob = new Blob([fileBuffer], { type: 'image/png' });

const formData = new FormData();
formData.append('file', blob, 'document.png');

const response = await fetch('https://your-domain.com/api/v1/ocr', {
	method: 'POST',
	headers: {
		Authorization: 'Bearer your_api_token'
	},
	body: formData
});

const result = await response.json();
console.log(result.text);
```

**JavaScript (Browser):**

```javascript
// In a browser, you can use a file input directly
const fileInput = document.querySelector('input[type="file"]');
const formData = new FormData();
formData.append('file', fileInput.files[0]);

const response = await fetch('https://your-domain.com/api/v1/ocr', {
	method: 'POST',
	headers: {
		Authorization: 'Bearer your_api_token'
	},
	body: formData
});

const result = await response.json();
console.log(result.text);
```

**Python:**

```python
import requests

with open('document.png', 'rb') as f:
    response = requests.post(
        'https://your-domain.com/api/v1/ocr',
        headers={'Authorization': 'Bearer your_api_token'},
        files={'file': f}
    )

result = response.json()
print(result['text'])
```

## Plans

| Plan       | Images/Month | Max Size | API Access |
| ---------- | ------------ | -------- | ---------- |
| Free       | 10           | 5MB      | Yes        |
| Pro        | 500          | 20MB     | Yes        |
| Enterprise | Unlimited    | 50MB     | Yes        |

## License

MIT
