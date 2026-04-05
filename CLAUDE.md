# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Zero is an open-source, self-hostable email client (Gmail alternative) with AI features. Multi-provider support (Gmail, Outlook). Repository: Mail-0/Zero, website: 0.email.

## Monorepo Structure

pnpm v10 workspaces with Turbo for orchestration.

- `apps/mail/` — Frontend: React Router v7 + Vite (NOT Next.js), deployed to Cloudflare Workers
- `apps/server/` — Backend: Hono framework, deployed to Cloudflare Workers
- `packages/cli/` — `nizzy` CLI for env setup and type sync
- `packages/eslint-config/` — Shared ESLint config
- `packages/testing/` — Vitest + Playwright tests
- `packages/tsconfig/` — Shared TypeScript config

## Commands

### Development
```bash
pnpm go              # One-command: starts DB containers + all dev servers
pnpm dev             # Start all dev servers (Turbo-managed)
pnpm docker:db:up    # Start PostgreSQL + Valkey (Redis) containers
pnpm docker:db:down  # Stop containers
pnpm docker:db:clean # Stop and remove volumes
```

Frontend runs on localhost:3000, backend on localhost:8787. Drizzle Studio auto-starts with `pnpm dev`.

### Database (Drizzle ORM + PostgreSQL)
```bash
pnpm db:push         # Apply schema to dev database (use during development)
pnpm db:generate     # Generate migration files after schema changes
pnpm db:migrate      # Apply migrations (production)
pnpm db:studio       # Open Drizzle Studio UI
```

Schema: `apps/server/src/db/schema.ts`. Migrations: `apps/server/src/db/migrations/`. Tables prefixed with `mail0_*`.

### Linting & Formatting
**Do NOT run project-wide lint/format commands** (`pnpm check`, `pnpm lint`, `pnpm format`). Always target specific files:
```bash
pnpm dlx oxlint@latest --deny-warnings   # Lint (also the pre-commit hook)
prettier --write <specific-files>          # Format specific files
pnpm run --filter=@zero/mail lint          # Lint single package
```

### Testing
```bash
pnpm test             # Vitest suite (via @zero/testing package)
pnpm test:watch       # Watch mode
pnpm test:coverage    # Coverage report
pnpm test:ai          # AI evaluation tests (apps/server)
pnpm eval             # Run evalite evaluation suite
```

### Building & Deploying
```bash
pnpm build            # Build all packages
pnpm deploy:frontend  # Deploy mail app to Cloudflare
pnpm deploy:backend   # Deploy server to Cloudflare
```

## Tech Stack

### Frontend (`apps/mail/`)
- **Routing**: React Router v7 with file-based routes (`app/routes.ts` defines all routes)
- **UI**: Shadcn UI + Radix UI, TailwindCSS v4 (CSS-first config with `@theme` directive, no `tailwind.config.js`)
- **State**: Jotai atoms (`store/` directory)
- **Data fetching**: tRPC client + TanStack React Query with SuperJSON serialization
- **Rich text**: TipTap editor for email composition
- **Build**: Vite with React Compiler (Babel plugin), Cloudflare Vite plugin
- **i18n**: Inlang Paraglide — messages in `apps/mail/messages/{lang}.json`, usage: `import { m } from '@/paraglide/messages'`

### Backend (`apps/server/`)
- **Framework**: Hono with context storage middleware
- **API**: tRPC routers in `src/trpc/routes/` (connections, mail, drafts, labels, settings, etc.)
- **HTTP routes**: `src/routes/` (auth, ai, chat, agent, autumn)
- **Database**: PostgreSQL via Drizzle ORM, schema in `src/db/schema.ts`
- **Auth**: Better Auth with Google OAuth, cookie-based sessions
- **AI**: Vercel AI SDK with multiple providers (OpenAI, Anthropic, Groq, Perplexity)
- **Agent system**: AI agents with MCP support in `src/routes/agent/`
- **Cloudflare**: Durable Objects (sync, state), Workflows, Queues, KV, R2 storage, Vectorize, Hyperdrive
- **Email sending**: Resend API
- **Encryption**: Autumn.js for sensitive data
- **Cache**: Valkey (Redis-compatible) via Upstash client

## Architecture Key Points

### Frontend routing
Layout groups use parentheses syntax: `(auth)/`, `(routes)/`, `(full-width)/`. Routes defined explicitly in `app/routes.ts`, not auto-discovered.

### API communication
tRPC provides end-to-end type safety. The server package exports types consumed by the frontend: `@zero/server/trpc`, `@zero/server/auth`, `@zero/server/schemas`.

### Provider pattern
Frontend uses `ServerProviders` (auth, connections via loaders) wrapping `ClientProviders` (theme, React Query, Jotai).

### Durable Objects & Workflows
Backend uses Cloudflare Durable Objects for stateful per-user sync workers (`ZeroAgent`, `ZeroDriver`, `ThreadSyncWorker`, `ShardRegistry`) and Workflows for orchestrating async processes (`SyncThreadsWorkflow`, `SyncThreadsCoordinatorWorkflow`).

## Git Workflow

- **Base branch**: `staging` (NOT main) — all PRs target staging
- **Branch naming**: `feature/name` or `fix/name`
- **Pre-commit hook**: Husky runs `pnpm dlx oxlint@1.9.0 --deny-warnings`
- **Commit format**: Conventional commits (`feat:`, `fix:`, `refactor:`, etc.)

## Code Style

- 2-space indentation, single quotes, semicolons, 100-char line width
- Prettier with sort-imports and Tailwind plugins
- TypeScript strict mode, avoid `any`
- Use `type` keyword for type-only imports
- Shared dependency versions managed via `catalog:` in `pnpm-workspace.yaml`

## TailwindCSS v4 (Important)

This project uses Tailwind v4 with CSS-first configuration:
- Config via `@theme` directive in CSS, NOT `tailwind.config.js`
- Import: `@import "tailwindcss"` (not `@tailwind` directives)
- Renamed utilities: `shadow-sm`→`shadow-xs`, `rounded-sm`→`rounded-xs`, `blur-sm`→`blur-xs`
- No opacity utilities (`bg-opacity-*`): use `bg-black/50` syntax instead
- CSS variables for arbitrary values: `bg-(--brand-color)` not `bg-[--brand-color]`

## Local Database

Docker Compose (`docker-compose.db.yaml`):
- PostgreSQL 17: `localhost:5432` (user: postgres, pass: postgres, db: zerodotemail)
- Valkey (Redis): `localhost:6379`
- Upstash Proxy: `localhost:8079`

`DATABASE_URL=postgresql://postgres:postgres@localhost:5432/zerodotemail`

## Environment Setup

```bash
pnpm nizzy env    # Create .env from .env.example
pnpm nizzy sync   # Sync env vars and generate types (also runs on postinstall)
```

Key vars: `VITE_PUBLIC_APP_URL`, `VITE_PUBLIC_BACKEND_URL`, `DATABASE_URL`, `BETTER_AUTH_SECRET`, `GOOGLE_CLIENT_ID/SECRET`. See `.env.example` for full list.
