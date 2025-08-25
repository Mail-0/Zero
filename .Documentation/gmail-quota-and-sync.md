# Gmail Quota and Inbox Sync Guide

This document explains how Zero syncs Gmail inboxes under Google API limits, and what you can configure for large inboxes or backfills.

## How syncing works

- **Incremental sync via Gmail History**
  - The workflow in `apps/server/src/pipelines.ts` (`WorkflowRunner`) consumes Gmail History using `agent.listHistory()` and stores the latest processed `historyId` in KV (`env.gmail_history_id`).
  - New/changed threads are detected from history deltas. Threads are synced via `agent.syncThread()` then processed by the thread workflows.
- **Thread storage**
  - Synced threads are written to Cloudflare R2 by `ThreadSyncWorker` in `apps/server/src/routes/agent/sync-worker.ts`.
- **Orchestration and safety**
  - A KV lock (`env.gmail_processing_threads`) prevents duplicate processing per history segment.
  - Concurrency is capped (currently 6) when syncing and processing threads to avoid bursts.

## Rate limits and current protections

- **Error detection and retry**
  - `apps/server/src/lib/gmail-rate-limit.ts`:
    - `isRateLimit()` detects 429 and 403 reasons like `userRateLimitExceeded`, `quotaExceeded`, etc.
    - `withRetry()` retries such errors up to 10 attempts with a conservative 60s delay.
  - Currently applied in `ThreadSyncWorker.syncThread()` for thread fetches.
- **Request shaping**
  - Driver (`apps/server/src/lib/driver/google.ts`) uses `quotaUser` to partition quota per user/env.
  - Label modifications are chunked and paced to avoid overload.
  - Workflows in `pipelines.ts` limit concurrency when calling Gmail through the Agent.

## Backfilling large inboxes

Use the following environment variables (declared in `apps/server/src/env.ts`, described in the repo `README.md` Sync section):

- `THREAD_SYNC_MAX_COUNT` (max 500)
  - Controls page size when listing threads (maps to Gmail `maxResults`).
- `THREAD_SYNC_LOOP` (`true`/`false`)
  - When `true`, continues paging a folder until fully synced.
- `DROP_AGENT_TABLES` (`true`/`false`)
  - Optionally clears Agent-side thread tables before a full resync.

Recommended for production backfills:

- `THREAD_SYNC_MAX_COUNT=500`
- `THREAD_SYNC_LOOP=true`
- `DROP_AGENT_TABLES=false` (unless you explicitly want a clean reimport)

## How to kick off a sync

- From the app/API, use the `forceSync` mutation in `apps/server/src/trpc/routes/mail.ts`.
  - This triggers the coordinator workflow to (re)sync the inbox, respecting the env settings above.
- Ongoing changes are picked up automatically via Gmail push notifications → History consumption.

## Operator playbook (quota-friendly)

- **Initial backfill**
  1. Set `THREAD_SYNC_MAX_COUNT=500`, `THREAD_SYNC_LOOP=true`.
  2. Trigger `forceSync`.
  3. Let the workflow run; it will page through the inbox safely with capped concurrency.
- **During backfill**
  - Expect slower progress if user quotas are tight. The system will retry on rate-limit errors (60s gaps).
  - Avoid manual repeated backfills; allow the lock and scheduler to proceed.
- **After backfill**
  - Leave `THREAD_SYNC_LOOP=true` in production to keep folders complete.

## Tuning and troubleshooting

- Symptoms of quota pressure:
  - 429s or 403s with reasons `userRateLimitExceeded`, `quotaExceeded`, etc. (see logs).
- What to do:
  - Reduce concurrency temporarily if necessary (search for uses of `{ concurrency: 6 }` in `apps/server/src/pipelines.ts`).
  - Keep `THREAD_SYNC_MAX_COUNT` at 500 for efficiency unless errors persist; then try 200.
  - Ensure `quotaUser` remains enabled in the driver (default in `google.ts`).
- Where to look:
  - Workflows/logs in `apps/server/src/pipelines.ts`.
  - Rate-limit helper in `apps/server/src/lib/gmail-rate-limit.ts`.
  - Driver behavior in `apps/server/src/lib/driver/google.ts`.

## Future enhancements (considerations)

- Apply `withRetry()` to all Gmail driver calls (not just thread fetches).
- Switch to exponential backoff with jitter and make retry/max-attempts configurable via env.
- Add per-user token-bucket rate limiting around high-volume operations.
- Expand observability for rate-limit counters per user.

## FAQ

- "Will large inboxes eventually sync under quota limits?"
  - Yes. Backfills may take longer, but retries, concurrency limits, and paging ensure eventual completion without hammering the API.
- "Do I need to babysit the process?"
  - Typically no. Kick off `forceSync` and let workflows proceed; avoid repeated manual triggers.
