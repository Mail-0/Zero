import type { Route } from './+types/api.i18n.chunks.$locale.$chunk';
import { ChunkedTranslationLoader } from '@/i18n/chunked-loader';
import { createI18nResponse } from '@/i18n/enhanced-request';
import { getMessages } from '@/i18n/enhanced-request';
import { createI18nCache } from '@/i18n/cache';

export async function loader({ params, request, context }: Route.LoaderArgs) {
  const { locale, chunk } = params;
  const cache = createI18nCache(context?.cloudflare?.env.translations_cache);

  // Check cache headers
  const ifNoneMatch = request.headers.get('If-None-Match');
  const etag = cache.getETag(locale as any);

  if (ifNoneMatch && etag && ifNoneMatch === etag) {
    return new Response(null, { status: 304 });
  }

  if (!locale) {
    return new Response('Cache not found', { status: 500 });
  }

  try {
    // Load base messages
    const baseMessages = await getMessages(locale, context?.cloudflare?.env.translations_cache);

    // Handle special "main" chunk - return complete translations
    if (chunk === 'main') {
      return createI18nResponse(baseMessages, locale as any, cache);
    }

    // Create chunked loader for specific chunks
    const loader = new ChunkedTranslationLoader(baseMessages);

    // Load specific chunk
    const chunkData = await loader.loadChunk(chunk as string, locale as any);

    return createI18nResponse(chunkData.messages as any, locale as any, cache);
  } catch (error) {
    console.error(`Failed to load chunk ${chunk} for locale ${locale}:`, error);
    return new Response('Chunk not found', { status: 404 });
  }
}

export async function action({ params, request, context }: Route.ActionArgs) {
  // Handle POST requests for bulk chunk loading
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const { locale } = params;
  const { chunkIds } = await request.json<{ chunkIds: string[] }>();

  if (!Array.isArray(chunkIds)) {
    return new Response('Invalid chunk IDs', { status: 400 });
  }

  try {
    const baseMessages = await getMessages(
      locale as string,
      context?.cloudflare?.env.translations_cache,
    );
    const loader = new ChunkedTranslationLoader(baseMessages);

    // Load multiple chunks in parallel
    const chunks = await Promise.all(
      chunkIds.map((chunkId) => loader.loadChunk(chunkId, locale as any)),
    );

    // Combine all chunk messages
    const combinedMessages = chunks.reduce(
      (acc, chunk) => ({
        ...acc,
        ...chunk.messages,
      }),
      {},
    );

    return new Response(
      JSON.stringify({
        locale,
        messages: combinedMessages,
        chunks: chunks.map((c) => ({ id: c.id, priority: c.priority })),
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
          Vary: 'Accept-Language',
        },
      },
    );
  } catch (error) {
    console.error(`Failed to load chunks for locale ${locale}:`, error);
    return new Response('Failed to load chunks', { status: 500 });
  }
}
