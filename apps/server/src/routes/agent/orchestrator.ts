import { tool, type DataStreamWriter, type ToolSet } from 'ai';

import { getZeroAgent } from '../../lib/server-utils';
import { Tools } from '../../types';
import { z } from 'zod';

/**
 * Orchestrator that handles the distinction between tools and agents.
 * Tools execute and return results, while agents stream responses directly.
 */
export class ToolOrchestrator {
  private dataStream: DataStreamWriter;
  private streamingTools: Set<string> = new Set([Tools.InboxRag]);
  private connectionId: string;

  constructor(dataStream: DataStreamWriter, connectionId: string) {
    this.dataStream = dataStream;
    this.connectionId = connectionId;
  }

  /**
   * Determines if a tool should be treated as an agent that streams
   */
  isStreamingTool(toolName: string): boolean {
    return this.streamingTools.has(toolName);
  }

  /**
   * Creates a streaming agent wrapper for tools that should stream responses directly
   */
  createStreamingAgent(toolName: string, originalTool: ToolSet[string]): ToolSet[string] {
    if (!this.isStreamingTool(toolName)) {
      return originalTool;
    }

    if (toolName === Tools.InboxRag) {
      return tool({
        description:
          'Search the inbox for emails using natural language. Returns only an array of threadIds.',
        parameters: z.object({
          query: z.string().describe('The query to search the inbox for'),
          folder: z.string().describe('The folder to search the inbox for').default('inbox'),
          maxResults: z.number().describe('The maximum number of results to return').default(10),
        }),
        execute: async ({ query, folder, maxResults }) => {
          const agent = await getZeroAgent(this.connectionId);
          const res = await agent.searchThreads({ query, maxResults, folder });
          return res.threadIds;
        },
      });
    }

    return originalTool;
  }

  /**
   * Processes all tools and returns modified versions for streaming tools
   */
  processTools<T extends ToolSet>(tools: T): T {
    const processedTools = { ...tools };

    for (const [toolName, toolInstance] of Object.entries(tools)) {
      if (this.isStreamingTool(toolName)) {
        processedTools[toolName as keyof T] = this.createStreamingAgent(
          toolName,
          toolInstance,
        ) as T[keyof T];
      }
    }

    return processedTools;
  }
}
