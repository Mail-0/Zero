#!/usr/bin/env tsx

/**
 * Bulk-register / update all ai-sdk tools as ElevenLabs tools.
 * This version:
 * 1. Lists existing tools
 * 2. Deletes them all
 * 3. Creates new ones
 *
 * Environment variables required:
 *   ELEVENLABS_API_KEY          – ElevenLabs API key
 *   SERVER_URL                  – https://your-api.example.com
 *   VOICE_SECRET                – same secret VoiceProvider adds to calls
 *   ELEVENLABS_AGENT_ID         – ElevenLabs agent ID to update with tools
 *
 * Usage:
 *   pnpm tsx scripts/register-elevenlabs-tools-v2.ts
 */

import { zodToJsonSchema } from 'zod-to-json-schema';
import { Tools } from '../apps/server/src/types';
import { z } from 'zod';

// Tool definitions without runtime dependencies
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: z.ZodSchema<any>;
}

export const toolDefinitions: ToolDefinition[] = [
  {
    name: Tools.GetThread,
    description: 'Return a placeholder tag for a specific email thread by ID',
    parameters: z.object({
      id: z.string().describe('The ID of the email thread to retrieve'),
    }),
  },
  {
    name: Tools.GetThreadSummary,
    description: 'Get the summary of a specific email thread',
    parameters: z.object({
      id: z.string().describe('The threadId of the email thread to get the summary of'),
    }),
  },
  {
    name: Tools.ComposeEmail,
    description: 'Compose an email using AI assistance',
    parameters: z.object({
      prompt: z.string().describe('The prompt or rough draft for the email'),
      emailSubject: z.string().optional().describe('The subject of the email'),
      to: z.array(z.string()).optional().describe('Recipients of the email'),
      cc: z.array(z.string()).optional().describe('CC recipients of the email'),
      threadMessages: z
        .array(
          z.object({
            from: z.string().describe('The sender of the email'),
            to: z.array(z.string()).describe('The recipients of the email'),
            cc: z.array(z.string()).optional().describe('The CC recipients of the email'),
            subject: z.string().describe('The subject of the email'),
            body: z.string().describe('The body of the email'),
          }),
        )
        .optional()
        .describe('Previous messages in the thread for context'),
    }),
  },
  {
    name: Tools.MarkThreadsRead,
    description: 'Mark emails as read',
    parameters: z.object({
      threadIds: z.array(z.string()).describe('The IDs of the threads to mark as read'),
    }),
  },
  {
    name: Tools.MarkThreadsUnread,
    description: 'Mark emails as unread',
    parameters: z.object({
      threadIds: z.array(z.string()).describe('The IDs of the threads to mark as unread'),
    }),
  },
  {
    name: Tools.ModifyLabels,
    description: 'Modify labels on emails',
    parameters: z.object({
      threadIds: z.array(z.string()).describe('The IDs of the threads to modify'),
      options: z.object({
        addLabels: z.array(z.string()).default([]).describe('The labels to add'),
        removeLabels: z.array(z.string()).default([]).describe('The labels to remove'),
      }),
    }),
  },
  {
    name: Tools.GetUserLabels,
    description: 'Get all user labels',
    parameters: z.object({}),
  },
  {
    name: Tools.SendEmail,
    description: 'Send a new email',
    parameters: z.object({
      to: z.array(
        z.object({
          email: z.string().describe('The email address of the recipient'),
          name: z.string().optional().describe('The name of the recipient'),
        }),
      ),
      subject: z.string().describe('The subject of the email'),
      message: z.string().describe('The body of the email'),
      cc: z
        .array(
          z.object({
            email: z.string().describe('The email address of the recipient'),
            name: z.string().optional().describe('The name of the recipient'),
          }),
        )
        .optional(),
      bcc: z
        .array(
          z.object({
            email: z.string().describe('The email address of the recipient'),
            name: z.string().optional().describe('The name of the recipient'),
          }),
        )
        .optional(),
      threadId: z.string().optional().describe('The ID of the thread to send the email from'),
      draftId: z.string().optional().describe('The ID of the draft to send'),
    }),
  },
  {
    name: Tools.CreateLabel,
    description: 'Create a new label with custom colors, if it does not exist already',
    parameters: z.object({
      name: z.string().describe('The name of the label to create'),
      backgroundColor: z.string().describe('The background color of the label in hex format'),
      textColor: z.string().describe('The text color of the label in hex format'),
    }),
  },
  {
    name: Tools.BulkDelete,
    description: 'Move multiple emails to trash by adding the TRASH label',
    parameters: z.object({
      threadIds: z.array(z.string()).describe('Array of email IDs to move to trash'),
    }),
  },
  {
    name: Tools.BulkArchive,
    description: 'Move multiple emails to the archive by removing the INBOX label',
    parameters: z.object({
      threadIds: z.array(z.string()).describe('Array of email IDs to move to archive'),
    }),
  },
  {
    name: Tools.DeleteLabel,
    description: "Delete a label from the user's account",
    parameters: z.object({
      id: z.string().describe('The ID of the label to delete'),
    }),
  },
  {
    name: Tools.BuildGmailSearchQuery,
    description: 'Build a Gmail search query',
    parameters: z.object({
      query: z.string().describe('The search query to build, provided in natural language'),
    }),
  },
  {
    name: 'getCurrentDate',
    description: 'Get the current date',
    parameters: z.object({}).default({}),
  },
  {
    name: 'getLabel',
    description: 'Get a label',
    parameters: z.object({
      id: z.string().describe('The ID of the label to get'),
    }),
  },
  {
    name: Tools.WebSearch,
    description: 'Search the web for information using Perplexity AI',
    parameters: z.object({
      query: z.string().describe('The query to search the web for'),
    }),
  },
  {
    name: Tools.InboxRag,
    description:
      'Search the inbox for emails using natural language. Returns only an array of threadIds.',
    parameters: z.object({
      query: z.string().describe('The query to search the inbox for'),
      maxResults: z.number().describe('The maximum number of results to return').default(10),
    }),
  },
];

interface ElevenLabsToolRequest {
  tool_config: {
    name: string;
    description: string;
    type: string;
    api_schema: {
      url: string;
      method: string;
      request_body_schema: {
        type: string;
        properties: any;
        required?: string[];
      };
      request_headers: Record<string, string | { variable_name: string }>;
    };
  };
}

function cleanSchemaForElevenLabs(properties: any): any {
  const cleaned: any = {};

  for (const [key, value] of Object.entries(properties)) {
    const prop = value as any;

    if (prop.type === 'array') {
      let items: any = {
        type: 'string',
        description: 'String value',
      }; // Default to string items

      if (prop.items) {
        if (prop.items.type === 'object') {
          items = {
            type: 'object',
            description: prop.items.description || 'Object item',
            properties: cleanSchemaForElevenLabs(prop.items.properties || {}),
          };
        } else if (prop.items.type) {
          items = {
            type: prop.items.type,
            description: prop.items.description || `${prop.items.type} value`,
          };
        }
      }

      cleaned[key] = {
        type: 'array',
        description: prop.description || `Array of ${key}`,
        items: items,
      };
    } else if (prop.type === 'object') {
      cleaned[key] = {
        type: 'object',
        description: prop.description || `Object for ${key}`,
        properties: cleanSchemaForElevenLabs(prop.properties || {}),
      };
    } else {
      // Simple types (string, number, boolean)
      cleaned[key] = {
        type: prop.type,
        description: prop.description || `Value for ${key}`,
      };
    }
  }

  return cleaned;
}

async function getExistingTools(apiKey: string): Promise<any[]> {
  const baseUrl = 'https://api.elevenlabs.io/v1/convai/tools';

  try {
    const response = await fetch(baseUrl, {
      method: 'GET',
      headers: {
        'xi-api-key': apiKey,
      },
    });

    if (response.ok) {
      const data = (await response.json()) as { tools?: any[] };
      return data.tools || [];
    } else {
      console.warn('⚠️ Failed to fetch existing tools:', await response.text());
      return [];
    }
  } catch (error) {
    console.warn('⚠️ Error fetching existing tools:', error);
    return [];
  }
}

async function getDependentAgents(apiKey: string, toolId: string): Promise<string[]> {
  const baseUrl = 'https://api.elevenlabs.io/v1/convai/tools';

  try {
    const response = await fetch(`${baseUrl}/${toolId}/dependent-agents`, {
      method: 'GET',
      headers: {
        'xi-api-key': apiKey,
      },
    });

    if (response.ok) {
      const data = (await response.json()) as { agents?: { id?: string }[] };
      return (data.agents || []).map((agent) => agent.id).filter(Boolean) as string[];
    } else {
      console.warn(`⚠️ Failed to get dependent agents for tool ${toolId}:`, await response.text());
      return [];
    }
  } catch (error) {
    console.warn(`⚠️ Error getting dependent agents for tool ${toolId}:`, error);
    return [];
  }
}

async function removeToolFromAgent(
  apiKey: string,
  agentId: string,
  toolIdToRemove: string,
): Promise<boolean> {
  const baseUrl = 'https://api.elevenlabs.io/v1/convai/agents';

  try {
    // First get the current agent config
    const getResponse = await fetch(`${baseUrl}/${agentId}`, {
      method: 'GET',
      headers: {
        'xi-api-key': apiKey,
      },
    });

    if (!getResponse.ok) {
      console.warn(`⚠️ Failed to get agent ${agentId}:`, await getResponse.text());
      return false;
    }

    const agentData = (await getResponse.json()) as any;
    const currentToolIds = agentData.conversation_config?.agent?.prompt?.tool_ids || [];
    const updatedToolIds = currentToolIds.filter((id: string) => id !== toolIdToRemove);

    // Update the agent with the filtered tool IDs
    const updateResponse = await fetch(`${baseUrl}/${agentId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': apiKey,
      },
      body: JSON.stringify({
        conversation_config: {
          agent: {
            prompt: {
              tool_ids: updatedToolIds,
            },
          },
        },
      }),
    });

    if (updateResponse.ok) {
      console.log(`🔧 Removed tool ${toolIdToRemove} from agent ${agentId}`);
      return true;
    } else {
      console.warn(`⚠️ Failed to update agent ${agentId}:`, await updateResponse.text());
      return false;
    }
  } catch (error) {
    console.warn(`⚠️ Error removing tool from agent ${agentId}:`, error);
    return false;
  }
}

async function deleteTool(apiKey: string, toolId: string, toolName: string): Promise<boolean> {
  const baseUrl = 'https://api.elevenlabs.io/v1/convai/tools';

  // First, get dependent agents and remove the tool from them
  console.log(`🔍 Checking dependent agents for tool: ${toolName}`);
  const dependentAgents = await getDependentAgents(apiKey, toolId);

  if (dependentAgents.length > 0) {
    console.log(`Found ${dependentAgents.length} dependent agents, removing tool from them...`);

    const removeResults = await Promise.allSettled(
      dependentAgents.map((agentId) => removeToolFromAgent(apiKey, agentId, toolId)),
    );

    const successfulRemovals = removeResults.filter(
      (result) => result.status === 'fulfilled' && result.value === true,
    ).length;

    console.log(`Removed tool from ${successfulRemovals}/${dependentAgents.length} agents`);
  }

  // Now try to delete the tool
  try {
    const response = await fetch(`${baseUrl}/${toolId}`, {
      method: 'DELETE',
      headers: {
        'xi-api-key': apiKey,
      },
    });

    if (response.ok) {
      console.log(`🗑️ Deleted existing tool: ${toolName}`);
      return true;
    } else {
      console.warn(`⚠️ Failed to delete tool ${toolName}:`, await response.text());
      return false;
    }
  } catch (error) {
    console.warn(`⚠️ Error deleting tool ${toolName}:`, error);
    return false;
  }
}

async function createTool(
  apiKey: string,
  toolRequest: ElevenLabsToolRequest,
): Promise<string | null> {
  const baseUrl = 'https://api.elevenlabs.io/v1/convai/tools';

  try {
    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': apiKey,
      },
      body: JSON.stringify(toolRequest),
    });

    if (response.ok) {
      const result = (await response.json()) as any;
      const toolId = result.id;
      console.log(`✓ Created tool: ${toolRequest.tool_config.name} (ID: ${toolId})`);
      return toolId;
    } else {
      const errorText = await response.text();
      console.error(`✗ Failed to create tool ${toolRequest.tool_config.name}:`, errorText);
      return null;
    }
  } catch (error) {
    console.error(`✗ Error creating tool ${toolRequest.tool_config.name}:`, error);
    return null;
  }
}

async function updateAgent(apiKey: string, agentId: string, toolIds: string[]): Promise<boolean> {
  const baseUrl = 'https://api.elevenlabs.io/v1/convai/agents';

  try {
    const response = await fetch(`${baseUrl}/${agentId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': apiKey,
      },
      body: JSON.stringify({
        conversation_config: {
          agent: {
            prompt: {
              tool_ids: toolIds,
            },
          },
        },
      }),
    });

    if (response.ok) {
      console.log(`✓ Updated agent ${agentId} with ${toolIds.length} tools`);
      return true;
    } else {
      const errorText = await response.text();
      console.error(`✗ Failed to update agent ${agentId}:`, errorText);
      return false;
    }
  } catch (error) {
    console.error(`✗ Error updating agent ${agentId}:`, error);
    return false;
  }
}

async function main() {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const serverUrl = process.env.SERVER_URL || 'https://sapi.0.email';
  const voiceSecret = process.env.VOICE_SECRET;
  const agentId = process.env.ELEVENLABS_AGENT_ID;

  if (!apiKey) {
    throw new Error('ELEVENLABS_API_KEY environment variable is required');
  }

  if (!serverUrl) {
    throw new Error('SERVER_URL environment variable is required');
  }

  if (!voiceSecret) {
    throw new Error('VOICE_SECRET environment variable is required');
  }

  console.log('🚀 Starting ElevenLabs tools registration...');
  console.log(`Server URL: ${serverUrl}`);

  // Step 1: List existing tools
  console.log('\n📋 Fetching existing tools...');
  const existingTools = await getExistingTools(apiKey);

  if (existingTools.length > 0) {
    console.log(`Found ${existingTools.length} existing tools:`);
    existingTools.forEach((tool) => {
      console.log(`  - ${tool.name} (ID: ${tool.id})`);
    });

    // Step 2: Delete existing tools
    console.log('\n🗑️ Deleting existing tools...');
    const deleteResults = await Promise.allSettled(
      existingTools.map((tool) => deleteTool(apiKey, tool.id, tool.id)),
    );

    const deletedCount = deleteResults.filter(
      (result) => result.status === 'fulfilled' && result.value === true,
    ).length;

    console.log(`Deleted ${deletedCount}/${existingTools.length} tools`);
  } else {
    console.log('No existing tools found');
  }

  // Step 3: Prepare new tools
  console.log('\n🔧 Preparing new tools...');
  const toolsToRegister: ElevenLabsToolRequest[] = [];

  for (const toolDef of toolDefinitions) {
    // Extract parameters schema from Zod
    let parametersSchema = { type: 'object', properties: {} };

    try {
      parametersSchema = zodToJsonSchema(toolDef.parameters as any, {
        $refStrategy: 'none',
      }) as any;
    } catch (error) {
      console.warn(`⚠️ Failed to convert schema for ${toolDef.name}:`, error);
    }

    // Clean the schema for ElevenLabs format
    const cleanedProperties = cleanSchemaForElevenLabs((parametersSchema as any).properties || {});
    const required = (parametersSchema as any).required || [];

    const elevenLabsToolRequest: ElevenLabsToolRequest = {
      tool_config: {
        name: toolDef.name,
        description: toolDef.description,
        type: 'webhook',
        api_schema: {
          url: `${serverUrl}/api/ai/do/${toolDef.name}`,
          method: 'POST',
          request_body_schema: {
            type: 'object',
            properties: cleanedProperties,
            required: required,
          },
          request_headers: {
            'Content-Type': 'application/json',
            'X-Voice-Secret': voiceSecret,
            'X-Caller': {
              variable_name: 'system__caller_id',
            },
          },
        },
      },
    };

    toolsToRegister.push(elevenLabsToolRequest);
  }

  console.log(`Prepared ${toolsToRegister.length} tools to create:`);
  toolsToRegister.forEach((toolRequest) => {
    console.log(`  - ${toolRequest.tool_config.name}: ${toolRequest.tool_config.description}`);
  });

  // Step 4: Create new tools
  console.log('\n✨ Creating new tools...\n');

  const results = await Promise.allSettled(
    toolsToRegister.map((toolRequest) => createTool(apiKey, toolRequest)),
  );

  const createdToolIds: string[] = [];
  let successful = 0;

  results.forEach((result) => {
    if (result.status === 'fulfilled' && result.value !== null) {
      createdToolIds.push(result.value);
      successful++;
    }
  });

  const failed = results.length - successful;

  console.log('\n📊 Registration Summary:');
  console.log(`  ✅ Successful: ${successful}`);
  console.log(`  ❌ Failed: ${failed}`);
  console.log(`  📝 Total: ${results.length}`);

  if (failed > 0) {
    console.log('\n⚠️ Some tools failed to register. Check the error messages above.');
    process.exit(1);
  }

  console.log('\n🎉 All tools registered successfully!');

  // Step 5: Update agent with tools (if agent ID provided)
  if (agentId && createdToolIds.length > 0) {
    console.log(`\n🤖 Updating agent ${agentId} with ${createdToolIds.length} tools...`);

    const agentUpdateSuccess = await updateAgent(apiKey, agentId, createdToolIds);

    if (agentUpdateSuccess) {
      console.log('✅ Agent updated successfully with all tools!');
    } else {
      console.log('❌ Failed to update agent with tools');
      process.exit(1);
    }
  } else if (!agentId) {
    console.log(
      '\n💡 To update an agent with these tools, set ELEVENLABS_AGENT_ID environment variable',
    );
  }
}

// Run the script if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('💥 Script failed:', error);
    process.exit(1);
  });
}
