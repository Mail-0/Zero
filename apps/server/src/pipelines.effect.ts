/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { env } from 'cloudflare:workers';

const showLogs = true;

const log = (message: string, ...args: any[]) => {
  if (showLogs) {
    console.log(message, ...args);
    return message;
  }
  return 'no message';
};

// Configure pretty logger to stderr

/**
 * Runs the main workflow for processing a thread. The workflow is responsible for processing incoming messages from a Pub/Sub subscription and passing them to the appropriate pipeline.
 * @param params
 * @returns
 */

export const getPrompt = async (promptName: string, fallback: string) => {
  try {
    if (!promptName || typeof promptName !== 'string') {
      log('[GET_PROMPT] Invalid prompt name:', promptName);
      return fallback;
    }

    const existingPrompt = await env.prompts_storage.get(promptName);
    if (!existingPrompt) {
      await env.prompts_storage.put(promptName, fallback);
      return fallback;
    }
    return existingPrompt;
  } catch (error) {
    log('[GET_PROMPT] Failed to get prompt:', {
      promptName,
      error: error instanceof Error ? error.message : String(error),
    });
    return fallback;
  }
};

export const getEmbeddingVector = async (text: string) => {
  try {
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      log('[getEmbeddingVector] Empty or invalid text provided');
      return null;
    }

    const embeddingResponse = await env.AI.run(
      '@cf/baai/bge-large-en-v1.5',
      { text: text.trim() },
      {
        gateway: {
          id: 'vectorize-save',
        },
      },
    );
    const embeddingVector = (embeddingResponse as any).data?.[0];
    return embeddingVector ?? null;
  } catch (error) {
    log('[getEmbeddingVector] failed', error);
    return null;
  }
};
