import {
  ListToolsRequest,
  ListToolsResultSchema,
  CallToolRequest,
  CallToolResultSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { input } = body;

    console.log('----- Received input:', input);

    const userId = '123456789';
    const { serverUrl, instanceId } = await createMcpServerInstance('Resend', userId, 'Zero');
    const response = await setMcpServerAuthToken(instanceId, process.env.RESEND_API_KEY || '');

    if (!response.success) {
      throw new Error('Failed to set MCP server auth token');
    }

    console.log('----- MCP Server URL:', serverUrl);
    console.log('----- MCP Instance ID:', instanceId);

    try {
      // Create a new MCP client for each message
      const { client, transport } = await createMcpClient(serverUrl);

      await listTools(client);

      // Close the transport when done
      await transport.close();
      console.log('Disconnected from MCP server');

      const response = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: input ? `Processed via MCP: ${input}` : 'No input provided',
      };

      return NextResponse.json(response);
    } catch (error) {
      console.error('Error with MCP client:', error);
      return NextResponse.json({ error: 'Failed to process with MCP client' }, { status: 500 });
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
 * List available tools on the MCP Server
 */
async function listTools(client: Client): Promise<void> {
  try {
    const toolsRequest: ListToolsRequest = {
      method: 'tools/list',
      params: {},
    };
    const toolsResult = await client.request(toolsRequest, ListToolsResultSchema);

    console.log('Available tools:');
    if (toolsResult.tools.length === 0) {
      console.log('  No tools available');
    } else {
      for (const tool of toolsResult.tools) {
        console.log(`  - ${tool.name}: ${tool.description}`);
      }
    }
  } catch (error) {
    console.log(`Tools not supported by this server: ${error}`);
  }
}

/**
 * Create an MCP server instance using the Klavis AI API
 * @param serverName Name of the server
 * @param userId Unique user ID
 * @param platformName Platform name
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
