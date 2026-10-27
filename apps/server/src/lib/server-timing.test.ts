import { withServerTiming } from './server-timing';
import { describe, expect, it } from 'vitest';
import { Hono } from 'hono';

describe('server timing', () => {
  it('keeps separate stage timings without changing the result', async () => {
    const app = new Hono().get('/', async (c) => {
      const result = await withServerTiming(c, 'session', async () => 'ok');
      await withServerTiming(c, 'thread_read', async () => undefined);
      return c.text(result);
    });
    const response = await app.request('/');
    expect(await response.text()).toBe('ok');
    expect(response.headers.get('Server-Timing')).toMatch(/session;dur=\d+\.\d/);
    expect(response.headers.get('Server-Timing')).toMatch(/thread_read;dur=\d+\.\d/);
  });

  it('records failed stages and preserves the original error', async () => {
    const failure = new Error('Read failed');
    const app = new Hono().get('/', async (c) => {
      await expect(
        withServerTiming(c, 'thread_read', async () => {
          throw failure;
        }),
      ).rejects.toBe(failure);
      return c.text('unavailable', 503);
    });
    const response = await app.request('/');
    expect(response.status).toBe(503);
    expect(response.headers.get('Server-Timing')).toMatch(/thread_read;dur=\d+\.\d/);
  });
});
