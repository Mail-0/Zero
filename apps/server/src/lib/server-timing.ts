import type { Context } from 'hono';

/** Durations only: never put account IDs, search text or mail content in headers. */
export async function withServerTiming<T>(
  context: Pick<Context, 'header'>,
  name: string,
  run: () => Promise<T>,
): Promise<T> {
  const started = performance.now();
  try {
    return await run();
  } finally {
    context.header('Server-Timing', `${name};dur=${(performance.now() - started).toFixed(1)}`, {
      append: true,
    });
  }
}
