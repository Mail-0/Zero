/*
 * Licensed to Zero Email Inc. under one or more contributor license agreements.
 * You may not use this file except in compliance with the Apache License, Version 2.0 (the "License").
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * Reuse or distribution of this file requires a license from Zero Email Inc.
 */

import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import { env } from 'cloudflare:workers';

export interface GenerateTopicsOptions {
  sampleSize?: number;
  cacheTtlMin?: number;
  existingLabels?: { name: string; id: string }[];
}

export interface UserTopic {
  topic: string;
  usecase: string;
}

/**
 * Generates 1-6 topics that represent what the user cares about based on their email subjects
 */
export async function generateWhatUserCaresAbout(
  subjects: string[],
  opts: GenerateTopicsOptions = {}
): Promise<UserTopic[]> {
  if (!subjects.length) {
    return [];
  }

  if (!env.OPENAI_API_KEY) {
    console.warn('OPENAI_API_KEY not configured - topics generation disabled');
    return [];
  }

  // Pre-process and normalize subjects
  const cleaned = subjects
    .map((s) =>
      s
        .replace(/^(\s*(re|fwd):\s*)+/i, '') // strip reply/forward prefixes
        .replace(/\s{2,}/g, ' ')
        .trim()
    )
    .filter(Boolean);

  if (!cleaned.length) {
    return [];
  }

  // Create frequency map and sample
  const freq = new Map<string, number>();
  cleaned.forEach((s) => freq.set(s, (freq.get(s) ?? 0) + 1));

  // Sort by frequency and take sample that fits token budget
  const SAMPLE_COUNT = opts.sampleSize ?? 250; // empirical: ~250 subjects ≈ 1.5k tokens
  const sample = Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, SAMPLE_COUNT)
    .map(([s, n]) => `${n}× ${s}`);

  const schema = z.object({
    topics: z.array(z.object({
      topic: z.string().max(25),
      usecase: z.string().max(100)
    })).min(1).max(6),
  });

  const existingLabelsText = opts.existingLabels?.length 
    ? `\n\nExisting labels in this account (avoid duplicates or very similar topics):\n${opts.existingLabels.map(l => l.name).join(', ')}`
    : '';

  const systemPrompt = `You are an assistant that studies a person's email subjects and summarizes the *topics* they care about.
Return between 1 and 6 concise topic labels (≤5 words each) with a brief use case explanation for each topic (when someone would use/search for this topic).${existingLabelsText}`;

  const userPrompt = `Here are the email subjects (repetitions include a count prefix):

${sample.join('\n')}`;

  try {
    const { object } = await generateObject({
      model: openai(env.OPENAI_MODEL || 'gpt-4o-mini'),
      schema,
      system: systemPrompt,
      prompt: userPrompt,
      maxTokens: 150,
      temperature: 0.2,
    });

    return object.topics;
  } catch (error) {
    console.error('Failed to generate user topics:', error);
    return [];
  }
}
