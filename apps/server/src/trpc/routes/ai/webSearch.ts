import { searchWeb } from '../../../lib/context-dev';
import { miniModel } from '../../../lib/ai-models';
import { aiDriverProcedure } from '../../trpc';
import { generateText } from 'ai';
import { z } from 'zod';

export const webSearch = aiDriverProcedure
  .input(z.object({ query: z.string() }))
  .mutation(async ({ input }) => {
    const results = await searchWeb(input.query);
    const context = results
      .map((r, i) => `[${i + 1}] ${r.title} (${r.url})\n${r.content}`)
      .join('\n\n');
    const { text } = await generateText({
      model: miniModel(),
      system:
        'Answer the question using only the web search results provided. Be precise and concise. NEVER include sources or source references. NEVER use markdown formatting.',
      prompt: `Question: ${input.query}\n\nSearch results:\n${context || '(no results)'}`,
      maxTokens: 1024,
    });
    const sources = results.map((r, i) => ({
      id: String(i + 1),
      sourceType: 'url' as const,
      url: r.url,
      title: r.title,
    }));
    return { text, sources };
  });
