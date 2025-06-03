import { activeConnectionProcedure } from '../../trpc';
import { ElevenLabsClient } from 'elevenlabs';
import { env } from 'cloudflare:workers';

const elevenLabs = new ElevenLabsClient({
  apiKey: env.ELEVENLABS_API_KEY,
});

export const getSignedUrl = activeConnectionProcedure.query(async ({ ctx }) => {
  const response = await elevenLabs.conversationalAi.getSignedUrl({
    agent_id: env.ELEVENLABS_AGENT_ID,
  });

  return {
    signedUrl: response.signed_url,
    cookie: ctx.c.req.header('cookie'),
  };
});
