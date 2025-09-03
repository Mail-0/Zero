 # AI Email Summarization Workflow

This document outlines the complete order of operations for the AI-powered email summarization feature, including the trigger conditions, filtering logic, and key components involved.

## Objective

The goal of this investigation was to understand how email thread summaries are generated, what conditions trigger their creation, and how the system avoids summarizing non-conversational emails like junk mail and newsletters to conserve API resources.

## High-Level Workflow

The email summarization process is an asynchronous workflow triggered by new email messages. It leverages a chain of workflows to process, filter, and summarize threads.

1.  **Queue Trigger**: A new email notification is sent to the `thread_queue`.
2.  **Pipeline Execution**: A pipeline defined in `pipelines.ts` consumes the message and initiates a series of workflows.
3.  **Filtering**: An initial workflow analyzes the email's intent to determine if it's a genuine conversation.
4.  **Summarization**: If the email passes the filter, a subsequent workflow generates and stores the summary.
5.  **Display**: The frontend fetches and displays the summary when a user views the thread.

## Detailed Filtering Logic

The key to preventing unnecessary API calls is a conditional execution step early in the workflow chain. The system does not summarize every email; it first qualifies them.

1.  **Entry Point**: The process begins in the `WorkflowRunner` Durable Object located in `apps/server/src/pipelines.ts`. The `runThreadWorkflow` function is called for each new thread update.

2.  **Workflow Registration**: Inside `runThreadWorkflow`, the `createDefaultWorkflows` function from `apps/server/src/thread-workflow-utils/workflow-engine.ts` registers all default workflows in a specific order. This order is critical for the filtering logic to function correctly:
    1.  `auto-draft-generation`
    2.  `message-vectorization`
    3.  `thread-summary`
    4.  `label-generation`

3.  **Chain Execution**: The `executeWorkflowChain` function is called, which runs each registered workflow sequentially.

4.  **Intent Analysis (`auto-draft-generation` workflow)**:
    *   The `auto-draft-generation` workflow runs first.
    *   It contains a step with the ID `analyze-email-intent`, which calls the `workflowFunctions.analyzeEmailIntent` function from `apps/server/src/thread-workflow-utils/workflow-functions.ts`.
    *   This function inspects the latest email for non-conversational markers, such as `Spam` tags or a `List-Unsubscribe` header.
    *   The result of this analysis (e.g., `{ isSpam: true }`) is stored in a shared context map that is passed to subsequent workflows.

5.  **Conditional Summarization (`thread-summary` workflow)**:
    *   The `thread-summary` workflow runs *after* the `auto-draft-generation` workflow.
    *   The `generateThreadSummary` function within this workflow checks the shared context for the flags set by `analyzeEmailIntent`.
    *   If the thread has been flagged as spam or non-conversational, the function returns early, and **no summary is generated**. This prevents the expensive AI call.

## Key Files and Components

*   **Main Pipeline**: `apps/server/src/pipelines.ts` (contains `WorkflowRunner` which orchestrates the process).
*   **Workflow Definitions**: `apps/server/src/thread-workflow-utils/workflow-engine.ts` (defines the sequence of workflows).
*   **Workflow Logic**: `apps/server/src/thread-workflow-utils/workflow-functions.ts` (contains the implementation of workflow steps, including `analyzeEmailIntent` and `generateThreadSummary`).
*   **Frontend Display**: `apps/mail/components/mail/mail-display.tsx` (the `AiSummary` React component).
*   **Frontend Data Hook**: `apps/mail/hooks/use-summary.ts` (fetches the summary from the backend).
*   **Backend Endpoint**: `apps/server/src/trpc/routes/brain.ts` (the `brain.generateSummary` tRPC procedure that serves the summary to the client).
