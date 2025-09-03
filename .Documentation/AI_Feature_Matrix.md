# AI Feature Matrix

This document provides a compact overview of the core AI features, their purpose, and key implementation points in the codebase.

| Feature | Purpose & Key Files | Code References (File:line) |
| :--- | :--- | :--- |
| **Agent Chat UI** | Renders chat UI, handles user input, and displays streaming responses & tool outputs. | `apps/mail/components/create/ai-chat.tsx` |
| | _Submit Handler_ | `ai-chat.tsx:239-246` |
| | _Render Messages/Tools_ | `ai-chat.tsx:291-351` |
| | _Billing Gate_ | `ai-chat.tsx:264-273` |
| **Agent Connection** | Establishes and manages the WebSocket connection to the `ZeroAgent` Durable Object. | `apps/mail/components/ui/ai-sidebar.tsx` |
| | _`useAgent` Hook_ | `ai-sidebar.tsx:387-393` |
| | _`useAgentChat` Hook_ | `ai-sidebar.tsx:395-466` |
| **Request Handling (Server)** | Receives WebSocket messages, broadcasts user messages, persists them, and orchestrates the AI response. | `apps/server/src/routes/agent/index.ts` |
| | _`onMessage` Handler_ | `index.ts:1840+` |
| | _Broadcast & Persist_ | `index.ts:1865-1872` |
| | _Chat Processing_ | `index.ts:1877-1891` |
| **Tool Orchestration** | Prepares the tool stack (MCP + Auth), processes tool calls, and injects them into the model context. | `apps/server/src/routes/agent/index.ts` |
| | _Tool Assembly_ | `index.ts:1756-1763` |
| | _Tool Call Processing_ | `index.ts:1764-1771` |
| **Model & Prompt** | Selects the language model based on environment variables and constructs a context-aware system prompt. | `apps/server/src/routes/agent/index.ts` |
| | _Model Selection_ | `index.ts:1773-1777` |
| | _System Prompt_ | `index.ts:1787-1791` |
| **Response Streaming** | Streams the AI response back to the client in chunks, including text and tool calls. | `apps/server/src/routes/agent/index.ts` |
| | _`streamText` Call_ | `index.ts:1778-1795` |
| | _Reply/Broadcast Loop_ | `index.ts:1969-1982` |
| **Client-Side Effects** | Handles side effects for tool calls (cache invalidation, analytics) and lifecycle events. | `apps/mail/components/ui/ai-sidebar.tsx` |
| | _`onToolCall` Handler_ | `ai-sidebar.tsx:429-466` |
| | _`onResponse`/`onError`_ | `ai-sidebar.tsx:406-428` |
| **Abort & State Sync** | Manages request cancellation and ensures state consistency on connection/reconnection. | `apps/server/src/routes/agent/index.ts` |
| | _Abort Logic_ | `index.ts:1809-1838` |
| | _Initial State Sync_ | `index.ts:1731-1737` |
| **Email Summarization** | Provides automatic (server-side) and on-demand (client-tool) summaries of email threads. | |
| | _Automatic Workflow_ | `apps/server/src/thread-workflow-utils/workflow-functions.ts` |
| | _On-Demand Tool Logic_ | `apps/mail/lib/elevenlabs-tools.ts:289-325` |
| | _UI Display_ | `apps/mail/components/mail/mail-display.tsx:309-341` |
| | _Frontend Hook_ | `apps/mail/hooks/use-summary.ts:4-16` |
| | _Server Endpoint_ | `apps/server/src/trpc/routes/brain.ts:31-72` |
| | _Tool Registration_ | `scripts/register-elevenlabs-tools.ts:39-45` |

## Other AI-Powered Features

This table provides a higher-level overview of user-facing AI features.

| Feature | Description | Key Files & References |
| :--- | :--- | :--- |
| **AI-Powered Summaries** | Summarizes long email threads, providing concise overviews and highlighting key action items and urgency. | `apps/server/src/trpc/routes/brain.ts`, `apps/mail/components/mail/mail-display.tsx`, `apps/mail/hooks/use-summary.ts` |
| **AI-Assisted Composition** | Drafts, replies, and composes emails based on a prompt or previous conversation. | `scripts/register-elevenlabs-tools.ts` (ComposeEmail tool), `apps/server/evals/ai-chat-basic.eval.ts` |
| **Smart Categorization** | Uses AI to categorize emails (e.g., subscriptions, newsletters) to help organize the inbox. | `apps/server/evals/ai-chat-basic.eval.ts`, `apps/mail/components/home/HomeContent.tsx` |
| **AI Label Management** | Manages labels via natural language, including creating, deleting, listing, and applying labels. | `scripts/register-elevenlabs-tools.ts` (CreateLabel, DeleteLabel, ModifyLabels) |
| **Information Extraction** | Answers specific questions about emails or threads, extracting relevant information. | `MCP.md`, `apps/server/evals/ai-chat-basic.eval.ts` |
| **Web Search Integration** | Integrates Perplexity AI to answer queries that require external context. | `scripts/register-elevenlabs-tools.ts` (WebSearch tool) |
| **User Interest Analysis** | Identifies user topics and interests by analyzing email content to personalize inbox management. | `apps/server/src/lib/analyze/interests.ts` |
