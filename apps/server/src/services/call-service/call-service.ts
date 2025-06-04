import {
  twilioSocketMessageSchema,
  type TwilioSocketMessage,
} from './twilio-socket-message-schema';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { elevenLabsIncomingSocketMessageSchema } from './eleven-labs-incoming-message-schema';
import type { ElevenLabsOutgoingSocketMessage } from './eleven-labs-outgoing-message-schema';
import { generateText, experimental_createMCPClient as createMCPClient } from 'ai';
import { systemPrompt } from './system-prompt';
import { ElevenLabsClient } from 'elevenlabs';
import { env } from 'cloudflare:workers';
import { openai } from '@ai-sdk/openai';
import z, { ZodError } from 'zod';
import { Twilio } from 'twilio';

export class CallService {
  private phoneNumber: string | null = null;
  private streamSid: string | null = null;
  private elevenLabsWebSocket: WebSocket | null = null;
  private callWebSocket: WebSocket | null = null;
  private twilio: Twilio;
  private conversationHistory: {
    role: 'user' | 'assistant';
    content: string;
  }[] = [];
  private mcpClient: Awaited<ReturnType<typeof createMCPClient>> | null = null;

  constructor(private callSid: string) {
    if (!env.CALL_INBOX_CONNECTION_ID) {
      throw new Error('[Twilio] CALL_INBOX_CONNECTION_ID not set');
    }

    this.twilio = new Twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);
  }

  public async startCall(callWebSocket: WebSocket, hostname: string) {
    this.attachCallWebSocketEventListeners(callWebSocket);

    // Get the caller phone number from Twilio
    const twilioCall = await this.twilio.calls(this.callSid).fetch();
    this.phoneNumber = twilioCall.from;

    // Initialize the mail driver and tools
    this.callWebSocket = callWebSocket;

    this.mcpClient = await this.connectToMCP(hostname, env.CALL_INBOX_CONNECTION_ID);

    // Attach event listeners to the call WebSocket
    await this.connectToElevenLabs();

    console.log(`[Twilio] WebSocket connected for call ${this.callSid}`);
  }

  public async stopCall() {
    this.mcpClient?.close();
    this.elevenLabsWebSocket?.close();
    await this.endTwilioCall();
  }

  private async endTwilioCall() {
    if (!this.callSid) {
      throw new Error('[Twilio] Call SID not set');
    }

    await this.twilio.calls(this.callSid).update({
      status: 'completed',
    });
    this.callWebSocket?.close();
  }

  private attachCallWebSocketEventListeners(callWebSocket: WebSocket) {
    callWebSocket.addEventListener('message', async (event) => {
      try {
        await this.handleTwilioMessage(event.data.toString());
      } catch (error) {
        console.error(`[Twilio] Error processing Twilio message for call ${this.callSid}:`, error);
      }
    });

    callWebSocket.addEventListener('close', (event) => {
      console.log(`[Twilio] WebSocket closed for call ${this.callSid}, code: ${event.code}`);
      this.elevenLabsWebSocket?.close();
    });

    callWebSocket.addEventListener('error', (event) => {
      console.error(`[Twilio] WebSocket error for call ${this.callSid}:`, event);
      this.elevenLabsWebSocket?.close();
    });
  }

  private async handleTwilioMessage(message: string) {
    try {
      const data = twilioSocketMessageSchema.parse(JSON.parse(message));

      switch (data.event) {
        case 'connected':
          console.log('[DEBUG] handling twilio connected message', data);
          console.log(`[Twilio] Connected for call ${this.callSid}`);
          break;
        case 'start':
          console.log('[DEBUG] handling twilio start message', data);
          console.log(`[Twilio] Media stream started for call ${this.callSid}`);
          this.streamSid = data.streamSid;
          console.log('[DEBUG] params', data.start);
          break;
        case 'media':
          // (Twilio -> ElevenLabs)
          this.sendToElevenLabs({
            user_audio_chunk: data.media.payload,
          });
          break;
        case 'stop':
          console.log(`[Twilio] Media stream stopped for call ${this.callSid}`);
          this.elevenLabsWebSocket?.close();
          await this.endTwilioCall();
          break;
        default:
          console.warn(`[Twilio] Unhandled event: ${data['event']}`);
          break;
      }
    } catch (error) {
      if (error instanceof ZodError) {
        console.error(
          `[Twilio] [Zod] Error processing Twilio message for call ${this.callSid}:`,
          JSON.stringify(error.errors),
        );
        console.log(`[Twilio] Errored Message: ${message}`);
      } else {
        console.error(`[Twilio] Error processing Twilio message for call ${this.callSid}:`, error);
        console.log(`[Twilio] Errored Message: ${message}`);
      }
    }
  }

  private async connectToElevenLabs() {
    return new Promise<void>(async (resolve, reject) => {
      try {
        const elevenLabs = new ElevenLabsClient({
          apiKey: env.ELEVENLABS_API_KEY,
        });

        const signedUrlResponse = await elevenLabs.conversationalAi.getSignedUrl({
          agent_id: env.ELEVENLABS_AGENT_ID,
        });

        this.elevenLabsWebSocket = new WebSocket(signedUrlResponse.signed_url);
        this.elevenLabsWebSocket.addEventListener('open', () => {
          console.log(`[ElevenLabs] WebSocket connected`);

          this.sendToElevenLabs({
            type: 'conversation_initiation_client_data',
          });

          resolve();
        });
        this.elevenLabsWebSocket.addEventListener('message', async (event) => {
          await this.handleElevenLabsMessage(event.data.toString());
        });
        this.elevenLabsWebSocket.addEventListener('error', async (event) => {
          console.error(`[ElevenLabs] WebSocket error:`, event);
          await this.endTwilioCall();
        });
        this.elevenLabsWebSocket.addEventListener('close', async (event) => {
          console.log(`[ElevenLabs] WebSocket closed:`, event);
          await this.endTwilioCall();
        });
      } catch (error) {
        console.error(`[ElevenLabs] Error connecting to ElevenLabs:`, error);
        reject(error);
      }
    });
  }

  private sendToElevenLabs(message: ElevenLabsOutgoingSocketMessage) {
    if (!this.elevenLabsWebSocket || this.elevenLabsWebSocket.readyState !== WebSocket.OPEN) {
      // console.warn('[ElevenLabs] WebSocket not connected or not open, skipping message');

      return;
    }

    this.elevenLabsWebSocket.send(JSON.stringify(message));
  }

  private async handleElevenLabsMessage(message: string) {
    const data = await elevenLabsIncomingSocketMessageSchema.parseAsync(JSON.parse(message));

    switch (data.type) {
      case 'conversation_initiation_metadata':
        console.log(
          '[ElevenLabs] Conversation initiation metadata received',
          data.conversation_initiation_metadata_event,
        );
        break;
      case 'contextual_update':
        console.log(`[ElevenLabs] Contextual update received`);
        break;
      case 'vad_score':
        console.log(`[ElevenLabs] VAD score received`);
        break;
      case 'internal_tentative_agent_response':
        console.log(`[ElevenLabs] Internal tentative agent response received`);
        break;
      case 'agent_response':
        console.log(
          '[ElevenLabs] Agent response received:',
          `"${data.agent_response_event?.agent_response}"`,
        );
        this.conversationHistory.push({
          role: 'assistant',
          content: data.agent_response_event?.agent_response ?? '',
        });
        break;
      case 'ping':
        this.sendToElevenLabs({
          type: 'pong',
          event_id: data.ping_event?.event_id ?? 0,
        });
        break;
      case 'audio':
        // (ElevenLabs -> Twilio)
        if (data.audio_event?.audio_base_64) {
          await this.sendAudioToTwilio(data.audio_event.audio_base_64);
        }
        break;
      case 'client_tool_call':
        console.log(`[ElevenLabs] Client tool call received`);
        if (
          data.client_tool_call &&
          data.client_tool_call.tool_name &&
          data.client_tool_call.tool_call_id
        ) {
          const toolName = data.client_tool_call.tool_name;
          const toolCallId = data.client_tool_call.tool_call_id;
          const parameters = data.client_tool_call.parameters;
          await this.handleToolCall(toolName, toolCallId, parameters);
        } else {
          console.warn('No tool call data');
        }
        break;
      case 'agent_response_correction':
        console.log(`[ElevenLabs] Agent response correction received`);
        break;
      case 'interruption':
        console.log(`[ElevenLabs] Interruption received`);
        break;
      case 'user_transcript':
        console.log(
          `[ElevenLabs] User transcript received:`,
          `"${data.user_transcription_event?.user_transcript}"`,
        );
        this.conversationHistory.push({
          role: 'user',
          content: data.user_transcription_event?.user_transcript ?? '',
        });

        if (!this.streamSid) {
          console.warn('[Twilio] Stream SID not set, skipping clear message');

          return;
        }

        this.sendToTwilio({
          event: 'clear',
          streamSid: this.streamSid,
        });
        break;
    }
  }

  private async handleToolCall(
    toolName: string,
    toolCallId: string,
    parameters: Record<string, string | number | boolean> | null,
  ) {
    console.log('[DEBUG - TOOL CALL] handleToolCall', toolName, toolCallId, parameters);

    switch (toolName) {
      case 'manage_email':
        try {
          const parsedParameters = z
            .object({
              query: z.string(),
            })
            .parse(parameters);
          const aiResponse = await this.generateAIResponse(parsedParameters.query);

          this.sendToElevenLabs({
            type: 'client_tool_result',
            tool_call_id: toolCallId,
            result: aiResponse,
            is_error: false,
          });
        } catch (error) {
          console.error('[DEBUG - TOOL CALL] error', error);

          if (error instanceof ZodError) {
            console.error('[DEBUG - TOOL CALL] zod error', error.errors);

            this.sendToElevenLabs({
              type: 'client_tool_result',
              tool_call_id: toolCallId,
              result: error.issues.map((issue) => issue.message).join(', '),
              is_error: true,
            });

            return;
          }

          this.sendToElevenLabs({
            type: 'client_tool_result',
            tool_call_id: toolCallId,
            result: 'I had trouble processing your request. Please try again.',
            is_error: true,
          });
        }
        break;
      default:
        console.warn('[ElevenLabs] Unhandled tool call:', toolName);
        break;
    }

    // get driver and connection id
    // switch (toolName) {
    //   case 'get_thread':
    //     break;
    //   case 'list_threads':
    //     break;
    //   default:
    //     console.warn('[ElevenLabs] Unhandled tool call:', toolName);
    // }
  }

  private async sendAudioToTwilio(audio: string) {
    if (
      !this.callWebSocket ||
      this.callWebSocket.readyState !== WebSocket.OPEN ||
      !this.streamSid
    ) {
      console.error('[Twilio] WebSocket sendAudioToTwilio error');

      throw new Error('[Twilio] WebSocket not connected or not open');
    }

    this.sendToTwilio({
      event: 'media',
      streamSid: this.streamSid,
      media: {
        payload: audio,
      },
    });
  }

  private sendToTwilio(message: TwilioSocketMessage) {
    console.log('[DEBUG] sending message to twilio');

    if (!this.callWebSocket || this.callWebSocket.readyState !== WebSocket.OPEN) {
      throw new Error('[Twilio] WebSocket not connected or not open');
    }

    this.callWebSocket.send(JSON.stringify(message));
    console.log('[DEBUG] sent message to twilio');
  }

  private async generateAIResponse(query: string) {
    if (!this.mcpClient) {
      throw new Error('[Twilio] MCP client not connected');
    }

    try {
      console.log('[DEBUG] query', query);
      const mcpTools = await this.mcpClient.tools();

      this.conversationHistory.push({
        role: 'user',
        content: query,
      });

      const { text } = await generateText({
        model: openai('gpt-4o-mini'),
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          ...this.conversationHistory,
          {
            role: 'user',
            content: query,
          },
        ],
        tools: mcpTools,
        maxSteps: 10,
      });

      this.conversationHistory.push({
        role: 'assistant',
        content: text,
      });

      console.log('[DEBUG] llm response', text);

      return text;
    } catch (error) {
      console.error('AI processing error', error);

      return "I'm sorry, I had trouble processing your request. Please try again.";
    }
  }

  // private async getMcpToolSet(): Promise<Record<string, Tool>> {
  //   if (!this.mcpClient) {
  //     throw new Error('[Twilio] MCP client not connected');
  //   }

  //   // Retrieve tool metadata from MCP
  //   const { tools: mcpTools } = (await this.mcpClient.listTools()) as unknown as {
  //     tools: Array<{
  //       name: string;
  //       description?: string;
  //       // The schema is JSON-schema – we treat it as unknown for now
  //       inputSchema?: unknown;
  //     }>;
  //   };

  //   // Convert to ai-sdk ToolSet
  //   return mcpTools.reduce<Record<string, Tool>>((acc, { name, description }) => {
  //     acc[name] = {
  //       description,
  //       // We can't infer the exact shape here – allow any parameters
  //       parameters: z.any(),
  //       execute: async (args) => {
  //         if (!this.mcpClient) throw new Error('[Twilio] MCP client not connected');
  //         return this.mcpClient.callTool({ name, args });
  //       },
  //     } as Tool;

  //     return acc;
  //   }, {});
  // }

  private async connectToMCP(hostname: string, connectionId: string) {
    if (!this.phoneNumber) {
      throw new Error('[Twilio] Phone number not set');
    }

    const mcpUrl = new URL('/api/ai/mcp', hostname);
    const transport = new StreamableHTTPClientTransport(mcpUrl, {
      requestInit: {
        headers: {
          'X-Connection-Id': connectionId,
        },
      },
    });

    return createMCPClient({
      transport,
    });
  }
}
