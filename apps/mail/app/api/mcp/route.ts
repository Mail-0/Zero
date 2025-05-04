import {
  CallToolRequest,
  CallToolResultSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

// For demo purposes, streaming is not supported.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { messages } = body;

    // Call Klavis API to create Resend MCP Server and set auth token. 
    // TODO: 
    // 1. Set userId
    // 2. only need to create mcp server instance and set auth token once to save on api cost. (Note: Klavis will not create a new instance if it already exists.)
    const userId = '123456789';
    const { serverUrl, instanceId } = await createMcpServerInstance('Resend', userId, 'Zero');
    const response = await setMcpServerAuthToken(instanceId, process.env.RESEND_API_KEY || '');

    if (!response.success) {
      throw new Error('Failed to set MCP server auth token');
    }

    let client: Client | undefined;
    let transport: SSEClientTransport | undefined;

    try {
      // Create a new MCP client for each message
      ({ client, transport } = await createMcpClient(serverUrl));

      // Get available tools from MCP server
      const mcpTools = await client.listTools();

      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });

      const llmResponse = await openai.chat.completions.create({
        model: 'gpt-4o',
        max_tokens: 1024,
        messages: messages,
        tools: mcpTools.tools.map(tool => ({
          type: 'function',
          function: {
            name: tool.name,
            description: tool.description || '',
            parameters: tool.inputSchema || {}
          }
        })),
        tool_choice: 'auto',
      });

      let result;
      // Handle tool calls if present
      const toolCalls = llmResponse.choices[0]?.message.tool_calls;
      if (toolCalls && toolCalls.length > 0) {
        const toolCall = toolCalls[0];
        if (toolCall) {
          
          const params = JSON.parse(toolCall.function.arguments || '{}');
          result = await callTool(client, toolCall.function.name, params);
          
          // Send the result to OpenAI for further processing
          const followUpResponse = await openai.chat.completions.create({
            model: 'gpt-4o',
            max_tokens: 1024,
            messages: [
              ...messages,
              { 
                role: 'assistant', 
                tool_calls: [{ 
                  id: toolCall.id, 
                  type: 'function',
                  function: {
                    name: toolCall.function.name,
                    arguments: toolCall.function.arguments
                  }
                }]
              },
              { 
                role: 'tool', 
                tool_call_id: toolCall.id,
                content: JSON.stringify(result)
              }
            ]
          });
          
          result = followUpResponse.choices[0]?.message.content || 'No response from follow-up LLM call';
        } else {
          result = 'Tool call was received but details were undefined';
        }
      } else {
        // No tool call, just return the text response
        result = llmResponse.choices[0]?.message.content || 'No response from LLM';
      }

      const apiResponse = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: result,
      };
      return NextResponse.json(apiResponse);
    } catch (error) {
      console.error('Error with MCP client:', error);
      throw error; // Re-throw to be caught by outer catch
    } finally {
      if (transport) {
        await transport.close();
        console.log('Disconnected from MCP server');
      }
    }
  } catch (error) {
    console.error('Error in MCP API:', error);
    return NextResponse.json({ error: 'Failed to process MCP request' }, { status: 500 });
  }
}

/**
 * Create an MCP client using the SSE transport
 */
async function createMcpClient(url: string): Promise<{
  client: Client;
  transport: SSEClientTransport;
  transportType: 'streamable-http' | 'sse';
}> {
  const baseUrl = new URL(url);
  try {
    const sseTransport = new SSEClientTransport(baseUrl);
    const sseClient = new Client({
      name: 'backwards-compatible-client',
      version: '1.0.0',
    });
    await sseClient.connect(sseTransport);

    console.log('Successfully connected using HTTP+SSE transport.');
    return {
      client: sseClient,
      transport: sseTransport,
      transportType: 'sse',
    };
  } catch (sseError) {
    console.error(`Failed to connect with SSE error: ${sseError}`);
    throw new Error('Could not connect to server with SSE transport');
  }
}

/**
 * Call a tool using the MCP client
 * @param client The MCP client
 * @param toolName The name of the tool to call
 * @param params The parameters to pass to the tool
 * @returns The result of the tool call
 */
async function callTool(client: Client, toolName: string, params: any) {
  const request: CallToolRequest = {
    method: 'tools/call',
    params: {
      name: toolName,
      arguments: params
    }
  };
  const result = await client.request(request, CallToolResultSchema);
  return result;
}

/**
 * Create an MCP server instance using the Klavis AI API
 * @param serverName Name of the server, e.g. 'Resend'
 * @param userId Unique user ID
 * @param platformName Platform name, set to 'Zero'
 * @returns Response containing serverUrl and instanceId
 */
async function createMcpServerInstance(
  serverName: string,
  userId: string,
  platformName: string,
): Promise<{ serverUrl: string; instanceId: string }> {
  try {
    const response = await fetch('https://api.klavis.ai/mcp-server/instance/create', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.KLAVIS_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        serverName,
        userId,
        platformName,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to create MCP server instance: ${response.status} ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error creating MCP server instance:', error);
    throw error;
  }
}

/**
 * Set authentication token for an MCP server instance using the Klavis AI API
 * @param instanceId The unique identifier for the connection instance
 * @param authToken The authentication token to save
 * @returns Response containing success status and optional message
 */
async function setMcpServerAuthToken(
  instanceId: string,
  authToken: string,
): Promise<{ success: boolean; message: string | null }> {
  try {
    const response = await fetch('https://api.klavis.ai/mcp-server/instance/set-auth-token', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.KLAVIS_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        instanceId,
        authToken,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to set MCP server auth token: ${response.status} ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error setting MCP server auth token:', error);
    throw error;
  }
}
