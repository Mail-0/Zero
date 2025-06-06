import { GmailSearchAssistantSystemPrompt } from '../../../lib/prompts';
import { activeDriverProcedure } from '../../trpc';
import { openai } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { z } from 'zod';

export const generateSearchQuery = activeDriverProcedure
  .input(z.object({ query: z.string() }))
  .mutation(async ({ input }) => {
    const result = await generateObject({
      model: openai('gpt-4o'),
      system: GmailSearchAssistantSystemPrompt(),
      prompt: input.query,
      schema: z.object({
        query: z.string(),
      }),
    });

    return result.object;
  });
