# Google Gemini Migration: Model + Env Refactor

This document records the refactor to migrate AI functionality to Google Gemini with environment-driven configuration.

## Goals

- Replace hardcoded Gemini model strings with a configurable `GEMINI_FLASH_MODEL`.
- Unify Gemini API key env var to `GOOGLE_GENERATIVE_AI_API_KEY` (formerly `GEMINI_API_KEY`).
- Remove any lingering OpenAI/Anthropic/Groq usage and ensure `@ai-sdk/google` is used where appropriate.

## High-level Changes

- Introduced `env.GEMINI_FLASH_MODEL` throughout the server. Default fallback: `gemini-2.0-flash`.
- Renamed env key `GEMINI_API_KEY` to `GOOGLE_GENERATIVE_AI_API_KEY` in all env files.
- Updated Workers typings (server/mail) to reflect the new env keys and add `GEMINI_FLASH_MODEL`.
- Added `GEMINI_FLASH_MODEL` and `GOOGLE_GENERATIVE_AI_API_KEY` to `wrangler.jsonc` for all environments.

---

## Files Changed

- Server code (model usage)
  - `apps/server/src/routes/agent/index.ts`
  - `apps/server/src/trpc/routes/ai/compose.ts`
  - `apps/server/src/trpc/routes/ai/search.ts`
  - `apps/server/src/lib/analyze/interests.ts`
  - `apps/server/src/services/writing-style-service.ts`

- Environment variables
  - Root env: `/.env`
  - Dev envs: `apps/server/.dev.vars`, `apps/mail/.dev.vars`
  - Mail app env: `apps/mail/.env`

- Worker configuration typings
  - `apps/server/worker-configuration.d.ts`
  - `apps/mail/worker-configuration.d.ts`

- Worker config
  - `apps/server/wrangler.jsonc`

---

## Before vs After (Representative Snippets)

Below are representative “before” vs “after” changes. Paths reference the files above.

### 1) Model selection

- Before (hardcoded model):

```ts
// apps/server/src/trpc/routes/ai/compose.ts
const { text } = await generateText({
  model: google('gemini-2.0-flash'),
  messages: [/* ... */],
});
```

- After (env-driven with fallback):

```ts
// apps/server/src/trpc/routes/ai/compose.ts
const { text } = await generateText({
  model: google(env.GEMINI_FLASH_MODEL || 'gemini-2.0-flash'),
  messages: [/* ... */],
});
```

Also applied to:
- `apps/server/src/trpc/routes/ai/search.ts` (generateObject)
- `apps/server/src/lib/analyze/interests.ts` (generateObject)
- `apps/server/src/services/writing-style-service.ts` (generateObject)
- `apps/server/src/routes/agent/index.ts` uses `this.env.GEMINI_FLASH_MODEL || 'gemini-2.0-flash'` inside the Durable Object.

### 2) Env var rename: API key

- Before:

```dotenv
# .env / .dev.vars (various)
GEMINI_API_KEY=...
```

- After:

```dotenv
GOOGLE_GENERATIVE_AI_API_KEY=...
GEMINI_FLASH_MODEL=gemini-2.0-flash
```

Applied in:
- `/.env`
- `apps/server/.dev.vars`
- `apps/mail/.dev.vars`
- `apps/mail/.env`

### 3) Worker typings

- Before (server):

```ts
// apps/server/worker-configuration.d.ts
interface Env {
  // ...
  GEMINI_API_KEY: string;
  // ...
}
```

- After (server):

```ts
// apps/server/worker-configuration.d.ts
interface Env {
  // ...
  GOOGLE_GENERATIVE_AI_API_KEY: string;
  GEMINI_FLASH_MODEL: string;
  // ...
}

declare namespace NodeJS {
  interface ProcessEnv extends StringifyValues<Pick<Cloudflare.Env,
    // ...
    | 'GOOGLE_GENERATIVE_AI_API_KEY'
    | 'GEMINI_FLASH_MODEL'
    // ...
  >> {}
}
```

- Before (mail):

```ts
// apps/mail/worker-configuration.d.ts
interface Env {
  // ...
  GEMINI_API_KEY: string;
}
```

- After (mail):

```ts
// apps/mail/worker-configuration.d.ts
interface Env {
  // ...
  GOOGLE_GENERATIVE_AI_API_KEY: string;
  GEMINI_FLASH_MODEL: string;
}
```

### 4) Wrangler vars

- After additions (applied to local, staging, production):

```json
// apps/server/wrangler.jsonc (excerpt)
{
  "env": {
    "local": {
      // ...
      "vars": {
        // ...
        "GEMINI_FLASH_MODEL": "gemini-2.0-flash",
        "GOOGLE_GENERATIVE_AI_API_KEY": ""
      }
    },
    "staging": {
      // ...
      "vars": {
        // ...
        "GEMINI_FLASH_MODEL": "gemini-2.0-flash",
        "GOOGLE_GENERATIVE_AI_API_KEY": ""
      }
    },
    "production": {
      // ...
      "vars": {
        // ...
        "GEMINI_FLASH_MODEL": "gemini-2.0-flash",
        "GOOGLE_GENERATIVE_AI_API_KEY": ""
      }
    }
  }
}
```

---

## Rationale

- Centralized model configuration via `GEMINI_FLASH_MODEL` allows easy model upgrades (e.g., `gemini-2.0-pro`) without code changes.
- `GOOGLE_GENERATIVE_AI_API_KEY` aligns with Google’s official naming and avoids ambiguity with older custom names.

## Developer Notes

- The code uses `@ai-sdk/google` and `ai` package APIs (`generateText`, `generateObject`).
- Ensure the proper API key is available at runtime (Workers vars / local `.env` / `.dev.vars`).
- Default model remains `gemini-2.0-flash` if `GEMINI_FLASH_MODEL` is unset.

## Validation

- Searched codebase to remove remaining hardcoded `google('gemini-2.0-flash')` usages.
- Verified typings compile-time coverage by updating `worker-configuration.d.ts` for both server and mail.
- Added the new env vars into `wrangler.jsonc` for all environments.

## Future Follow-ups (optional)

- Document model options and recommended defaults per environment.
- Add an integration test to assert model selection uses `GEMINI_FLASH_MODEL` value.
