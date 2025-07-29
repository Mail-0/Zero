import { env } from 'cloudflare:workers';
import Cloudflare from 'cloudflare';

// KV namespace IDs for different environments
const KV_NAMESPACE_IDS = {
  local: 'b7db3a98a80f4e16a8b6edc5fa8c7b76',
  staging: 'b7db3a98a80f4e16a8b6edc5fa8c7b76',
  production: '3348ff0976284269a8d8a5e6e4c04c56',
} as const;

export type Environment = 'local' | 'staging' | 'production';

export interface BulkDeleteResult {
  successful: number;
  failed: number;
}

/**
 * Bulk delete keys from Cloudflare KV namespace
 * @param keys Array of keys to delete
 * @param environment Environment to use (defaults to 'local')
 * @returns Promise with deletion results
 */
export const bulkDeleteKeys = async (
  keys: string[],
  environment: Environment = env.NODE_ENV as Environment,
): Promise<BulkDeleteResult> => {
  if (environment === 'local') {
    await Promise.all(keys.map((key) => env.gmail_processing_threads.delete(key)));
    return { successful: keys.length, failed: 0 };
  }
  if (keys.length === 0) {
    return { successful: 0, failed: 0 };
  }

  const namespaceId = KV_NAMESPACE_IDS[environment];
  const accountId = env.CLOUDFLARE_ACCOUNT_ID;

  if (!accountId) {
    console.error('[BULK_DELETE] CLOUDFLARE_ACCOUNT_ID environment variable not set');
    return { successful: 0, failed: keys.length };
  }

  try {
    const cloudflareClient = new Cloudflare({
      apiToken: env.CLOUDFLARE_API_TOKEN || '',
    });
    const response = await cloudflareClient.kv.namespaces.bulkDelete(namespaceId, {
      account_id: accountId,
      body: keys,
    });

    const successful = response?.successful_key_count || 0;
    const failed = keys.length - successful;

    console.log(`[BULK_DELETE] Successfully deleted ${successful}/${keys.length} keys`);
    if (failed > 0) {
      console.warn(`[BULK_DELETE] Failed to delete ${failed} keys`);
    }

    return { successful, failed };
  } catch (error) {
    console.error('[BULK_DELETE] Failed to bulk delete keys:', error);
    return { successful: 0, failed: keys.length };
  }
};
