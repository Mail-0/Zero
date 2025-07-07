import { evalite } from "evalite";
import { openai } from "@ai-sdk/openai";
import { streamText } from "ai";
import { traceAISDKModel } from "evalite/ai-sdk";
import { Factuality, Levenshtein } from "autoevals";

/**
 * Comprehensive AI Chat evaluation for ZeroMail's email management assistant.
 * 
 * Tests cover all major capabilities:
 * - Email search and filtering
 * - Label management and organization  
 * - Bulk operations (archive, delete, mark read/unread)
 * - Email composition and sending
 * - Smart categorization (subscriptions, newsletters, meetings)
 * - Web search integration
 * - User interaction patterns
 */

evalite("AI Chat – Basic Responses", {
  data: async () => [
    { input: "Hello!", expected: "Hello" },
    { input: "What is ZeroMail?", expected: "email" },
    { input: "Help me organize my inbox", expected: "organize" },
    { input: "What can you do?", expected: "email" },
  ],
  task: async (input) => {
    const result = await streamText({
      model: traceAISDKModel(openai(process.env.OPENAI_MODEL || "gpt-4o-mini")),
      system: `You are ZeroMail's AI assistant. You help users manage their email efficiently with advanced Gmail operations like searching, labeling, archiving, and composing emails.`,
      prompt: input,
    });
    return result.textStream;
  },
  scorers: [Factuality, Levenshtein],
});

evalite("AI Chat – Email Search & Discovery", {
  data: async () => [
    { input: "Find emails from last week", expected: "search" },
    { input: "Show me unread messages", expected: "unread" },
    { input: "Find emails about meetings", expected: "meetings" },
    { input: "Search for emails with attachments", expected: "attachments" },
    { input: "Find emails from john@example.com", expected: "john" },
    { input: "Show me emails in the spam folder", expected: "spam" },
    { input: "Find emails with the subject 'invoice'", expected: "invoice" },
  ],
  task: async (input) => {
    const result = await streamText({
      model: traceAISDKModel(openai(process.env.OPENAI_MODEL || "gpt-4o-mini")),
      system: `You are ZeroMail's email assistant. When users ask to find or search emails, explain that you would use the listThreads tool to search their emails. Be helpful and specific about what you would search for.`,
      prompt: input,
    });
    return result.textStream;
  },
  scorers: [Factuality, Levenshtein],
});

evalite("AI Chat – Label Management", {
  data: async () => [
    { input: "Create a label called 'Work Projects'", expected: "label" },
    { input: "Label this email as urgent", expected: "urgent" },
    { input: "Show me all my labels", expected: "labels" },
    { input: "Delete the 'Old Projects' label", expected: "delete" },
    { input: "Add a follow-up label to these emails", expected: "follow" },
    { input: "Organize my newsletters with labels", expected: "newsletter" },
  ],
  task: async (input) => {
    const result = await streamText({
      model: traceAISDKModel(openai(process.env.OPENAI_MODEL || "gpt-4o-mini")),
      system: `You are ZeroMail's email assistant. You can create, apply, and manage Gmail labels. When users ask about labels, explain what actions you would take using tools like createLabel, modifyLabels, or getUserLabels.`,
      prompt: input,
    });
    return result.textStream;
  },
  scorers: [Factuality, Levenshtein],
});

evalite("AI Chat – Email Organization", {
  data: async () => [
    { input: "Archive all newsletters from last month", expected: "archive" },
    { input: "Mark all promotional emails as read", expected: "read" },
    { input: "Delete all emails from spam-domain.com", expected: "delete" },
    { input: "Mark important emails as unread", expected: "unread" },
    { input: "Bulk archive old notifications", expected: "bulk" },
  ],
  task: async (input) => {
    const result = await streamText({
      model: traceAISDKModel(openai(process.env.OPENAI_MODEL || "gpt-4o-mini")),
      system: `You are ZeroMail's email assistant. You can perform bulk operations like archiving, deleting, and marking emails as read/unread. Explain what tools you would use for organization tasks.`,
      prompt: input,
    });
    return result.textStream;
  },
  scorers: [Factuality, Levenshtein],
});

evalite("AI Chat – Email Composition", {
  data: async () => [
    { input: "Compose a follow-up email to John", expected: "compose" },
    { input: "Write a thank you email", expected: "thank" },
    { input: "Draft a meeting request email", expected: "meeting" },
    { input: "Send an email to team@company.com", expected: "send" },
    { input: "Reply to this email thread", expected: "reply" },
  ],
  task: async (input) => {
    const result = await streamText({
      model: traceAISDKModel(openai(process.env.OPENAI_MODEL || "gpt-4o-mini")),
      system: `You are ZeroMail's email assistant. You can compose and send emails using AI assistance. When users ask to write emails, explain that you would use the composeEmail or sendEmail tools.`,
      prompt: input,
    });
    return result.textStream;
  },
  scorers: [Factuality, Levenshtein],
});

evalite("AI Chat – Smart Categorization", {
  data: async () => [
    { input: "What subscriptions do I have?", expected: "subscription" },
    { input: "Show me all my newsletters", expected: "newsletter" },
    { input: "Find meeting invites for this week", expected: "meeting" },
    { input: "List all my recurring bills", expected: "bill" },
    { input: "Find emails with receipts", expected: "receipt" },
    { input: "Show me project updates", expected: "project" },
  ],
  task: async (input) => {
    const result = await streamText({
      model: traceAISDKModel(openai(process.env.OPENAI_MODEL || "gpt-4o-mini")),
      system: `You are ZeroMail's email assistant. You can categorize emails by type (subscriptions, newsletters, meetings, bills, receipts, projects). Explain how you would search for and categorize these email types.`,
      prompt: input,
    });
    return result.textStream;
  },
  scorers: [Factuality, Levenshtein],
});

evalite("AI Chat – Information Queries", {
  data: async () => [
    { input: "Search the web for email best practices", expected: "search" },
    { input: "What happened in my inbox this week?", expected: "summary" },
    { input: "Find the tax document from my accountant", expected: "tax" },
    { input: "Show me emails from the last 3 days", expected: "recent" },
    { input: "Summarize my unread emails", expected: "summarize" },
  ],
  task: async (input) => {
    const result = await streamText({
      model: traceAISDKModel(openai(process.env.OPENAI_MODEL || "gpt-4o-mini")),
      system: `You are ZeroMail's email assistant. You can search the web for information and summarize email activity. When users ask for information or summaries, explain what you would do to help them.`,
      prompt: input,
    });
    return result.textStream;
  },
  scorers: [Factuality, Levenshtein],
});

evalite("AI Chat – Complex Workflows", {
  data: async () => [
    { input: "Find all promotional emails and archive them with a 'Promotions' label", expected: "promotional" },
    { input: "Organize my inbox by creating labels for work, personal, and newsletters", expected: "organize" },
    { input: "Find emails from my boss and mark them as high priority", expected: "priority" },
    { input: "Delete all emails from marketing domains and unsubscribe", expected: "marketing" },
    { input: "Create a workflow to automatically label bills and receipts", expected: "workflow" },
  ],
  task: async (input) => {
    const result = await streamText({
      model: traceAISDKModel(openai(process.env.OPENAI_MODEL || "gpt-4o-mini")),
      system: `You are ZeroMail's email assistant. You can handle complex multi-step email organization workflows involving searching, labeling, archiving, and bulk operations. Break down complex requests into clear steps.`,
      prompt: input,
    });
    return result.textStream;
  },
  scorers: [Factuality, Levenshtein],
});

evalite("AI Chat – User Intent Recognition", {
  data: async () => [
    { input: "I'm overwhelmed with my inbox", expected: "help" },
    { input: "My email is a mess", expected: "organize" },
    { input: "I can't find that important email", expected: "search" },
    { input: "Too many newsletters cluttering my inbox", expected: "newsletter" },
    { input: "I need to clean up old emails", expected: "cleanup" },
    { input: "Help me achieve inbox zero", expected: "inbox zero" },
  ],
  task: async (input) => {
    const result = await streamText({
      model: traceAISDKModel(openai(process.env.OPENAI_MODEL || "gpt-4o-mini")),
      system: `You are ZeroMail's email assistant. You understand user frustrations and needs around email management. Provide empathetic, helpful responses that offer concrete solutions using your email management capabilities.`,
      prompt: input,
    });
    return result.textStream;
  },
  scorers: [Factuality, Levenshtein],
});

evalite("AI Chat – Error Handling & Edge Cases", {
  data: async () => [
    { input: "Delete everything in my inbox", expected: "careful" },
    { input: "Send email to invalid-email", expected: "invalid" },
    { input: "Create 100 new labels", expected: "many" },
    { input: "Find emails from 1990", expected: "old" },
    { input: "Label this email but I don't have any emails", expected: "no emails" },
  ],
  task: async (input) => {
    const result = await streamText({
      model: traceAISDKModel(openai(process.env.OPENAI_MODEL || "gpt-4o-mini")),
      system: `You are ZeroMail's email assistant. Handle potentially problematic requests carefully. For destructive actions, ask for confirmation. For invalid requests, explain what's wrong and suggest alternatives.`,
      prompt: input,
    });
    return result.textStream;
  },
  scorers: [Factuality, Levenshtein],
}); 