import { evalite } from "evalite";
import { perplexity } from "@ai-sdk/perplexity";
import { streamText } from "ai";
import { traceAISDKModel } from "evalite/ai-sdk";
import { Factuality, Levenshtein } from "autoevals";
import { AiChatPrompt, GmailSearchAssistantSystemPrompt, StyledEmailAssistantSystemPrompt } from "../src/lib/prompts";

// add ur own model here 
const model = traceAISDKModel(perplexity("sonar"));

// error handling incase llm fails 
const safeStreamText = async (config: Parameters<typeof streamText>[0]) => {
  try {
    const res = await streamText(config);
    return res.textStream;
  } catch (err) {
    console.error("LLM call failed", err);
    return "ERROR";
  }
};

/** 
 * basic tests to cover all major capabilities, avg score is 30%, anything above is goated:
 * - mail search and filtering
 * - label management and organization  
 * - bulk operations (archive, delete, mark read/unread)
 * - email composition and sending
 * - smart categorization (subscriptions, newsletters, meetings)
 * - web search integration
 * - user interaction patterns
 */


// forever todo: make the expected output autistically specific 

evalite("AI Chat – Basic Responses", {
  data: async () => [
    { input: "Hello!", expected: "Hello" },
    { input: "What is ZeroMail?", expected: "email" },
    { input: "Help me organize my inbox", expected: "organize" },
    { input: "What can you do?", expected: "email" },
  ],
  task: async (input) => {
    return safeStreamText({
      model: model,
      system: AiChatPrompt("test-thread-id", "inbox", ""),
      prompt: input,
    });
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
    return safeStreamText({
      model: model,
      system: AiChatPrompt("test-thread-id", "inbox", ""),
      prompt: input,
    });
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
    return safeStreamText({
      model: model,
      system: AiChatPrompt("test-thread-id", "inbox", ""),
      prompt: input,
    });
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
    return safeStreamText({
      model: model,
      system: AiChatPrompt("test-thread-id", "inbox", ""),
      prompt: input,
    });
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
    return safeStreamText({
      model: model,
      system: AiChatPrompt("test-thread-id", "inbox", ""),
      prompt: input,
    });
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
    return safeStreamText({
      model: model,
      system: AiChatPrompt("test-thread-id", "inbox", ""),
      prompt: input,
    });
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
    return safeStreamText({
      model: model,
      system: AiChatPrompt("test-thread-id", "inbox", ""),
      prompt: input,
    });
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
    return safeStreamText({
      model: model,
      system: AiChatPrompt("test-thread-id", "inbox", ""),
      prompt: input,
    });
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
    return safeStreamText({
      model: model,
      system: AiChatPrompt("test-thread-id", "inbox", ""),
      prompt: input,
    });
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
    return safeStreamText({
      model: model,
      system: AiChatPrompt("test-thread-id", "inbox", ""),
      prompt: input,
    });
  },
  scorers: [Factuality, Levenshtein],
});

evalite("Gmail Search Query Building", {
  data: async () => [
    { input: "emails from last week", expected: "after:" },
    { input: "unread messages", expected: "is:unread" },
    { input: "emails with attachments", expected: "has:attachment" },
    { input: "emails from john@example.com", expected: "from:john@example.com" },
    { input: "emails about meetings", expected: "meeting" },
    { input: "emails in spam folder", expected: "in:spam" },
    { input: "emails with subject invoice", expected: "subject:invoice" },
    { input: "emails from canva", expected: "from:canva.com OR from:canva OR canva" },
  ],
  task: async (input) => {
    return safeStreamText({
      model: model,
      system: GmailSearchAssistantSystemPrompt(),
      prompt: input,
    });
  },
  scorers: [Factuality, Levenshtein],
});

evalite("Email Composition with Style Matching", {
  data: async () => [
    { input: "Write a professional follow-up email", expected: "follow-up" },
    { input: "Compose a thank you email", expected: "thank you" },
    { input: "Draft a meeting request", expected: "meeting" },
    { input: "Write a casual check-in email", expected: "check-in" },
    { input: "Compose an apology email", expected: "apology" },
  ],
  task: async (input) => {
    return safeStreamText({
      model: model,
      system: StyledEmailAssistantSystemPrompt(),
      prompt: input,
    });
  },
  scorers: [Factuality, Levenshtein],
}); 