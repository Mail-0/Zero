import { z } from 'zod';

export const elevenLabsIncomingSocketMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('conversation_initiation_metadata'),
    conversation_initiation_metadata_event: z
      .object({
        conversation_id: z
          .string()
          .nullable()
          .describe('Unique identifier for the conversation session.'),
        agent_output_audio_format: z
          .string()
          .nullable()
          .describe("Audio format specification for agent's speech output."),
        user_input_audio_format: z
          .string()
          .nullable()
          .describe("Audio format specification for user's speech input."),
      })
      .nullable()
      .describe('Initial conversation metadata'),
  }),
  z.object({
    type: z.literal('user_transcript'),
    user_transcription_event: z
      .object({
        user_transcript: z
          .string()
          .nullable()
          .describe("Transcribed text from user's speech input."),
      })
      .nullable()
      .describe('Transcription event data'),
  }),
  z.object({
    type: z.literal('agent_response'),
    agent_response_event: z
      .object({
        agent_response: z.string().describe("Text content of the agent's response."),
      })
      .nullable()
      .describe('Agent response event data'),
  }),
  z.object({
    type: z.literal('agent_response_correction'),
    correction_event: z
      .object({
        corrected_response: z
          .string()
          .describe('The corrected text content replacing the previous response'),
      })
      .nullable()
      .describe('Correction event data'),
  }),
  z.object({
    type: z.literal('audio'),
    audio_event: z
      .object({
        audio_base_64: z
          .string()
          .nullable()
          .describe("Base64-encoded audio data of agent's speech."),
        event_id: z
          .number()
          .int()
          .nullable()
          .describe('Sequential identifier for the audio chunk.'),
      })
      .nullable()
      .describe('Audio event data'),
  }),
  z.object({
    type: z.literal('interruption'),
    interruption_event: z
      .object({
        event_id: z.number().int().nullable().describe('ID of the event that was interrupted.'),
      })
      .nullable()
      .describe('Interruption event data'),
  }),
  z.object({
    type: z.literal('ping'),
    ping_event: z
      .object({
        event_id: z.number().int().nullable().describe('Unique identifier for the ping event.'),
        ping_ms: z
          .number()
          .int()
          .nullable()
          .describe('Measured round-trip latency in milliseconds.'),
      })
      .nullable()
      .describe('Ping event data'),
  }),
  z.object({
    type: z.literal('client_tool_call'),
    client_tool_call: z
      .object({
        tool_name: z.string().nullable().describe('Identifier of the tool to be executed.'),
        tool_call_id: z
          .string()
          .nullable()
          .describe('Unique identifier for this tool call request.'),
        parameters: z
          .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
          .nullable()
          .describe('Tool-specific parameters for the execution request.'),
      })
      .nullable()
      .describe(''),
  }),
  z.object({
    type: z.literal('contextual_update'),
    text: z.string().describe('Contextual information to be added to the conversation state.'),
  }),
  z.object({
    type: z.literal('vad_score'),
    vad_score_event: z
      .object({
        vad_score: z
          .number()
          .min(0)
          .max(1)
          .describe('Voice activity detection confidence score between 0 and 1'),
      })
      .nullable()
      .describe('VAD event data'),
  }),
  z.object({
    type: z.literal('internal_tentative_agent_response'),
    tentative_agent_response_internal_event: z
      .object({
        tentative_agent_response: z.string().describe('Preliminary text from the agent'),
      })
      .nullable(),
  }),
]);

export type ElevenLabsIncomingSocketMessage = z.infer<typeof elevenLabsIncomingSocketMessageSchema>;
