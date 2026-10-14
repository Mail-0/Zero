# Mailbox label synchronization

## Storage and delivery

`ZeroDriver` owns `mail_message_labels`, `mail_label_intents`, and
`mail_label_dispatch` in its Durable Object SQLite database. Message bodies stay
in R2. Existing cached threads populate message-label storage from R2 on first
access, without fetching Gmail.

Read/unread, archive/restore-inbox, star/unstar, trash/restore, spam/restore,
importance, and Gmail custom-label RPCs update the versioned outbox
and all requested thread summaries in one synchronous SQLite transaction. The
outbox has one independent versioned intent per `(message_id, label_id)`, so a star
toggle cannot replace an outstanding archive or read action. Existing unread
rows migrate atomically from the legacy `mail_label_outbox` table, preserving
versions, retries, blocked state, and delivery acknowledgments. That legacy table
is retained empty for compatibility. The effective message state is the
observed provider state with pending intent overlaid. Thread unread state is the
union of non-draft message labels, not just the latest message's labels.

Unsent toggles replace only the previous intent for that message and label.
Delivery groups messages by identical sorted add/remove label sets and calls
Gmail `messages.batchModify` with at most 1000 message IDs and 100 labels per
addition/removal array. Acknowledgments and retries match the captured label and
operation version, so a response
for an older write cannot delete a newer toggle. An acknowledged operation remains
as a delivered overlay until matching Gmail history or a fresh post-delivery
snapshot confirms provider state. It is not sent again while awaiting history.
Replaying a label add/remove after
an ambiguous network failure is idempotent.

Agents scheduled callbacks own alarm dispatch; this implementation does not
override `alarm`. A one-second flush window coalesces actions. Persisted mailbox
cooldowns pace dispatch, and rate-limit responses delay the entire label queue.
A minute recovery schedule is installed before admitting work, survives object
eviction, and is removed when no retryable work remains. This recovery callback
does not poll Gmail's inbox.

Transient network/5xx/408 failures and rate-limit 403/429 responses retry with
persisted exponential backoff and jitter. `Retry-After` is a lower bound. Revoked
credentials and permanent request errors retain the operation in a blocked state.
`mail.labelSyncStatus` reports queued/blocked label-intent counts and error classifications;
`mail.retryLabelSync` reloads credentials and explicitly retries blocked work.
The previous unread-named endpoints and alarm callback remain as compatibility
aliases for persisted schedules. Star requests can specify `starred` explicitly;
the UI does so to avoid stale server-side toggles. Callers omitting it retain the
previous bulk-toggle behavior, derived from effective local thread labels.
Importance requests likewise accept an explicit `important` state, which the UI
supplies. Gmail custom labels route durably by their `Label_…` provider IDs;
label-name resolution, synthetic app labels, and label creation/deletion retain
their existing paths. Trash/spam additions persist Gmail's implicit `INBOX`
removal, including bulk trash, so restoring a thread cannot become a false no-op.
Cold action targets load their message IDs through a foreground-priority import
before admitting message-level intent. Repeating an identical pending/delivered
intent preserves its version and does not resend it. HTTP delivery alone and
unrelated history deltas cannot confirm an intent using stale provider state.
These procedures are scoped to the authenticated active connection. Status is
not yet rendered in the frontend.

## Incoming changes and reads

Push admission validates Google's JWT signature, issuer, audience, verified email,
and configured service-account identity. Wrapped and unwrapped notifications are
supported. Queue admission failures return 503 so Pub/Sub retries. The consumer
acknowledges only after the per-mailbox DO has durably recorded a signal; failures
retry the queue message. Data synchronization runs even when `DISABLE_WORKFLOWS`
is true; that flag only gates the AI thread workflow (see below).

`mailbox_history` contains the committed cursor, notification revisions, polling
times, retry state, and resumable full-reconciliation page. `mailbox_import_jobs`
holds deduplicated/versioned body imports and R2 cleanup. Live imports and opened
threads have priority over historical backfill. `mailbox_notifications` separately
persists coalesced/versioned browser notifications, so an existing backfill for a
thread cannot suppress its label-change notification.
The same mailbox execution gate serializes history fetch/apply, thread snapshots,
and outgoing writes. The gate itself is in-memory; correctness across eviction
comes from these SQLite records and persisted Agents schedules.

History retrieval follows every page. Label deltas update message-level state
without fetching bodies. Cursor advancement, label changes, deletions, and newly
queued jobs commit in one SQLite transaction. Signals arriving during a fetch
retain a higher revision and force a follow-up pass. The old KV-cursor workflow
entry points have been removed.

Gmail history checkpoints on each message reject older deltas after a newer full
snapshot. Pending intents remain overlaid while incoming changes are applied.
Message deletion cancels its pending write and records a tombstone, preventing
stale R2 payloads from resurrecting it. Deleted/empty threads are removed locally;
R2 cleanup is a durable job. Partial deletions trigger a fresh thread import to
refresh latest-message metadata.

An absent or expired history cursor starts full reconciliation: capture a Gmail
profile cursor **before** listing threads, paginate the mailbox (including spam
and trash), durably record each page's import jobs, then prioritize verification
of cached threads absent from the inventory. Only a confirmed missing thread is
removed: Gmail pagination is not a transactionally consistent snapshot, so an
absence alone must not tombstone a concurrent addition. Commit the captured baseline and consume subsequent
history so changes during the snapshot are not skipped. A completion sentinel
allows restart after the final page but before cursor commit. Body imports run
one at a time with durable retries; they are not required to finish before cursor
advancement because their work is already recorded.

Active mailboxes poll incremental history approximately once a minute; inactive
mailboxes poll every 15 minutes. Thread reads, listings, and read/unread actions
refresh activity. Per-mailbox dates and hashed startup offsets stagger recovery;
a minute cron is a recovery wakeup and skips provider calls before the due time.
Rate-limit cooldowns are shared between incoming work and the unread dispatcher.

Watches on already provisioned per-account topics renew daily or before their
reported expiration. Watch renewal does not replace the committed history cursor.
Topic/subscription provisioning remains in `subscribe_queue`. Watch failures do
not erase OAuth credentials or stop polling. New watches cover all mailbox labels,
not just INBOX. Existing subscriptions still use the configured service account.

Normal thread reads use SQLite/R2. Normal inbox lists use SQLite. Folder counts
use persistent snapshots during backfill and local message-label aggregation
once coverage is complete. Gmail search membership pages have a short-lived
SQLite cache. Draft reads have short-lived caches, and attachment bytes/MIME
inventories use R2. Cache misses and other provider operations retain their
existing provider paths. Cold thread misses deduplicate
queued imports. Opening a cached thread no longer invokes `syncFolders` on every
request; empty-mailbox bootstrap
uses the resumable Gmail reconciliation path (the old folder bootstrap remains
for other providers). UI updates invalidate the thread, lists, and counts.
The browser also invalidates these caches after persistence restoration, socket
reconnection, and focus/visibility recovery. Settled optimistic read overrides are
removed, while genuinely pending user actions remain overlaid. A successful read
action refreshes its thread data before removing its optimistic override.
Archive and star actions likewise refresh thread/list membership before dropping
their optimistic state. Both list rows and context menus derive stars from all
thread labels rather than only the latest message's tags.
The inbox has no periodic browser refetch or manual refresh control. Initial loads,
mailbox notifications, successful mutations, and reconnect/focus recovery update
the UI. Backend history polling remains enabled for missed Gmail push events.

`mail.mailboxSyncStatus` exposes the current cursor/retry state and
`mail.retryMailboxSync` reloads credentials and retries blocked history/import work.
Both are scoped to the authenticated active connection. These status endpoints
are not yet rendered in the frontend.

## AI thread workflow

New mail triggers the AI thread workflow (`WorkflowRunner`: auto-draft, message
vectors, thread summary, Clef labels). When a history delta is committed, threads
that received a message from someone else are recorded in `mailbox_ai_runs` in the
same transaction. Sent, draft, spam, trash, promotions and social messages are
skipped, and a delta adding more than 50 threads counts as backfill and records
none. Backfill, reconciliation and opened-thread imports never record a run.

A row becomes ready when its thread import succeeds. Each tick leases up to four
ready rows per mailbox (10-minute lease) and dispatches them to the runner
addressed `connectionId:threadId` without awaiting, because the workflow calls
back into the mailbox DO. The row is deleted only when the runner confirms the
version it ran; newer mail during a run bumps the version and keeps the row. A
failed summary retries with backoff (30s doubling, max 30 minutes, five
attempts), and a retry never repeats an auto-draft that was already attempted. A
run lost to eviction is re-dispatched when its lease expires. The runner
serializes runs per thread and folds waiting duplicates into one.

The runner only runs for users whose Autumn plan grants `brain-activity` (it fails
closed if Autumn errors) and tracks one unit per run, keyed by the row version.
Opening a thread with no stored summary runs the summary workflow alone on demand
under the same entitlement. `DISABLE_WORKFLOWS=true` disables both paths.

## Local and production setup

Polling uses the existing Google OAuth credentials and works without a public
webhook. Localhost cannot receive Google's push requests directly. Set
`GMAIL_PUSH_URL` to a public HTTPS webhook URL to decouple push delivery from
the browser/OAuth backend URL. If omitted, it defaults to
`<VITE_PUBLIC_BACKEND_URL>/a8n/notify/google`.

`GOOGLE_SERVICE_ACCOUNT` contains the service-account JSON; it takes precedence
over the older `GOOGLE_S_ACCOUNT` variable. Its project must match the OAuth
client's Google Cloud project. The push subscription's OIDC audience must match
the webhook URL and its service-account email must match this JSON's
`client_email`. Gmail's publisher identity needs publisher access to the topic;
the Pub/Sub service agent needs Token Creator access to the push service account.
Existing subscriptions are updated in place, preserving their pending messages.

### Current local tunnel

- Cloudflare account: `AdamDomains`.
- Named tunnel: `mail0-sync-dev` (`5eb74d05-90fb-4bde-90f3-b91423f569bf`).
- Public webhook: `https://sync-dev.0.email/a8n/notify/google`.
- Origin: `http://localhost:8787`.
- Google project: `mail0-450201` (project number `225375202415`).
- OAuth and browser requests remain on localhost; no OAuth redirect changes are required.
- Only the push webhook and `/health` are published through the tunnel.

The connector runs in the background. Its token is stored outside the repository
at `/var/folders/ng/5qpphd450nb_5gpsq9_cbyy40000gn/T/opencode/mail0-tunnel.token`;
logs are alongside it in `mail0-tunnel.log`. To restart while that token file exists:

```sh
cloudflared tunnel --no-autoupdate run --token-file /var/folders/ng/5qpphd450nb_5gpsq9_cbyy40000gn/T/opencode/mail0-tunnel.token
```

The token is a credential and is not committed. Service-account credentials live
in ignored `.env`/`.dev.vars` files. A live Gmail watch and authenticated Pub/Sub
delivery through the tunnel were verified, including successful local queue
processing. Gmail can emit numeric history IDs in notifications; the parser
normalizes safe integer IDs to strings before queue admission.

## Remaining architecture work

- Synthetic app-label operations still use their existing provider-specific paths.
  Gmail provider-wide spam cleanup now uses durable enumeration and label admission.
  Per-thread/bulk-selected trash, spam,
  importance, and Gmail custom-label actions use the durable label outbox.
- Automatic recovery after OAuth reconnect and a detailed action-level retry view.

## Shared Gmail quota control

`GmailQuota` is one SQLite Durable Object per OAuth project number, shared by all
mailbox workers. The SDK OAuth transport gates every Gmail resource request,
including search, counts, labels, drafts, sends, and attachment downloads. The
raw subscription-provisioning watch call uses the same gate. OAuth token requests
and People API calls are outside the Gmail quota and are not charged.

Reservations atomically charge project and mailbox usage in second buckets over
a conservative rolling minute. A rejected request is not sent and consumes no
quota. Per-mailbox keys use the normalized connected Gmail address, not the app
user ID, so multiple app users linked to one mailbox share its allowance.

Defaults are 960,000 project units and 4,800 mailbox units per minute (80% of
Google's current published 1,200,000/6,000 limits). Configure
`GMAIL_PROJECT_QUOTA_PER_MINUTE` and `GMAIL_MAILBOX_QUOTA_PER_MINUTE` to lower these
budgets; values are capped at the published limits. Costs follow the current
[quota table](https://developers.google.com/workspace/gmail/api/reference/quota),
including 40 units for `threads.get` and 20 for message/attachment fetches.
Unknown Gmail methods conservatively cost 100 units. Upload/send URLs are covered.

Foreground requests can use the whole configured budget; live sync has 90% and
backfill 70%. This reserves headroom for user actions even when imports saturate
capacity. These are admission reserves, not a distributed FIFO ordering promise.
Foreground reads/search also share the foreground pool with mutations.

Persisted in-flight leases enforce a shared per-mailbox concurrency ceiling of
8 and project ceiling of 128. Backfill can use only 4/96 slots; live sync 6/112.
Leases are released on completion, and expire after two minutes if a worker dies.
Foreground calls may wait up to two seconds for a concurrent slot; durable sync
work defers instead. Folder-count label requests are bounded to four at a time.
Concurrency errors explicitly referring to a user cool down that mailbox rather
than pausing the entire project, even when Google uses `rateLimitExceeded`.

`userRateLimitExceeded` and unclassified 429s publish a mailbox cooldown.
Project-rate/quota errors publish a project-wide cooldown. `Retry-After` is a
minimum and persisted cooldowns never shorten an existing pause. SDK retries are
disabled; OAuth's bounded reauthorization retries still pass through admission.

Quota denials become durable deferrals without incrementing provider-failure
attempts. Backfill has a separate pause so denied historical imports do not block
live jobs. Effect failure wrappers are unwrapped before classifying errors.

The sync-status component remains unmounted. Authenticated endpoints expose
stored/discovered totals, remaining threads, queued/confirming changes, and pauses.
`mail.syncStatus` is authenticated and only returns the
active mailbox's state plus aggregate project capacity. Socket status events and
reconnect/focus refresh it; there is no browser polling timer or fetching bar.

Wrangler includes the binding/migration for local/staging (`v8`) and production (`v9`).
This change is run locally; a dry-run build does not deploy the remote migration.

Do not treat a successful local RPC or queue admission as confirmation from Gmail.
Do not advance history cursors before recording the work durably.

## Verification

### Local runtime recovery (2026-10-11)

The backend health timeout was reproduced. The previous backend log ended in a
workerd/V8 fatal error: `Missing deoptimization information for
OptimizedJSFrame::Summarize`. The remaining process still listened on port 8787
but health requests timed out. This is evidence of a runtime crash; it does not
establish which application operation triggered the engine failure.

Restarting the existing Wrangler 4.22.0 development server restored `/health`
without clearing SQLite/R2 state. Local health returned HTTP 200 in about 18 ms;
the tunnel health returned HTTP 200 in about 203 ms. An authenticated, wrapped
push probe for the existing mailbox returned HTTP 200 and its queue message was
acknowledged. Persisted recovery schedules executed after mailbox activation,
and the thread import interrupted by the crash completed successfully.

During resumed imports, 48 health requests in batches of eight over one minute
all returned HTTP 200. Shared quota accounting subsequently showed 2,200 project
units in the rolling minute, zero remaining leases, and no active cooldowns.
All 53 backend tests listed below and five frontend tests passed again.

Recovery is verified, but a permanent fix for the engine crash is not yet
established. The recovery runtime log is outside
the repository at `/var/folders/ng/5qpphd450nb_5gpsq9_cbyy40000gn/T/opencode/mail0-backend-recovery.log`.

### Quota load validation and runtime upgrade (2026-10-11)

Wrangler was upgraded from 4.22.0 to 4.149.0, which bundles workerd
1.20261006.1 instead of the June 2025 engine. Its removed
`--experimental-vectorize-bind-to-prod` flag was replaced with `remote: true`
on the two local Vectorize bindings. The existing compatibility date is retained.
The new runtime starts with the existing persisted mailbox and quota data, and
the Worker dry-run build succeeds. The original fatal crash has not been tied
to a specific upstream fix.

Live validation temporarily used a **400-unit mailbox budget** supplied through
Wrangler's `--var`, while approximately 40,000 backfill imports remained pending:

- Eight concurrent cached-thread reads completed in 126 ms; 49 folder counts
  were returned successfully.
- A durable star change was admitted in 27 ms and confirmed by an independent
  Gmail read after 2.164 seconds. The original uniform message-level star state
  was restored and confirmed in Gmail. Both outbox confirmations subsequently
  cleared.
- Backfill quota denials were observed, followed by automatic resumption as
  rolling-minute capacity returned. In a 90-second check, pending imports fell
  from 39,981 to 39,975. Nine additional batches of eight cached reads completed
  in 96–173 ms, with all health checks returning HTTP 200.
- Live history advanced from `4912824` to `4912886`, processed notification
  revision advanced from 27 to 28, and history retry attempts remained zero.
- No V8 fatal error occurred during these checks. The newer runtime also reports
  undisposed RPC-stub warnings; broader stub lifecycle cleanup remains follow-up
  work rather than evidence that the original crash is permanently fixed.

The temporary quota override was removed, and the standard development command
was restarted with the default 4,800-unit mailbox budget. Imports resumed from
persisted state. A transient history retry after restart was cleared through the
authenticated `mail.retryMailboxSync` endpoint; final status had no error,
queued changes, confirming changes, or blocked work. Tunnel health returned 200.
Validation used temporary local test sessions that were removed after each run.

Two additional request-gate tests use real SQLite quota storage to verify
backfill/live/foreground admission, timed resumption, foreground concurrency
waiting, and lease cleanup after successful and failed requests. The combined
suite now has **55 backend and five frontend tests passing**. Full backend
typechecking remains blocked by the previously recorded repository/dependency
errors. No remote Worker migrations have been deployed.

Load and upgraded-runtime logs are outside the repository alongside the recovery
log, named `mail0-quota-load-runtime.log` and `mail0-backend-upgraded.log`.

### Remaining per-thread label actions (2026-10-11)

Gmail delivery was independently verified for explicit importance toggles,
an existing custom label, spam moves, bulk trash, and restoration of the original
label state. The spam overlay was also verified through the cached-thread RPC.
An uncached pre-2024 thread was imported on demand, changed in importance, and
restored successfully. No test labels were created, and the validation messages'
original affected label state was restored.

The first live bulk-trash restore exposed a real stale-state issue: the old RPC
added only `TRASH`, while Gmail implicitly removed `INBOX`. The durable path now
records that removal, and bulk trash uses the shared trash action. Delivery
acknowledgments retain their overlays until matching label history or a fresh
snapshot confirms them; unrelated deltas cannot clear them. Regression coverage
includes rapid trash/restore before history catch-up, independent custom-label
and importance retries, draft exclusion, and repeated delivered intents.

The frontend refreshes thread/list caches before settling importance and custom
label optimistic actions, just as it does for read, star, and moves.
The final suite has **62 backend and five frontend tests passing**. Formatting,
targeted lint, and the Worker dry-run build passed. Backend and frontend full
typechecks still report the existing repository/dependency errors. After an
explicit retry following development reloads, sync status had zero queued,
confirming, or blocked changes, and local health returned HTTP 200.

### Storage-backed folder counts (2026-10-11)

`MailCountStore` persists count snapshots and the label-ID/name catalogue in each
mailbox's SQLite storage. Concurrent cold requests share one provider fetch.
While initial imports or reconciliation jobs remain, it preserves complete Gmail
totals rather than showing counts from only the imported subset. Snapshots have
a five-minute TTL; an advanced history cursor can refresh them after a minimum
30 seconds. Failed refreshes retain the previous totals and persist a 30-second
retry backoff, including across restarts. With no prior snapshot, callers receive
an error during that backoff rather than a false zero count.

After mailbox enumeration is complete, all import/verification/deletion jobs are
drained, and every stored thread has message-label coverage, counts are derived
locally from effective per-message labels. Pending outbox additions/removals are
applied before aggregation. Unread counts are distinct threads with an unread
message carrying the counted label; drafts and sent use thread totals. Archive
uses non-draft threads without inbox/spam/trash membership. The latest complete
local totals are persisted for temporary gaps while new threads import.

Label metadata is reused from existing label-list requests and count snapshots.
A local-only mailbox refreshes metadata at most every 15 minutes, with failure
backoff. Label creation, rename, and deletion invalidate the caches. Cached
provider counts use the current catalogue names and omit deleted labels.
No browser timer was introduced, and other providers retain their existing count
implementation.

Live validation during roughly 39,000 pending imports returned 49 count rows.
The first snapshot fetch took 5.085 seconds, then 16 concurrent count requests
returned identical results in 138 ms. After a backend restart, the first count
request took 33 ms and another 16 requests completed in 208 ms. The persisted
snapshot timestamp and cursor were unchanged, verifying that the restart reused
the snapshot rather than performing another Gmail count fan-out. The fully local
path is covered with real SQLite fixtures because the live mailbox is still
backfilling.

Count tests cover coverage gating, message-scoped unread semantics, pending
changes, drafts/sent/archive, deletion, cold request coalescing, persistence,
refresh throttling, invalid snapshots, failure backoff, and label rename/deletion.
The suite now has **72 backend and five frontend tests passing**. Formatting,
targeted lint, and the Worker dry-run build pass; full backend typechecking remains
blocked by the existing errors. Final sync status after retry had no error or
queued/confirming/blocked changes, and tunnel health returned HTTP 200. Count
runtime logs are outside the repository in `mail0-counts-runtime.log` alongside
the earlier validation logs.

### Search membership caching (2026-10-11)

`MailSearchStore` persists Gmail search-result thread IDs, history IDs, and opaque
pagination tokens for 30 seconds in each mailbox's SQLite storage. It stores no
provider snippets or message bodies; opening results continues to reuse the
existing SQLite/R2 thread cache and deduplicated cold imports. Cold requests for
the same search/page share one provider call. Queries retain quoted/internal
whitespace and case. Cache identity includes folder, query, page size, the
canonical label-ID set, and page token. Storage is bounded to 128 recent pages,
and expired pages are pruned on new fetches.

History cursor/notification revisions and reconciliation state fence cached
membership. Durable label admission and delivery each invalidate the persistent
search revision, as do direct sends, deletes, spam cleanup, draft creation, and
label creation/rename/deletion. An older in-flight response cannot repopulate a
cache invalidated by a newer action. Ordinary backfill imports do not invalidate
searches: importing old message bodies does not change Gmail search membership.
Errors are propagated without caching them or serving a stale page as if it were
fresh. Gmail remains authoritative for arbitrary query predicates; pending
actions trigger another invalidation after actual provider delivery. Empty-query
folder lists and other providers retain their existing paths, and draft-folder
searches continue through the separate drafts path.

Live validation: a cold five-result search took 258 ms, then 16 identical cached
requests completed in 177 ms. All five result bodies were already cached and
returned in 69 ms. A second page and its cached replay matched. A targeted
starred-message search was cached, changed through the durable star action,
verified against Gmail, then restored; both membership transitions were observed
correctly. The original star state was restored. SQLite tests additionally cover
restart persistence, query/page isolation, cross-mailbox isolation, invalidation
races, TTL expiry, error handling, and bounded growth.
Final checks: **78 backend and five frontend tests pass**, along with formatting,
targeted lint, the diff whitespace check, and Worker dry-run build. Full backend
typechecking still reports the existing repository/dependency errors. Final sync
status after retry had no error or queued/confirming/blocked changes, and tunnel
health returned HTTP 200. Changes remain local and uncommitted.

### Draft and attachment caching (2026-10-11)

`MailDraftStore` persists draft details for five seconds and draft-list pages for
ten seconds in mailbox-scoped SQLite storage. Identical requests coalesce, and
query/page/size identity remains separate. SuperJSON preserves dates and other
DTO types. Draft creation/update, send, and message deletion invalidate the
persistent revision; history revisions and short TTLs catch external edits.
Invalidation fences older in-flight results. The cache is bounded to 128 entries.
DTOs larger than one MiB of UTF-8 bypass SQLite caching while remaining readable,
so drafts containing large base64 attachments cannot exceed SQLite row limits.

Gmail draft-list hydration is bounded to four concurrent requests. A draft deleted
during enumeration can be skipped on HTTP 404; quota/transient failures propagate
instead of producing a cacheable incomplete list. SDK retries are disabled for
the new read paths, which still pass through shared quota admission.

`MailAssetCache` stores immutable attachment base64 bytes and attachment MIME
inventories in the existing R2 bucket under `mail-assets/v1/` hashed keys. Keys
include the authenticated user/mailbox, data kind, message ID, and attachment ID.
Concurrent misses coalesce. Every Google driver attachment read—including draft
parsing and inline images during thread imports—uses this cache. Draft updates
replace Gmail's underlying message ID, so new bytes do not reuse old keys.
Metadata caching stores attachment descriptors rather than email bodies. Failed
downloads/missing values are not cached, and unavailable R2 reads/writes fall back
to successful provider downloads. Legitimate empty bytes/empty inventories are
cacheable. Existing assembled attachment responses are preserved.

Live validation downloaded two existing attachments in 353 ms; eight cached
requests returned identical bytes and metadata in 108 ms. A later request reused
those objects in 26 ms. Eight temporary-draft detail requests took 53 ms, and
eight list requests took 92 ms. Updating that temporary draft immediately changed
both detail and list results. The temporary draft was deleted afterward; nothing
was sent and existing drafts were not edited. Tests cover draft persistence,
expiry, typed serialization, invalidation races, failures, large UTF-8 bodies,
bounded growth, and attachment persistence/coalescing/mailbox isolation/failover.
After recreating the Gmail driver through explicit retry, the same two attachment
files returned from persisted R2 in 23 ms; eight requests completed in 63 ms.
Final checks: **89 backend and five frontend tests pass**, with formatting,
targeted lint, the diff whitespace check, and Worker dry-run build passing.
Full backend typechecking still reports the existing repository/dependency
errors. Final sync status had no error or queued/confirming/blocked changes;
tunnel health returned HTTP 200. Changes remain uncommitted and undeployed.

### Clear initial-import progress (2026-10-11)

The mailbox header now distinguishes discovering threads, importing older mail,
Gmail-capacity pauses, temporary retryable errors, blocked work, and unavailable
status. During import it shows stored/discovered totals, an integer percentage,
and remaining threads, while explaining that Mail0 can still be used. Progress
stays visible during label delivery. Reconciliation/discovery does not pretend
the complete total is known, unfinished work never rounds to 100%, and completed
idle sync remains quiet. Retry times are absolute local times rather than a
browser-driven countdown.

`remainingThreads` excludes pending verification jobs for already stored threads
and deletion jobs, while including blocked unimported work. The live validation
reported 8,224 stored and 37,550 remaining (45,774 discovered), rather than adding
duplicate jobs to the denominator. The new lookup uses an index on
`threads(thread_id)`; a live slow-query check caught the missing index before
completion. Progress continues to update through existing socket/focus/reconnect
events; no browser polling interval, fetching bar, or manual refresh button was
added.

Authenticated browser checks at 1,200px and 390px confirmed the two-line status
is visible, wraps without horizontal overflow, and produces no page errors.
Tests cover accurate remaining-thread accounting, discovery, quota/error versus
ordinary scheduling, concurrent label delivery, reauthorization guidance, and
completion/percentage handling.
Final verification: **90 backend and ten frontend tests pass**, along with
formatting, targeted lint, whitespace checks, and Worker dry-run build. The live
query plan uses the covering thread-identity index; final local health returned
HTTP 200 in 2.3 ms. Sync status had no error or blocked/queued/confirming changes.
Full typechecks remain blocked by the existing repository errors. All changes
remain uncommitted and undeployed.

### Reliability and deployment readiness (2026-10-12)

The reload failure was traced to construction-time Agents alarms accessing
PartyServer's in-memory mailbox name before it was restored. Mailbox identity is
now persisted in SQLite and available to those callbacks. Auth initialization is
coalesced, socket stubs are initialized once, and base transient backoff is capped
at 60 seconds plus jitter (provider `Retry-After` remains a lower bound). Progress broadcast failures
cannot prevent recovery scheduling. DTO RPC clients now acquire/dispose each target
per invocation and copy/dispose returned values before exposing them to callers.

A 30-minute live soak from 06:16:49 to 06:46:47 UTC completed 119 batches of eight
cached reads: **952 fulfilled, zero rejected**, with all sampled health responses
HTTP 200. Stored threads increased **9,852 → 10,737** and remaining threads fell
**35,922 → 35,037**. Batch elapsed time, including health/status requests, had
**602 ms p95** (93–2,714 ms range, including development reloads). Forty-five batches
used a temporary 400-unit mailbox budget; imports paused and resumed as rolling
capacity returned. The previous transient retry and five confirming operations
cleared automatically; no retry RPC was used. SQLite inspection showed zero quota
leases after the pause. The standard 4,800-unit budget was restored afterward.
This is stronger recovery evidence, not proof of a permanent upstream engine fix.

Provider-wide Gmail spam cleanup now persists discovery pages and deduplicated
targets before changing membership, then admits versioned label intents. Target
acknowledgment and intent admission commit together. A persisted move-order clock
protects newer user restores, including no-ops and already confirmed intent. Cleanup
continuations are deduplicated, and outbox recovery is reinstalled before admission
after a long discovery. Controlled provider-wide live cleanup remains a release gate;
the implementation session did not empty the user's real spam folder.

`SNOOZED` and app `MUTE` state are stored separately at thread scope. Provider history,
full snapshots, durable actions, and restart preserve this state; synthetic IDs never
enter Gmail batches. Mixed snooze/restore operations admit the provider and app state
atomically. Existing label-name resolution remains separate. Live snooze/mute state
survived a provider action/history pass, then the original inbox/star/app state was restored.

Count snapshots throttled after a history change now register a durable deferred
refresh and a retryable count notification. This prevents the only browser invalidation
from being consumed before the provider refresh deadline. External draft detail/list
queries invalidate on notifications and catch-up, including hour-fresh browser caches.
Quota/transient inline attachment errors propagate to import retry instead of caching
an incomplete assembled body; a missing attachment's 404 does not tombstone its thread.
External edits to a temporary draft refreshed detail/list after 11 seconds, and persisted
attachment bytes were reused after restart. The temporary draft was deleted; nothing was sent.

Both application typechecks and repository format/lint checks pass. Pinned React Doctor
is integrated in `pnpm check`, with zero error-level findings; advisory warnings remain
available through `pnpm check:react:json`. React Router and the Cloudflare Vite plugin
were updated together to compatible versions. **115 backend and 12 frontend tests pass**.
Authenticated browser checks at 1,200px and 390px show no page errors or horizontal
overflow, and no sync-status text. Staging/production backend and production frontend
dry runs pass. All edits remain uncommitted and no remote migration was deployed.

See [DEPLOYMENT.md](./DEPLOYMENT.md) for exact environment/build/deploy commands,
cache lifecycle setup, smoke tests, rollback compatibility, and remaining live gates.
The inspected production Worker is at `v8`; quota adds `v9`. Staging's Worker is not
yet provisioned in the inspected account. Completed-mailbox count parity is still
pending initial import completion; local fixture tests are not a substitute for that gate.

Run from the repository root:

```sh
pnpm check
pnpm test
```

Storage tests execute real SQLite transactions through Node's `node:sqlite`
(Node 22.13+), including rollback, pending overlays, stale acknowledgment,
reconstruction, batch limits, draft exclusion, and mailbox cooldown. Error tests
exercise rate-limit classification, revoked credentials, and retry headers.
History tests cover crash rollback, cursor/job atomicity, mid-sync notifications,
snapshot restart, retry cooldowns, and active/inactive polling. Push tests verify
payloads and real JWT signatures with a local test key instead of Google's remote
JWKS. They do not make live Gmail calls or verify Cloudflare alarm execution.
UI tests use the actual Jotai store and TanStack Query cache, including an
hour-fresh cached thread with the application's mailbox-scoped hash function.
They cover pending-action settlement and reconnect invalidation after a missed
unread event.
