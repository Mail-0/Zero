import { unwrapGmailError } from './gmail-quota-error';

export async function loadGmailInlineAsset(load: () => Promise<string | undefined>) {
  try {
    return await load();
  } catch (error) {
    const original = unwrapGmailError(error) as
      | { code?: number | string; response?: { status?: number } }
      | undefined;
    // A missing attachment must not escape as a missing thread: the import
    // coordinator tombstones threads on 404. All other failures need retry.
    if (Number(original?.response?.status ?? original?.code) === 404) return undefined;
    throw error;
  }
}
