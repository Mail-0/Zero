import { NextRequest, NextResponse } from 'next/server';
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import {
  ListToolsRequest,
  ListToolsResultSchema,
  CallToolRequest,
  CallToolResultSchema,
  LoggingMessageNotificationSchema,
} from "@modelcontextprotocol/sdk/types.js";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { input } = body;
    
    console.log('----- Received input:', input);
    
    // const url = process.env.MCP_API_URL || 'http://localhost:3000/mcp';
    const url = 'https://discord-mcp-server.klavis.ai/sse\?instance_id\=706b50c4-8dae-4af4-8b44-1cb80ea8a48c';
    
    try {
      // Create a new MCP client for each message
      const { client, transport } = await createMcpClient(url);
      
      // Set up notification handler
      client.setNotificationHandler(LoggingMessageNotificationSchema, (notification) => {
        console.log(`Notification: ${notification.params.level} - ${notification.params.data}`);
      });
      
      // 1. List available tools
      await listTools(client);
      
      // TODO: Process the input using the MCP client
      // This is where you would add your specific MCP processing logic
      
      // Close the transport when done
      await transport.close();
      
      const response = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: input ? `Processed via MCP: ${input}` : 'No input provided',
      };

      return NextResponse.json(response);
    } catch (error) {
      console.error('Error with MCP client:', error);
      return NextResponse.json(
        { error: 'Failed to process with MCP client' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error in MCP API:', error);
    return NextResponse.json(
      { error: 'Failed to process MCP request' },
      { status: 500 }
    );
  }
} 


/**
 * 
 * This client demonstrates backward compatibility with both:
 * 1. Modern servers using Streamable HTTP transport (protocol version 2025-03-26)
 * 2. Older servers using HTTP+SSE transport (protocol version 2024-11-05)
 * 
 */
async function createMcpClient(url: string): Promise<{
    client: Client,
    transport: StreamableHTTPClientTransport | SSEClientTransport,
    transportType: 'streamable-http' | 'sse'
  }> {
    console.log('1. Trying Streamable HTTP transport first...');
  
    // Step 1: Try Streamable HTTP transport first
    const client = new Client({
      name: 'backwards-compatible-client',
      version: '1.0.0'
    });
  
    client.onerror = (error) => {
      console.error('Client error:', error);
    };
    const baseUrl = new URL(url);
  
    try {
      // Create modern transport
      const streamableTransport = new StreamableHTTPClientTransport(baseUrl);
      await client.connect(streamableTransport);
  
      console.log('Successfully connected using modern Streamable HTTP transport.');
      return {
        client,
        transport: streamableTransport,
        transportType: 'streamable-http'
      };
    } catch (error) {
      // Step 2: If transport fails, try the older SSE transport
      console.log(`StreamableHttp transport connection failed: ${error}`);
      console.log('2. Falling back to deprecated HTTP+SSE transport...');
  
      try {
        // Create SSE transport pointing to /sse endpoint
        const sseTransport = new SSEClientTransport(baseUrl);
        const sseClient = new Client({
          name: 'backwards-compatible-client',
          version: '1.0.0'
        });
        await sseClient.connect(sseTransport);
  
        console.log('Successfully connected using deprecated HTTP+SSE transport.');
        return {
          client: sseClient,
          transport: sseTransport,
          transportType: 'sse'
        };
      } catch (sseError) {
        console.error(`Failed to connect with either transport method:\n1. Streamable HTTP error: ${error}\n2. SSE error: ${sseError}`);
        throw new Error('Could not connect to server with any available transport');
      }
    }
  }
  
  /**
   * List available tools on the server
   */
  async function listTools(client: Client): Promise<void> {
    try {
      const toolsRequest: ListToolsRequest = {
        method: 'tools/list',
        params: {}
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
  