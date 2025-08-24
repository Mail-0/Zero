import {
  GmailSearchAssistantSystemPrompt,
  OutlookSearchAssistantSystemPrompt,
} from '../../../lib/prompts';
import { activeDriverProcedure } from '../../trpc';
import { google } from '@ai-sdk/google';
import { generateObject } from 'ai';
import { env } from '../../../env';
import { z } from 'zod';

export const generateSearchQuery = activeDriverProcedure
  .input(z.object({ query: z.string() }))
  .mutation(async ({ input, ctx }) => {
    const {
      activeConnection: { providerId },
    } = ctx;
    const systemPrompt =
      providerId === 'google'
        ? GmailSearchAssistantSystemPrompt()
        : providerId === 'microsoft'
          ? OutlookSearchAssistantSystemPrompt()
          : '';

    const result = await generateObject({
      model: google(env.GEMINI_FLASH_MODEL || 'gemini-2.0-flash'),
      system: systemPrompt,
      prompt: input.query,
      schema: z.object({
        query: z.string(),
      }),
      output: 'object',
    });

    return result.object;
  });
