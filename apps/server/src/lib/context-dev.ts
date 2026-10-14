import { env } from '../env';

/**
 * context.dev (https://docs.context.dev) powers web search and file-to-Markdown
 * conversion for the AI chat.
 */
const API = 'https://api.context.dev/v1';

export type WebSearchResult = { title: string; url: string; content: string };

type RawSearchResult = {
  url: string;
  title: string;
  description: string;
  relevance: 'high' | 'medium' | 'low';
  highlights?: { highlights: string[] | null; code: string };
};

const MAX_RESULTS = 6;
const MAX_PASSAGE_CHARS = 1200;

const apiKey = () => {
  if (!env.CONTEXT_DEV_API_KEY) throw new Error('CONTEXT_DEV_API_KEY is not set');
  return env.CONTEXT_DEV_API_KEY;
};

/** Ranked web results, each with the passages most relevant to the query. */
export async function searchWeb(query: string, signal?: AbortSignal): Promise<WebSearchResult[]> {
  const res = await fetch(`${API}/web/search`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: query.slice(0, 500),
      numResults: 10,
      highlightsOptions: { enabled: true, maxCharacters: MAX_PASSAGE_CHARS },
    }),
    signal,
  });
  if (!res.ok) throw new Error(`context.dev search failed: ${res.status} ${await res.text()}`);
  const { results } = (await res.json()) as { results: RawSearchResult[] };
  return results
    .filter((r) => r.relevance !== 'low')
    .slice(0, MAX_RESULTS)
    .map((r) => ({
      title: r.title,
      url: r.url,
      content: (r.highlights?.highlights?.join('\n') || r.description).slice(0, MAX_PASSAGE_CHARS),
    }));
}

/** Converts a document (PDF, DOCX, XLSX, PPTX, HTML, ...) to Markdown. */
export async function parseFileToMarkdown(
  bytes: ArrayBuffer,
  filename: string,
  contentType: string,
): Promise<string> {
  const extension = filename.includes('.') ? filename.split('.').pop()!.toLowerCase() : '';
  const params = new URLSearchParams({ ocr: 'true' });
  if (extension) params.set('extension', extension);
  const res = await fetch(`${API}/parse?${params}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      'Content-Type': contentType || 'application/octet-stream',
    },
    body: bytes,
  });
  if (!res.ok) throw new Error(`context.dev parse failed: ${res.status} ${await res.text()}`);
  return ((await res.json()) as { markdown: string }).markdown;
}
