# Zero – Project Summary

Zero is an open‑source, self‑hostable email application that integrates with providers like Gmail and Outlook. It focuses on privacy, performance, and AI‑assisted workflows (agents/LLMs) while offering a modern, customizable UI.

Key features:
- Open source, privacy‑first, and self‑hostable
- Unified inbox across providers (e.g., Gmail via OAuth)
- AI‑driven capabilities for email actions and workflows
- Customizable React UI with modern components

Tech stack:
- Frontend: React Router (Vite), React, TypeScript, TailwindCSS, shadcn
- Backend: Cloudflare Workers (Wrangler), Hono, tRPC, Drizzle ORM
- Database: PostgreSQL (Drizzle)
- Auth: Better Auth, Google OAuth
- Tooling: pnpm workspaces, Turbo, Drizzle Kit

Monorepo layout (selected):
- `apps/mail`: Frontend app (react-router dev, wrangler dev for start)
- `apps/server`: Backend Cloudflare Worker (wrangler dev)
- `packages/*`: Shared config, CLI, testing, tsconfig
- Root scripts orchestrate dev/build/test across workspace

Development flow (non-Docker):
1) Install deps: `pnpm install`
2) Ensure `.env` is configured (see `.env.example`)
3) Start Postgres (Docker compose): `pnpm docker:db:up`
4) Push schema: `pnpm db:push`
5) Run dev servers: `pnpm dev`
   - Frontend: http://localhost:3000
   - Backend (Workers dev): http://localhost:8787

Docker in dev:
- This repo uses Docker only for the PostgreSQL database during development (`docker-compose.db.yaml`). The application itself runs with local dev servers via Wrangler and React Router.

Critical environment variables (see `.env.example`):
- `DATABASE_URL` (local Postgres connection)
- `BETTER_AUTH_SECRET` (random secret)
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` (for Gmail OAuth; dev redirect: `http://localhost:8787/api/auth/callback/google`)
- `REDIS_URL` / `REDIS_TOKEN` (local/Upstash)
- Optional: `RESEND_API_KEY`, `OPENAI_API_KEY`/`PERPLEXITY_API_KEY`, `AUTUMN_SECRET_KEY`, `TWILIO_*`

Notes:
- Node target: `.nvmrc` suggests v22; README requires Node >= 18. Use Node 20/22 with pnpm 10.
- After install, the repo’s `postinstall` runs `pnpm nizzy sync` to sync env types.
- Database defaults (from compose): db name `zerodotemail`, user `postgres`, password `postgres`, port `5432`.
