# Mailbox reliability deployment runbook

## Release gates

Run from the repository root with Node 22.13+ (SQLite tests) and the pinned pnpm version:

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm test
git diff --check
```

`pnpm check` includes formatting, full ESLint, backend/frontend typechecks, frontend route
type generation, and pinned React Doctor's error gate. `pnpm check:react:json` exposes
warning findings as well. Do not count a scan with partial/skipped files as a clean audit.
Generated Paraglide, Wrangler, build, and route-type output is excluded from source lint/formatting.

Before release, record a 30-minute backfill soak with cached/cold opens and reversible
label actions, including restarts and quota pauses. Require advancing imports when
capacity permits, zero permanently blocked work, automatic restart recovery without
retry RPCs, bounded lease expiry, and no recurring undisposed RPC-target warnings.
Record request p95, provider-confirmed actions, cursor progress, and remaining imports.
After import/verification jobs drain, compare SQLite-derived counts to Gmail at a stable
history checkpoint. This completed-mailbox parity check remains a release gate while
the current development mailbox is still importing.

## Environment and resource preflight

Always select `--env staging` or `--env production`. Raw `wrangler deploy` without
an environment targets the top-level configuration, which does not carry production
bindings. Package `deploy` scripts explicitly select production; `deploy:staging`
scripts select staging.
Production Worker names are `zero-server-production` and `zero-production`.

Local frontend public URLs are also build-time settings. The ignored root `.env`
was observed pointing at port 8788 while the tested Worker runs on 8787. For this
local setup, explicitly start the frontend with matching URLs:

```sh
VITE_PUBLIC_BACKEND_URL=http://localhost:8787 VITE_PUBLIC_APP_URL=http://localhost:3000 CLOUDFLARE_ENV=local pnpm --filter @zero/mail dev --port 3000 --strictPort
```

Confirm these resources in the intended Cloudflare account:

- SQLite Durable Objects: `ZeroAgent`, `ZeroMCP`, `ZeroDriver`, `ThinkingMCP`,
  `WorkflowRunner`, `GmailQuota`; existing `ZeroDB` namespace.
- All three configured KV bindings, R2 `THREADS_BUCKET`, Hyperdrive, both Vectorize
  indexes, AI, and the `thread_queue` / `subscribe_queue` producers and consumers.
- Minute cron in all environments. Its bounded mailbox wakeups repair schedules;
  mailbox alarms own actual sync delivery and respect persisted due times/backoff.
- Queue retries remain enabled. Push admission must return 503 on failed queue
  admission, and consumers must acknowledge only after durable mailbox signal admission.
- PostgreSQL connectivity/schema, Redis, OAuth client/secret, auth secret and trusted
  origins, service-account JSON, frontend/backend URLs, and existing application secrets.
- `GOOGLE_SERVICE_ACCOUNT` (preferred) or `GOOGLE_S_ACCOUNT`, `GMAIL_PUSH_URL` if
  different from `<backend URL>/a8n/notify/google`, and optional Gmail quota budgets.
  The quota namespace key comes from the OAuth client project number; service-account
  and OAuth projects must agree. Never print secret values in preflight output.

Read-only checks:

```sh
pnpm --filter @zero/server exec wrangler deployments list --env production
pnpm --filter @zero/server exec wrangler versions view <CURRENT_VERSION_ID> --env production --json
pnpm --filter @zero/server exec wrangler secret list --env production
pnpm --filter @zero/server exec wrangler queues list
```

Observed production on 2026-10-12: version `248b51ca-745c-40d9-8ec3-99bd9434b0c6`,
migration tag `v8`, with existing namespace/resource IDs matching production configuration.
The new quota class is **production `v9`**, and **local/staging `v8`**. Historical
staging/production `v4` tags are preserved as no-ops because `ZeroAgent` was already
declared at `v2`; this removes a duplicate-class replay error in the newer runtime.
No remote migration was applied during dry runs. The staging Worker did not exist
in the inspected account; provision its resources/secrets and Worker before staging smoke tests.

## Pub/Sub and watch setup

For each mailbox's `notifications__<connectionId>` topic/subscription, verify:

1. `gmail-api-push@system.gserviceaccount.com` has `roles/pubsub.publisher` on the topic.
2. Push endpoint is the intended public HTTPS webhook; its OIDC audience matches
   exactly, and service-account email matches the configured JSON `client_email`.
3. The project's Pub/Sub service agent has Token Creator permission for the push
   service account. Confirm a real authenticated delivery, not just IAM presence.
4. Topic/subscription/watch provisioning uses the existing subscribe queue. Existing
   subscriptions are updated in place, preserving pending messages. Watch renewal
   must not replace the committed mailbox history cursor.

The inspected development subscription points to `https://sync-dev.0.email/a8n/notify/google`,
with matching audience and `production@mail0-450201.iam.gserviceaccount.com` identity.
Its topic has Gmail's publisher grant. These are development delivery settings,
not evidence that production delivery is configured. Provision/verify production
delivery after the backend endpoint and secrets are ready.

## Cache retention

Install and verify a **30-day object expiration** rule on the cache-only prefix;
keep other bucket lifecycle rules intact:

```sh
pnpm --filter @zero/server exec wrangler r2 bucket lifecycle list threads-staging
pnpm --filter @zero/server exec wrangler r2 bucket lifecycle add threads-staging mail-assets-v1-expiry mail-assets/v1/ --expire-days 30
pnpm --filter @zero/server exec wrangler r2 bucket lifecycle list threads
pnpm --filter @zero/server exec wrangler r2 bucket lifecycle add threads mail-assets-v1-expiry mail-assets/v1/ --expire-days 30
```

Keys contain mailbox/message/attachment identity hashes. Cache expiry is safe:
the next read downloads Gmail data again. R2 expiration is asynchronous and is
measured from object creation, not access. Lifecycle setup is a deployment prerequisite;
these commands have not been applied remotely by the implementation session.

Thread bodies use one stable mailbox/thread key; refreshed versions overwrite that
key rather than accumulating historical objects. Message deletion updates labels and
thread tombstones atomically, then schedules durable R2 deletion or a partial-thread
refresh. Keep those jobs across restart; never clear storage to recover sync.
Draft detail/list DTOs overwrite their identity keys and are invalidated on writes;
expired entries are pruned on fetch and capped at 128. Search pages are similarly
bounded/pruned. Replaced draft message attachment objects age out under the prefix rule.
Retained tombstones/checkpoints are correctness metadata, not disposable cache versions.

## Build, dry run, deploy

Build each frontend environment with its **build-time** public URLs. Runtime Worker
vars alone cannot change Vite-inlined URLs. `CLOUDFLARE_ENV` selects the generated
Wrangler configuration used by subsequent frontend deployment.

```sh
pnpm --filter @zero/server exec wrangler deploy --env staging --dry-run
VITE_PUBLIC_BACKEND_URL=https://sapi.0.email VITE_PUBLIC_APP_URL=https://staging.0.email CLOUDFLARE_ENV=staging pnpm --filter @zero/mail build
pnpm --filter @zero/mail exec wrangler deploy --env staging --dry-run

# After staging prerequisites and release gates pass:
pnpm --filter @zero/server exec wrangler deploy --env staging
pnpm --filter @zero/mail exec wrangler deploy --env staging
```

Capture previous versions before production, then:

```sh
pnpm --filter @zero/server exec wrangler deploy --env production --dry-run
VITE_PUBLIC_BACKEND_URL=https://api.0.email VITE_PUBLIC_APP_URL=https://0.email CLOUDFLARE_ENV=production pnpm --filter @zero/mail build
pnpm --filter @zero/mail exec wrangler deploy --env production --dry-run

# Deploy only after gates and staging smoke tests pass:
pnpm --filter @zero/server exec wrangler deploy --env production
pnpm --filter @zero/mail exec wrangler deploy --env production
```

Verify the redirected frontend `build/client/wrangler.json` says the expected
Worker name, `targetEnvironment`, and public URLs. Review migration/binding summaries
and Worker size. The current production backend dry run is approximately 10.73 MiB
uncompressed / 1.79 MiB gzip; verify the account's applicable upload limit before release.

## Smoke tests and observation

- `/health` returns 200; authenticated mailbox requests and OAuth reconnect work.
- Inbox/cached opens/counts remain responsive during import; sync-status UI stays hidden.
- Incoming test mail or a reversible external Gmail label change advances the cursor,
  invalidates search/list/count membership, and reaches the browser through notifications.
- A reversible read/star/custom-label action is confirmed independently in Gmail.
  Rapid restore/newer intent survives an older delivery failure/acknowledgment.
- Restart/evict with pending import/action work and during a quota pause. Observe
  alarms/cron resume it without `retryMailboxSync` or `retryLabelSync` calls.
- Create a temporary draft, externally edit it, and verify refreshed detail/list within
  the declared cache TTL/history bounds. Delete the temporary draft; send nothing.
- Restart and read a known attachment; identical bytes come from persisted R2.
- Validate provider-wide spam cleanup in a controlled test mailbox, including an
  interruption between discovery and delivery. Admission returns `queued: true`,
  not provider completion; inspect `mail.syncStatus.spamCleanup` and label outbox state.

Observe errors, p95 latency, advancing imported totals/cursor, blocked jobs/intents,
confirming overlays, quota cooldowns, and persisted lease count. A quota pause must
resume after rolling capacity returns; dead leases expire after two minutes. A
mailbox stalled beyond its persisted retry time plus two wakeup intervals, growing
blocked work, recurring target-leak warnings, or sustained foreground failures stops rollout.
Local Wrangler does not automatically trigger Worker cron: use its local scheduled
endpoint to test the global wakeup, and distinguish this from automatic DO alarms.

## Rollback

Record backend/frontend version IDs and a tested rollback artifact before release.
Roll back the frontend independently if the regression is frontend-only:

```sh
pnpm --filter @zero/mail exec wrangler rollback <PREVIOUS_FRONTEND_VERSION_ID> --env production
```

After the new Durable Object class migration, use a **migration-compatible** backend
version/artifact that retains the `GmailQuota` export/binding and additive SQLite
tables. It must also retain persisted callback names such as `runMailboxHistory`,
`flushUnreadOutbox`, and `runSpamCleanup`, so pending schedules continue to execute.
The old production `v8` bundle lacks the quota class, so it is not the assumed
rollback target for a `v9` deployment. If a compatible deployed version exists:

```sh
pnpm --filter @zero/server exec wrangler rollback <COMPATIBLE_V9_VERSION_ID> --env production
```

Otherwise redeploy the prepared compatible known-good source with the same namespace
bindings and migration history. Do not delete namespaces, reverse SQLite tables,
clear pending outboxes/import jobs, or re-provision subscriptions to roll back code.
Re-run health, cached-read, pending-action, and cursor smoke tests after rollback.

## Outstanding evidence

Dry runs and local tests do not certify remote alarms or production Pub/Sub setup.
Completed-live-mailbox count parity, controlled-mailbox provider-wide cleanup recovery,
remote staging smoke tests, production secret/project identity verification, and cache
lifecycle installation must be recorded before declaring this release deploy-ready.
