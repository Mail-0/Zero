import { MailAssetCache, type MailAssetBucket } from './mail-asset-cache';

type SummaryMetadata = { summary?: unknown; connection?: unknown };

export interface ShortSummaryDeps {
  getMetadata(threadId: string): Promise<SummaryMetadata | undefined>;
  bucket: MailAssetBucket;
  summarize(text: string): Promise<string | undefined>;
}

const caches = new WeakMap<MailAssetBucket, MailAssetCache>();
const cacheFor = (bucket: MailAssetBucket) => {
  let cache = caches.get(bucket);
  if (!cache) {
    cache = new MailAssetCache(bucket, 'thread-short-summary');
    caches.set(bucket, cache);
  }
  return cache;
};

/**
 * Returns the condensed summary for a thread, or null when the thread has no stored
 * summary for this connection. The model output is cached in R2 keyed by the stored
 * long summary, so it is only recomputed when the thread is re-summarized.
 */
export async function getShortThreadSummary(
  deps: ShortSummaryDeps,
  threadId: string,
  connectionId: string,
): Promise<string | null> {
  const metadata = await deps.getMetadata(threadId);
  const summary = metadata?.summary;
  if (typeof summary !== 'string' || !summary) return null;
  if (metadata?.connection !== connectionId) return null;
  return shortenThreadSummary(deps, threadId, connectionId, summary);
}

/**
 * Condenses a long summary the caller already has (e.g. one just generated, before
 * the Vectorize write is readable). Shares the R2 cache with getShortThreadSummary.
 */
export async function shortenThreadSummary(
  deps: Pick<ShortSummaryDeps, 'bucket' | 'summarize'>,
  threadId: string,
  connectionId: string,
  summary: string,
): Promise<string | null> {
  const short = await cacheFor(deps.bucket).read(['v1', connectionId, threadId, summary], () =>
    deps.summarize(summary),
  );
  return short ?? null;
}

export function shortSummaryDepsFromEnv(env: {
  VECTORIZE: VectorizeIndex;
  THREADS_BUCKET: R2Bucket;
}): ShortSummaryDeps {
  return {
    getMetadata: async (threadId) => {
      const [vector] = await env.VECTORIZE.getByIds([threadId]);
      return vector?.metadata as SummaryMetadata | undefined;
    },
    bucket: env.THREADS_BUCKET,
    summarize: async (text) => {
      // Loaded lazily: ai-models reads the Workers env, which unit tests can't import.
      const [{ generateText }, { miniModel }] = await Promise.all([
        import('ai'),
        import('./ai-models'),
      ]);
      const { text: short } = await generateText({
        model: miniModel(),
        system:
          'Condense the email thread summary you are given into one or two plain sentences. Output only the condensed summary.',
        prompt: text,
        maxTokens: 120,
      });
      return short.trim() || undefined;
    },
  };
}
