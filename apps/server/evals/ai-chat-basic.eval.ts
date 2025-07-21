import { evalite } from "evalite";
import { openai } from "@ai-sdk/openai";
import { streamText } from "ai";
import { traceAISDKModel } from "evalite/ai-sdk";
import { Factuality, Levenshtein } from "autoevals";
import { AiChatPrompt, GmailSearchAssistantSystemPrompt, StyledEmailAssistantSystemPrompt } from "../src/lib/prompts";
import { generateObject } from "ai";
import { z } from "zod";

// base model (untraced) for internal helpers to avoid trace errors
// add ur own model here 
const baseModel = openai("gpt-4o-mini");

// traced model for the actual task under test
const model = traceAISDKModel(baseModel);

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

// Dynamically builds a list of natural-language queries and their minimal expected Gmail-syntax 
const buildGmailSearchTestCases = async (): Promise<{ input: string; expected: string }[]> => {
  const { object } = await generateObject({
    model: baseModel,
    system: `You are a JSON test-case generator for Gmail search query conversions.
Return ONLY a JSON object with a single key "cases" mapping to an array. Each array element has exactly the keys {input, expected}.
Guidelines:
  • input – natural-language requests about searching/filtering email.
  • expected – a short Gmail-syntax fragment (e.g., "is:unread", "has:attachment", "after:") that MUST appear in a correct answer.
  • Cover diverse filters: sender, subject, attachments, labels, dates, read/unread.
  • Array length: 8-12.
  • No comments or additional keys.`,
    prompt: "Generate Gmail search conversion test cases",
    schema: z.object({
      cases: z.array(
        z.object({
          input: z.string().min(5),
          expected: z.string().min(3),
        }),
      ),
    }),
  });

  return object.cases;
};

// generic dynamic testcase builder 

type TestCase = { input: string; expected: string };

const makeAiChatTestCaseBuilder = (topic: string): (() => Promise<TestCase[]>) => {
  return async () => {
    const { object } = await generateObject({
      model: baseModel,
      system: `You are a JSON test-case generator for the topic: ${topic}.
      Return ONLY a JSON object with key "cases" whose value is an array of objects {input, expected}.
      Guidelines:
      • input – natural-language request related to ${topic}.
      • expected – short keyword (≤3 words) expected in correct assistant reply.
      • Array length: 6-10.
      • No extra keys or comments.`,
      prompt: `Generate ${topic} test cases`,
      schema: z.object({
        cases: z.array(
          z.object({
            input: z.string().min(5),
            expected: z.string().min(2),
          }),
        ),
      }),
    });

    return object.cases;
  };
};

evalite("AI Chat – Basic Responses", {
  data: makeAiChatTestCaseBuilder("basic responses (greetings, capabilities, quick help)"),
  task: async (input) => {
    return safeStreamText({
      model: model,
      system: AiChatPrompt("test-thread-id"),
      prompt: input,
    });
  },
  scorers: [Factuality, Levenshtein],
});

evalite("Gmail Search Query – Natural Language", {
  data: buildGmailSearchTestCases, 
  task: async (input) => {
    return safeStreamText({
      model: model,
      system: GmailSearchAssistantSystemPrompt(),
      prompt: input,
    });
  },
  scorers: [Factuality, Levenshtein],
});

evalite("AI Chat – Label Management", {
  data: makeAiChatTestCaseBuilder("label management (create, delete, list, apply labels)"),
  task: async (input) => {
    return safeStreamText({
      model: model,
      system: AiChatPrompt("test-thread-id"),
      prompt: input,
    });
  },
  scorers: [Factuality, Levenshtein],
});

evalite("AI Chat – Email Organization", {
  data: makeAiChatTestCaseBuilder("email organization (archive, mark read/unread, bulk actions)"),
  task: async (input) => {
    return safeStreamText({
      model: model,
      system: AiChatPrompt("test-thread-id"),
      prompt: input,
    });
  },
  scorers: [Factuality, Levenshtein],
});

evalite("AI Chat – Email Composition", {
  data: makeAiChatTestCaseBuilder("email composition tasks (compose, reply, send, draft)"),
  task: async (input) => {
    return safeStreamText({
      model: model,
      system: AiChatPrompt("test-thread-id"),
      prompt: input,
    });
  },
  scorers: [Factuality, Levenshtein],
});

evalite("AI Chat – Smart Categorization", {
  data: makeAiChatTestCaseBuilder("smart categorization (subscriptions, newsletters, meetings, bills)"),
  task: async (input) => {
    return safeStreamText({
      model: model,
      system: AiChatPrompt("test-thread-id"),
      prompt: input,
    });
  },
  scorers: [Factuality, Levenshtein],
});

evalite("AI Chat – Information Queries", {
  data: makeAiChatTestCaseBuilder("information queries (summaries, web search, tax docs, recent activity)"),
  task: async (input) => {
    return safeStreamText({
      model: model,
      system: AiChatPrompt("test-thread-id"),
      prompt: input,
    });
  },
  scorers: [Factuality, Levenshtein],
});

evalite("AI Chat – Complex Workflows", {
  data: makeAiChatTestCaseBuilder("complex workflows (multi-step actions, automation)"),
  task: async (input) => {
    return safeStreamText({
      model: model,
      system: AiChatPrompt("test-thread-id"),
      prompt: input,
    });
  },
  scorers: [Factuality, Levenshtein],
});

evalite("AI Chat – User Intent Recognition", {
  data: makeAiChatTestCaseBuilder("user intent recognition (help, overwhelm, search, cleanup)"),
  task: async (input) => {
    return safeStreamText({
      model: model,
      system: AiChatPrompt("test-thread-id"),
      prompt: input,
    });
  },
  scorers: [Factuality, Levenshtein],
});

evalite("AI Chat – Error Handling & Edge Cases", {
  data: makeAiChatTestCaseBuilder("error handling & edge cases (invalid, bulk actions, very old queries)"),
  task: async (input) => {
    return safeStreamText({
      model: model,
      system: AiChatPrompt("test-thread-id"),
      prompt: input,
    });
  },
  scorers: [Factuality, Levenshtein],
});

evalite("Gmail Search Query Building", {
  data: buildGmailSearchTestCases,
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
  data: makeAiChatTestCaseBuilder("styled email composition (follow-up, thank you, meeting, apology)"),
  task: async (input) => {
    return safeStreamText({
      model: model,
      system: StyledEmailAssistantSystemPrompt(),
      prompt: input,
    });
  },
  scorers: [Factuality, Levenshtein],
}); 