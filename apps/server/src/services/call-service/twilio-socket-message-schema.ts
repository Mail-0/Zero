import { z } from 'zod';

export const twilioSocketMessageSchema = z.discriminatedUnion('event', [
  z.object({
    event: z.literal('connected'),
    protocol: z.string(),
    version: z.string(),
  }),
  z.object({
    event: z.literal('start'),
    sequenceNumber: z.string(),
    start: z.object({
      streamSid: z.string(),
      accountSid: z.string().optional(),
      callSid: z.string(),
      tracks: z.array(z.string()),
      mediaFormat: z.object({
        encoding: z.string(),
        sampleRate: z.number(),
        channels: z.number(),
      }),
    }),
    streamSid: z.string(),
  }),
  z.object({
    event: z.literal('media'),
    streamSid: z.string().optional(),
    track: z.string().optional(),
    chunk: z.string().optional(),
    timestamp: z.string().optional(),
    media: z.object({
      payload: z.string(),
    }),
  }),
  z.object({
    event: z.literal('stop'),
    sequenceNumber: z.string(),
    streamSid: z.string(),
    stop: z.object({
      accountSid: z.string(),
      callSid: z.string(),
    }),
  }),
  z.object({
    event: z.literal('clear'),
    streamSid: z.string(),
  }),
]);

export type TwilioSocketMessage = z.infer<typeof twilioSocketMessageSchema>;
