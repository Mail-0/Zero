import { type CoreMessage, generateText, tool, generateObject } from 'ai';
import { GmailSearchAssistantSystemPrompt } from '../../../lib/prompts';
import { activeDriverProcedure } from '../../trpc';
import type { gmail_v1 } from '@googleapis/gmail';
import { TRPCError } from '@trpc/server';
import { openai } from '@ai-sdk/openai';
import dedent from 'dedent';
import { z } from 'zod';

export const generateSearchQuery = activeDriverProcedure
  .input(z.object({ query: z.string() }))
  .mutation(async ({ input, ctx }) => {
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
