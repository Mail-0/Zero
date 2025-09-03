# Force Re‑Sync: end‑to‑end flow (frontend ↔ backend)

Below is the lifecycle when you click the “Force re‑sync” button, with file/function references.

## Frontend flow

- **Click handler**
  - File: `apps/mail/components/ui/nav-user.tsx`
  - Function: `triggerForceSync()` calls `handleForceSync.mutateAsync()` wrapped in `toast.promise(...)`.
  - **Optimistic UI**: sets `optimisticSyncing` immediately so `SyncingStatusIndicator` shows without waiting for the server.

- **Syncing indicator logic**
  - Component: `SyncingStatusIndicator` usage in `NavUser`
  - Shown when: `optimisticSyncing || syncingStateFromServer.isSyncing || storageSize === 0`.
  - Cleared when: either the TRPC promise resolves (toast success) and we’ve received a DO state broadcast with `isSyncing=false`, or subsequent polls show non-zero data.

## TRPC call

- **Route**: `mail.forceSync`
  - File: `apps/server/src/trpc/routes/mail.ts`
  - Code path:
    1) `forceReSync(connectionId)` resets local state/shards for the inbox.
    2) **Immediate UI refresh**: queues `sendDoState(connectionId)` via `ctx.c.executionCtx.waitUntil(...)`. This pushes a “cleared” state to the client so counters/storage update quickly.
    3) Starts the coordinator workflow:
       ```ts
       env.SYNC_THREADS_COORDINATOR_WORKFLOW.create({
         params: { connectionId, folder: 'inbox' }
       })
       ```
    4) **Second UI refresh**: queues another `sendDoState(connectionId)` after starting the workflow (in case shard/registry changed).
    5) Returns the base result of `forceReSync(...)` immediately (the HTTP request never blocks on the workflow).

## Workflow orchestration

- **Coordinator**: `SyncThreadsCoordinatorWorkflow.run(...)`
  - File: `apps/server/src/workflows/sync-threads-coordinator-workflow.ts`
  - Behavior:
    - Iterates pages for `folder='inbox'`, spawning `SYNC_THREADS_WORKFLOW` per page.
    - Polls per‑page workflow completion, aggregates totals.
    - When all pages are done, logs completion and **broadcasts a final DO state**:
      - Calls `sendDoState(connectionId)` so clients receive a definitive “sync complete” signal (`isSyncing=false`, updated `counts`, `storageSize`, `shards`).

- **Per‑page worker**: `SyncThreadsWorkflow` (see `apps/server/src/workflows/sync-threads-workflow.ts`)
  - Handles fetching/normalizing/storing threads for each page.

## DO state broadcast

- **Function**: `sendDoState(connectionId)`
  - File: `apps/server/src/lib/server-utils.ts`
  - What it sends:
    - `{ type: Do_State, isSyncing: false, syncingFolders: ['inbox'], storageSize, counts, shards }`
    - Uses cached values when available; otherwise computes live counts/size and broadcasts via the Zero Socket Agent.
  - **When it runs**:
    - Twice during the `mail.forceSync` mutation (queued via `executionCtx.waitUntil(...)`).
    - Once at the end of the coordinator workflow.
    - Potentially elsewhere (e.g., on DB reads to keep UI fresh).

## What the UI experiences in order

1) **Click** → toast shows “syncing…” and `optimisticSyncing` flips on; indicator appears immediately.
2) **TRPC returns quickly** (state reset + workflow kicked off).
3) **First DO broadcast** arrives → inbox counters/storage reflect cleared state.
4) **Sync progresses** (workflows fetch/store threads).
5) **Final DO broadcast** arrives after coordinator completes → `isSyncing=false`, updated counts/storage.
6) **Indicator hides** once server state says not syncing; toast shows success.

## Edge behaviors to know

- **Empty inbox auto‑resync**: `mail.listThreads` may schedule an async resync if the inbox is empty and not within a cooldown window (see `apps/server/src/trpc/routes/mail.ts`, “resync_cooldown” logic).
- **Non‑blocking**: All `sendDoState(...)` calls in the route are queued via `executionCtx.waitUntil(...)` so HTTP responses aren’t blocked.
- **Dev reloads**: If Wrangler reloads during this flow, UI can show transient 503s; it recovers automatically on restart.

## Summary

- **Frontend**: optimistic syncing via `NavUser` + toast, then reacts to DO state broadcasts.
- **Backend**: `mail.forceSync` resets state, queues immediate DO updates, starts coordinator workflow.
- **Workflows**: page through inbox; on completion, broadcast final state so UI turns off syncing and shows correct counts/storage.

## BACKEND DEEPDIVE

This section details server-side behavior and responsibilities during a force re‑sync, with pointers to the relevant code paths.

### 1) Entry point: TRPC `mail.forceSync`

- **File**: `apps/server/src/trpc/routes/mail.ts`
- **Key steps**:
  - **State reset**: `forceReSync(connectionId)` clears local per-connection inbox state (DB rows/labels + shard/registry refresh as implemented by our driver/agent team via `server-utils`). This is intended to be idempotent.
  - **Immediate UI state broadcast**: `ctx.c.executionCtx.waitUntil(sendDoState(connectionId))` is queued so the HTTP request is not blocked, but clients quickly receive a “cleared” state (counts/storage reflect reset), helping the UI progress bar/counters.
  - **Start the coordinator workflow**: `env.SYNC_THREADS_COORDINATOR_WORKFLOW.create({ params: { connectionId, folder: 'inbox' } })` begins the multi‑page backfill process off‑thread from the HTTP lifecycle.
  - **Post‑start broadcast**: A second queued `sendDoState(...)` to reflect any immediate shard/registry deltas.
  - **Return**: The mutation responds with the base `forceReSync` result immediately; it never waits for the workflow.

### 2) Broadcasts: `sendDoState(connectionId)`

- **File**: `apps/server/src/lib/server-utils.ts`
- **Behavior**:
  - Aggregates and broadcasts a Drive Overlay (DO) state via the Zero Socket Agent: `{ type: Do_State, isSyncing: false, syncingFolders: ['inbox'], storageSize, counts, shards }`.
  - Uses cached computations when available; otherwise queries live DB/registries to compute counts/storage and shard totals.
  - Wrapped in `try/catch` to avoid crashing callers. Route calls use `executionCtx.waitUntil(...)` to avoid blocking.

### 3) Orchestration: `SyncThreadsCoordinatorWorkflow`

- **File**: `apps/server/src/workflows/sync-threads-coordinator-workflow.ts`
- **Run flow**:
  - Initializes per‑run context (connection, folder, page size, logging metadata).
  - Iterates pages for the folder. Each loop:
    - Spawns a per‑page workflow instance via `env.SYNC_THREADS_WORKFLOW.create({ ... })` with page token and limits (`THREAD_SYNC_MAX_COUNT`).
    - Polls for completion of that page, then aggregates its counts (items synced, pages processed).
    - Advances `currentPageToken` based on the page result; exits when token is empty or loop disabled.
  - Loop control respects env toggles:
    - `THREAD_SYNC_LOOP` (boolean) — when `false`, coordinator processes only the first page and exits.
    - `THREAD_SYNC_MAX_COUNT` — caps items per page, trading sync latency for request cost.
  - On completion: logs totals and broadcasts a final state via `sendDoState(connectionId)` so clients see `isSyncing=false` and final counts/storage.

### 4) Per‑page ingestion: `SyncThreadsWorkflow`

- **File**: `apps/server/src/workflows/sync-threads-workflow.ts`
- **Responsibilities**:
  - Fetches a page of threads from the external provider via the active driver.
  - Normalizes and writes data into our local store (SQLite/Hyperdrive via the agent), updates labels, and computes the next page token.
  - Returns page metrics to the coordinator. The coordinator determines whether to continue.

### 5) Execution context & non‑blocking design

- **HTTP request path**: Use `ctx.c.executionCtx.waitUntil(...)` to queue post‑response work (broadcasts or minor follow‑ups like thread re‑sync after send). This prevents long tasks from delaying responses and mitigates timeouts.
- **Workflows**: Run outside the request lifecycle using Durable Objects/Workflows binding. Long‑running operations, retries, and polling happen here, independent of Worker request time budgets.

### 6) Additional server behaviors interacting with sync

- **Auto‑resync guard in listing**: In `mail.listThreads`, when returning an empty INBOX and no search query, a cooldown key (`resync_cooldown_<connectionId>`) is used in `env.gmail_processing_threads` (KV) to avoid excessive triggers; outside cooldown the server schedules an async `agent.stub.forceReSync()`.
- **Snooze bookkeeping**: Snoozed threads are filtered, and expired snoozes auto‑unsnooze via DB label mutations and KV cleanup (`env.snoozed_emails`).
- **Posting actions**: Some mutations (send, label changes, delete) schedule targeted re‑syncs or background work via `waitUntil(...)` to keep UI fresh without blocking the request.

### 7) Safety, idempotency, and concurrency

- **Idempotent resets**: `forceReSync(connectionId)` should be safe to call repeatedly; it clears local state and re‑establishes shard/registry view.
- **At‑least‑once broadcasts**: Multiple `sendDoState(...)` calls are intentional to improve UI responsiveness; duplicates are benign.
- **Concurrency**: Coordinator processes pages sequentially per connection/folder to avoid write contention while still isolating the heavy lifting from the HTTP path.

### 8) Failure modes and diagnostics

- **Transient 503s in dev**: Wrangler dev reloads or Worker restarts will temporarily 503 in‑flight TRPC calls. Look for the first error preceding the 503 burst.
- **Binding/config issues**: Missing `wrangler.toml` bindings for workflows/KV/queues/DOs will surface during `sendDoState` or workflow creation — verify dev bindings mirror prod.
- **Slow broadcasts**: If `sendDoState` becomes slow due to heavy aggregation, prefer fire‑and‑forget in workflow (`void sendDoState(...)`) to avoid delaying completion.
- **Driver/agent exceptions**: Poll logs from coordinator and per‑page workflows to pinpoint failing page tokens or provider API errors; coordinator will stop when no next page is available or loop disabled.

### 9) Tuning knobs

- `THREAD_SYNC_LOOP`: enable/disable multi‑page backfill.
- `THREAD_SYNC_MAX_COUNT`: reduce per‑page size to lower peak memory/latency.
- Cooldown TTLs in `mail.listThreads` empty‑inbox path to avoid repeated automatic resyncs.

### 10) End state contract

- After the coordinator completes, the final broadcast ensures clients see:
  - `isSyncing=false`
  - Accurate `counts`, `storageSize`, and `shards`
  - Consistent inbox listing backed by the refreshed DB state.
