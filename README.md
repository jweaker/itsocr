# ItsOCR

AI-powered OCR service built on Cloudflare Workers. Upload images, extract text in real-time via streaming.

## Stack

- **Runtime**: Cloudflare Workers + Durable Objects
- **Framework**: SvelteKit 2 / Svelte 5
- **Database**: Turso (LibSQL)
- **Storage**: Cloudflare R2
- **Auth**: Better Auth (email/password + OAuth)
- **OCR**: Ollama with MiniCPM-V (self-hosted)
- **API**: tRPC

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
- Ollama instance with `minicpm-v` model

### Ollama Setup

Run Ollama with the vision model:

```bash
ollama pull minicpm-v
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

There are two dev modes with different trade-offs:

### `pnpm dev` (Vite)

```bash
pnpm dev
# → http://localhost:5173
```

- Fast HMR
- No Cloudflare bindings (R2, Durable Objects unavailable)
- Use for: UI work, styling, layout

### `wrangler dev` (Full Cloudflare)

```bash
pnpm build
wrangler dev
# → http://localhost:8787
```

- Full Workers environment with all bindings
- R2, Durable Objects, everything works
- Slower rebuilds
- Use for: Testing OCR, WebSockets, uploads

**Recommended workflow** for feature development:

```bash
# Terminal 1
pnpm build --watch

# Terminal 2
wrangler dev
```

## Database

Run migrations:

```bash
pnpm db:generate  # Generate migration files
pnpm db:migrate   # Apply to Turso
```

Local development uses `file:local.db` by default.

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
│   │   ├── auth/             # Better Auth config
│   │   ├── db/               # Drizzle schema
│   │   ├── trpc/             # API routes
│   │   └── services/usage.ts # Usage tracking
│   └── components/ui/        # shadcn-svelte
├── routes/
│   ├── api/
│   │   ├── ocr/[id]/         # OCR endpoints
│   │   ├── upload/           # R2 upload
│   │   └── trpc/             # tRPC handler
│   ├── dashboard/            # Main UI
│   └── image/[image]/        # Image detail view
└── hooks.server.ts           # Auth middleware
```

## Plans

| Plan       | Images/Month | Max Size |
| ---------- | ------------ | -------- |
| Free       | 10           | 5MB      |
| Pro        | 500          | 20MB     |
| Enterprise | Unlimited    | 50MB     |

## License

MIT
