import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { env } from 'cloudflare:workers';
import { McpAgent } from 'agents/mcp';
import z from 'zod';

interface ThoughtData {
  thought: string;
  thoughtNumber: number;
  totalThoughts: number;
  isRevision?: boolean;
  revisesThought?: number;
  branchFromThought?: number;
  branchId?: string;
  needsMoreThoughts?: boolean;
  nextThoughtNeeded: boolean;
}

interface SequentialThinkingParams {
  thought: string;
  nextThoughtNeeded: boolean;
  thoughtNumber: number;
  totalThoughts: number;
  isRevision?: boolean;
  revisesThought?: number;
  branchFromThought?: number;
  branchId?: string;
  needsMoreThoughts?: boolean;
}

export class SequentialThinkingProcessor {
  private thoughtHistory: ThoughtData[] = [];
  private branches: Record<string, ThoughtData[]> = {};
  private disableThoughtLogging: boolean;

  constructor() {
    this.disableThoughtLogging = false; // Enable logging by default in Zero
  }

  private validateThoughtData(input: SequentialThinkingParams): ThoughtData {
    if (!input.thought || typeof input.thought !== 'string') {
      throw new Error('Invalid thought: must be a string');
    }
    if (!input.thoughtNumber || typeof input.thoughtNumber !== 'number') {
      throw new Error('Invalid thoughtNumber: must be a number');
    }
    if (!input.totalThoughts || typeof input.totalThoughts !== 'number') {
      throw new Error('Invalid totalThoughts: must be a number');
    }
    if (typeof input.nextThoughtNeeded !== 'boolean') {
      throw new Error('Invalid nextThoughtNeeded: must be a boolean');
    }

    return {
      thought: input.thought,
      thoughtNumber: input.thoughtNumber,
      totalThoughts: input.totalThoughts,
      nextThoughtNeeded: input.nextThoughtNeeded,
      isRevision: input.isRevision,
      revisesThought: input.revisesThought,
      branchFromThought: input.branchFromThought,
      branchId: input.branchId,
      needsMoreThoughts: input.needsMoreThoughts,
    };
  }

  private formatThought(thoughtData: ThoughtData): string {
    const {
      thoughtNumber,
      totalThoughts,
      thought,
      isRevision,
      revisesThought,
      branchFromThought,
      branchId,
    } = thoughtData;

    let prefix = '';
    let context = '';

    if (isRevision) {
      prefix = '🔄 Revision';
      context = ` (revising thought ${revisesThought})`;
    } else if (branchFromThought) {
      prefix = '🌿 Branch';
      context = ` (from thought ${branchFromThought}, ID: ${branchId})`;
    } else {
      prefix = '💭 Thought';
      context = '';
    }

    const header = `${prefix} ${thoughtNumber}/${totalThoughts}${context}`;
    const border = '─'.repeat(Math.max(header.length, thought.length) + 4);

    return `
┌${border}┐
│ ${header} │
├${border}┤
│ ${thought.padEnd(border.length - 2)} │
└${border}┘`;
  }

  public processThought(input: SequentialThinkingParams) {
    try {
      const validatedInput = this.validateThoughtData(input);

      if (validatedInput.thoughtNumber > validatedInput.totalThoughts) {
        validatedInput.totalThoughts = validatedInput.thoughtNumber;
      }

      this.thoughtHistory.push(validatedInput);

      if (validatedInput.branchFromThought && validatedInput.branchId) {
        if (!this.branches[validatedInput.branchId]) {
          this.branches[validatedInput.branchId] = [];
        }
        this.branches[validatedInput.branchId].push(validatedInput);
      }

      if (!this.disableThoughtLogging) {
        const formattedThought = this.formatThought(validatedInput);
        console.log(formattedThought); // Use console.log instead of console.error
      }

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                thoughtNumber: validatedInput.thoughtNumber,
                totalThoughts: validatedInput.totalThoughts,
                nextThoughtNeeded: validatedInput.nextThoughtNeeded,
                branches: Object.keys(this.branches),
                thoughtHistoryLength: this.thoughtHistory.length,
              },
              null,
              2,
            ),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                error: error instanceof Error ? error.message : String(error),
                status: 'failed',
              },
              null,
              2,
            ),
          },
        ],
        isError: true,
      };
    }
  }

  public getThoughtHistory(): ThoughtData[] {
    return this.thoughtHistory;
  }

  public getBranches(): Record<string, ThoughtData[]> {
    return this.branches;
  }

  public reset(): void {
    this.thoughtHistory = [];
    this.branches = {};
  }
}

export class ThinkingMCP extends McpAgent<typeof env> {
  thinkingServer = new SequentialThinkingProcessor();
  server = new McpServer({
    name: 'thinking-mcp',
    version: '1.0.0',
    description: 'Thinking MCP',
  });

  async init(): Promise<void> {
    this.server.registerTool(
      'sequentialthinking',
      {
        description: `A detailed tool for dynamic and reflective problem-solving through thoughts.
        This tool helps analyze problems through a flexible thinking process that can adapt and evolve.
        Each thought can build on, question, or revise previous insights as understanding deepens.
        When to use this tool:
        - Breaking down complex problems into steps
        - Planning and design with room for revision
        - Analysis that might need course correction
        - Problems where the full scope might not be clear initially
        - Problems that require a multi-step solution
        - Tasks that need to maintain context over multiple steps
        - Situations where irrelevant information needs to be filtered out
        Key features:
        - You can adjust total_thoughts up or down as you progress
        - You can question or revise previous thoughts
        - You can add more thoughts even after reaching what seemed like the end
        - You can express uncertainty and explore alternative approaches
        - Not every thought needs to build linearly - you can branch or backtrack
        - Generates a solution hypothesis
        - Verifies the hypothesis based on the Chain of Thought steps
        - Repeats the process until satisfied
        - Provides a correct answer
        Parameters explained:
        - thought: Your current thinking step, which can include:
        * Regular analytical steps
        * Revisions of previous thoughts
        * Questions about previous decisions
        * Realizations about needing more analysis
        * Changes in approach
        * Hypothesis generation
        * Hypothesis verification
        - next_thought_needed: True if you need more thinking, even if at what seemed like the end
        - thought_number: Current number in sequence (can go beyond initial total if needed)
        - total_thoughts: Current estimate of thoughts needed (can be adjusted up/down)
        - is_revision: A boolean indicating if this thought revises previous thinking
        - revises_thought: If is_revision is true, which thought number is being reconsidered
        - branch_from_thought: If branching, which thought number is the branching point
        - branch_id: Identifier for the current branch (if any)
        - needs_more_thoughts: If reaching end but realizing more thoughts needed
        You should:
        1. Start with an initial estimate of needed thoughts, but be ready to adjust
        2. Feel free to question or revise previous thoughts
        3. Don't hesitate to add more thoughts if needed, even at the "end"
        4. Express uncertainty when present
        5. Mark thoughts that revise previous thinking or branch into new paths
        6. Ignore information that is irrelevant to the current step
        7. Generate a solution hypothesis when appropriate
        8. Verify the hypothesis based on the Chain of Thought steps
        9. Repeat the process until satisfied with the solution
        10. Provide a single, ideally correct answer as the final output
        11. Only set next_thought_needed to false when truly done and a satisfactory answer is reached`,
        inputSchema: {
          thought: z.string().describe('Your current thinking step'),
          nextThoughtNeeded: z.boolean().describe('Whether another thought step is needed'),
          thoughtNumber: z.number().int().min(1).describe('Current thought number'),
          totalThoughts: z.number().int().min(1).describe('Estimated total thoughts needed'),
          isRevision: z.boolean().optional().describe('Whether this revises previous thinking'),
          revisesThought: z
            .number()
            .int()
            .min(1)
            .optional()
            .describe('Which thought is being reconsidered'),
          branchFromThought: z
            .number()
            .int()
            .min(1)
            .optional()
            .describe('Branching point thought number'),
          branchId: z.string().optional().describe('Branch identifier'),
          needsMoreThoughts: z.boolean().optional().describe('If more thoughts are needed'),
        },
      },
      (params) => {
        return this.thinkingServer.processThought({
          thought: params.thought,
          nextThoughtNeeded: params.nextThoughtNeeded,
          thoughtNumber: params.thoughtNumber,
          totalThoughts: params.totalThoughts,
          isRevision: params.isRevision,
          revisesThought: params.revisesThought,
          branchFromThought: params.branchFromThought,
          branchId: params.branchId,
          needsMoreThoughts: params.needsMoreThoughts,
        });
      },
    );
  }
}
