import { searchAssistantSystemPrompt } from '../../../lib/prompts';
import { miniModel } from '../../../lib/ai-models';
import { aiDriverProcedure } from '../../trpc';
import { generateObject } from 'ai';
import { z } from 'zod';

export const generateSearchQuery = aiDriverProcedure
  .input(z.object({ query: z.string() }))
  .mutation(async ({ input, ctx }) => {
    const {
      activeConnection: { providerId },
    } = ctx;
    const systemPrompt = searchAssistantSystemPrompt(providerId);

    const result = await generateObject({
      model: miniModel(),
      system: systemPrompt,
      prompt: input.query,
      schema: z.object({
        query: z.string(),
      }),
      output: 'object',
    });

    return result.object;
  });
