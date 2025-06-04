import { z } from 'zod';

export const elevenLabsOutgoingSocketMessageSchema = z.union([
  z.object({
    user_audio_chunk: z.string(),
  }),
  z.object({
    type: z.literal('pong'),
    event_id: z.number().int(),
  }),
  z.object({
    type: z.literal('conversation_initiation_client_data'),
    conversation_config_override: z
      .object({
        agent: z
          .object({
            prompt: z
              .object({
                prompt: z.string().nullable().default(null),
              })
              .optional(),
            first_message: z.string().optional(),
            language: z.string().optional(),
          })
          .optional(),
        tts: z
          .object({
            voice_id: z.string(),
          })
          .optional(),
      })
      .optional(),
    custom_llm_extra_body: z
      .object({
        temperature: z.number().int().optional(),
        max_tokens: z.number().int().optional(),
      })
      .optional(),
    dynamic_variables: z
      .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
      .optional(),
  }),
  z.object({
    type: z.literal('client_tool_result'),
    tool_call_id: z.string().optional(),
    result: z.string().optional(),
    is_error: z.boolean().optional(),
  }),
  z.object({
    type: z.literal('contextual_update'),
    text: z.string(),
  }),
  z.object({
    type: z.literal('user_message'),
    text: z.string().optional(),
  }),
  z.object({
    type: z.literal('user_activity'),
  }),
]);

export type ElevenLabsOutgoingSocketMessage = z.infer<typeof elevenLabsOutgoingSocketMessageSchema>;
