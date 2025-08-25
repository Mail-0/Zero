# Zero Agent API and Tools

This document summarizes how the Zero Mail Agent (Durable Object) interacts with emails and exposes Zero-specific tools to AI models.

## Overview

- The agent facade is implemented in `apps/server/src/routes/agent/index.ts` as the Durable Object `ZeroDriver`.
- The AI-callable tools are defined in `apps/server/src/routes/agent/tools.ts` and orchestrated for streaming in `apps/server/src/routes/agent/orchestrator.ts`.
- Gmail provider logic (including attachment handling) lives in `apps/server/src/lib/driver/google.ts`.

## Agent (ZeroDriver) capabilities

File: `apps/server/src/routes/agent/index.ts`

- Connection/Auth
  - `setName(name)` → initializes connection context and auth via `setupAuth()`.
  - `setupAuth()` → obtains provider `driver` and agent stub for the given connection.

- Sync and listing
  - `syncFolders()` → triggers inbox syncing workflows under thresholds.
  - `syncThread({ threadId })` → delegates to `THREAD_SYNC_WORKER`, updates DB (table `threads`) and object storage (R2), broadcasts UI updates.
  - `rawListThreads({ folder, query?, maxResults?, labelIds?, pageToken? })` → proxies to `driver.list()` (server-side paging/filters).
  - `listHistory<T>(historyId)` → proxies to `driver.listHistory<T>()` (Gmail History API).

- Thread/data access
  - `getThread(threadId, includeDrafts?)` → reads mirrored thread from local DB/R2 (not a direct Gmail fetch).
  - `getMessageAttachments(messageId)` → on-demand fetch of attachment bytes via `driver.getMessageAttachments(messageId)` (Gmail `users.messages.attachments.get`).

- Labels and bulk actions
  - `modifyLabels(threadIds, addLabelIds, removeLabelIds)` → proxies to `driver.modifyLabels()`.
  - `getUserLabels()` / `getLabel(id)` → label read APIs.
  - `createLabel({ name, color? })` / `updateLabel(id, label)` / `deleteLabel(id)` → label management.
  - `bulkDelete(threadIds)` → add `TRASH`, remove `INBOX`.
  - `bulkArchive(threadIds)` → remove `INBOX`.

- Drafts and sending
  - `createDraft(draftData)` / `getDraft(id)` / `listDrafts(params)` / `deleteDraft(id)`.
  - `create(data)` → send a new message.
  - `sendDraft(id, data)` → send an existing draft.

- Maintenance and counts
  - `delete(id)` (provider-level), `deleteThread(id)` (local DB + broadcast), `deleteAllSpam()`.
  - `count()` → folder counts from `threads` table.
  - `forceReSync()` → drops local tables and resyncs.
  - `normalizeIds(ids)` → provider ID normalization.

## Attachment handling

- During sync, only attachment metadata is persisted inside mirrored threads (filename, mimeType, size, `attachmentId`, headers). Attachment bodies are not stored.
  - Implemented in `apps/server/src/lib/driver/google.ts` inside the thread fetch path (e.g., `get(id)` builds `attachments` with `body: ''`).
- When attachment bytes are requested, `ZeroDriver.getMessageAttachments(messageId)` calls `driver.getMessageAttachments(messageId)`, which uses Gmail `users.messages.attachments.get` to return binary data.
- Inline images referenced by `cid:` may be inlined as base64 data URLs into the processed HTML body during parsing (driver logic in `google.ts`).

## AI tools (Zero-specific)

File: `apps/server/src/routes/agent/tools.ts`

- Thread access and summaries
  - `Tools.GetThread` → returns placeholder tag `<thread id="..."/>` to avoid overloading context.
  - `Tools.GetThreadSummary` → fetches thread basics and optionally shortens a Vectorize-provided summary via Workers AI (env-guarded).

- Composition and sending
  - `Tools.ComposeEmail` → AI-assisted drafting via `composeEmail()` with `connectionId` context.
  - `Tools.SendEmail` → sends a new email or an existing draft by calling agent DO (`create`/`sendDraft`).

- Labeling and triage
  - `Tools.MarkThreadsRead` / `Tools.MarkThreadsUnread` → flips `UNREAD` via `agent.modifyThreadLabelsInDB(...)`.
  - `Tools.ModifyLabels` → add/remove label names on threads via `agent.modifyThreadLabelsInDB(...)`.
  - `Tools.BulkDelete` → adds `TRASH`.
  - `Tools.BulkArchive` → removes `INBOX`.

- Label management
  - `Tools.GetUserLabels` → reads labels via agent.
  - `Tools.CreateLabel` → creates label with validated Zero color palette.
  - `Tools.DeleteLabel` → deletes label by id.

- Search and helpers
  - `Tools.BuildGmailSearchQuery` → uses Gemini to translate NL → Gmail query syntax.
  - `Tools.GetCurrentDate` → returns current date context.
  - `Tools.WebSearch` → Perplexity-backed web search.
  - `Tools.InboxRag` → calls `agent.searchThreads({ query, maxResults, folder })`, returns only `threadIds`.

Note: Tool implementations often call `getZeroAgent(connectionId)` to reach the Durable Object and perform mailbox operations.

## Tool orchestration and streaming

File: `apps/server/src/routes/agent/orchestrator.ts`

- `ToolOrchestrator` wraps tools that should stream results directly into the UI.
- Streaming tools: `Tools.WebSearch`, `Tools.InboxRag`.
  - For `WebSearch`, streams Perplexity output via `streamText()` and returns a placeholder result for the tool call.
  - For `InboxRag`, exposes parameters `{ query, folder='inbox', maxResults=10 }` and returns `threadIds`.

## References

- Agent DO: `apps/server/src/routes/agent/index.ts`
- Tools: `apps/server/src/routes/agent/tools.ts`
- Orchestrator: `apps/server/src/routes/agent/orchestrator.ts`
- Gmail driver (attachments): `apps/server/src/lib/driver/google.ts`
- Attachments helper for outgoing mail: `apps/server/src/lib/attachments.ts`
