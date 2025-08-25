# Deploying the Mail App (React Router SSR on Cloudflare Pages)

This document explains how to build and deploy `apps/mail` using React Router SSR and Cloudflare Pages/Functions. It also highlights key differences between development and production.

- Static assets are emitted to: `apps/mail/build/client/`
- Server bundle (SSR) is emitted to: `apps/mail/build/server/` (entry: `index.js`)
- React Router SSR is enabled via `apps/mail/react-router.config.ts` with `ssr: true`.
- Cloudflare Pages auto-detects the SSR function using the generated `build/client/wrangler.json` and the server bundle in `build/server/`.

## Prerequisites

- Node + pnpm installed
- Wrangler installed:
  - `npm i -g wrangler` or use `npx wrangler`
- Cloudflare Pages project (can be created in dashboard or the first time you deploy via Wrangler)

## Build

From repository root:

```bash
pnpm -C apps/mail build
```

Artifacts:
- `apps/mail/build/client` (static client)
- `apps/mail/build/server` (SSR server bundle)

## Deploy (Cloudflare Pages)

Use Wrangler to deploy the `build/client` directory; Cloudflare will attach the SSR function automatically based on the emitted manifest.

```bash
# Preview deployment (recommended for testing)
npx wrangler pages deploy apps/mail/build/client --project-name <your-pages-project>

# Production deployment (commonly from main branch)
npx wrangler pages deploy apps/mail/build/client --project-name <your-pages-project> --branch main
```

In the Cloudflare Pages project settings, set the Build Output Directory to `apps/mail/build/client` if you configure via UI. Wrangler CLI will infer from the given path.

## Environment Variables

The mail app proxies API requests to the backend server via Workers routes. The following env var must be configured in Cloudflare Pages (both Preview and Production environments):

- `VITE_PUBLIC_SERVER_URL` – base URL of the backend API that the SSR routes will call.

These routes reference `import.meta.env.VITE_PUBLIC_SERVER_URL`:
- `apps/mail/app/(routes)/api/plugins/settings.ts`
- `apps/mail/app/(routes)/api/plugins/settings/[id].ts`
- `apps/mail/app/(routes)/api/plugins/install/[id].ts`
- `apps/mail/app/(routes)/api/plugins/uninstall/[id].ts`
- `apps/mail/app/(routes)/api/plugins/data/[id].ts`

In development, the Vite dev server proxies `/api` and `/monitoring` to `http://localhost:8787` (see `apps/mail/vite.config.ts`). In production, there is no dev proxy; the SSR proxy routes make server-to-server requests to `VITE_PUBLIC_SERVER_URL` and forward cookies.

## Development vs Production

- **SSR setting**
  - Dev: run Vite dev server (`pnpm -C apps/mail dev`)
  - Prod: `ssr: true` allows route `loader`/`action` usage in build/runtime
- **API calls**
  - Dev: Vite proxy in `vite.config.ts` keeps same-origin cookies
  - Prod: SSR proxy routes forward `Cookie` header to backend (ensure backend sessions align with your domain strategy)
- **Env variables**
  - Dev: can be `.env` (Vite) and local process vars
  - Prod: set `VITE_PUBLIC_SERVER_URL` in Cloudflare Pages Project → Settings → Environment Variables (for both Preview and Production)

## Optional Tuning

- **Chunk size warnings**: If desired, adjust in `apps/mail/vite.config.ts`:
  - `build.chunkSizeWarningLimit`
  - `build.rollupOptions.output.manualChunks` for custom code-splitting
- **CSS minifier warnings**: Non-fatal; investigate offending CSS later if needed.

## CI/CD (Optional)

Add a workflow that:
1. Checks out code
2. Caches pnpm store
3. Runs `pnpm -C apps/mail build`
4. Runs `wrangler pages deploy apps/mail/build/client --project-name <your-pages-project> --branch main`

Ensure `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` are configured as CI secrets (Wrangler uses them).

## Troubleshooting

- **Invalid route exports during build**: Ensure `apps/mail/react-router.config.ts` has `ssr: true`. With `ssr: false`, React Router forbids `loader`/`action` exports in routes.
- **Auth issues in production**: Verify `VITE_PUBLIC_SERVER_URL` points to your backend and cookies are recognized by that server. The SSR proxy forwards `Cookie` header server-to-server.
- **Preview vs Production env vars**: Configure both in Cloudflare Pages if you test previews.

## Quick Reference

```bash
# Build
pnpm -C apps/mail build

# Deploy (Preview)
npx wrangler pages deploy apps/mail/build/client --project-name <your-pages-project>

# Deploy (Production)
npx wrangler pages deploy apps/mail/build/client --project-name <your-pages-project> --branch main
```

## Deploy (Vercel – Edge Functions)

This project’s server bundle is produced for the Web/Workers runtime (via `@cloudflare/vite-plugin`). On Vercel, deploy it as an **Edge Function** (not a Node serverless function). The Edge runtime is compatible with the Workers-style `fetch` handler.

### Vercel Project Settings

- **Root/Monorepo**: Use the repository root. In “Project Settings → Build & Development Settings”:
  - Build Command: `pnpm -C apps/mail build`
  - Output Directory: `apps/mail/build/client`
  - Install Command: your default (e.g., `pnpm install`)
- **Environment Variables**:
  - Add `VITE_PUBLIC_SERVER_URL` for Production and Preview.

### Add an Edge Function entry that re-exports the built fetch handler

Create `api/ssr.ts` (or `.js`) at the repository root (Vercel functions default location):

```ts
// api/ssr.ts
export const config = { runtime: 'edge' };

// Re-export the Workers-style fetch handler emitted by the SSR build
// Note: path is from repo root to the built server bundle
export { fetch } from '../apps/mail/build/server/index.js';
```

This works because the SSR build (Workers target) exports a top-level `fetch(request)` compatible with Edge Functions.

### Route all requests to the Edge Function (except static assets)

Add a `vercel.json` at the repository root:

```json
{
  "routes": [
    { "src": "/assets/(.*)", "dest": "/assets/$1" },
    { "src": "/(.*)", "dest": "/api/ssr" }
  ]
}
```

Static assets are served directly from `apps/mail/build/client/assets`, while all other requests are handled by the Edge Function.

### Deploy

Push to Vercel-connected Git branch or deploy via CLI:

```bash
vercel --prod
```

Ensure the build outputs exist (Vercel will run the build command) and the env var `VITE_PUBLIC_SERVER_URL` is set in the Vercel Project.

### Notes & Caveats

- The emitted server bundle targets the Workers runtime. If you want a Node serverless function on Vercel instead, you’d need a Node-targeted adapter/build (not covered here).
- With Edge runtime, cookies and fetch behave like standard Web APIs; our proxy routes forward the `Cookie` header to the backend referenced by `VITE_PUBLIC_SERVER_URL`.
