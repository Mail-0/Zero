import {
  MAX_ATTACHMENT_BYTES,
  isSupportedAttachment,
  readAttachment,
  storeAttachment,
} from '../lib/chat-attachments';
import { getZeroDB } from '../lib/server-utils';
import type { HonoContext } from '../ctx';
import { Hono } from 'hono';

/** Upload and download for files attached to AI chat messages. */
export const chatAttachmentsRouter = new Hono<HonoContext>()
  .post('/', async (c) => {
    const user = c.var.sessionUser;
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const form = await c.req.formData().catch(() => null);
    const connectionId = form?.get('connectionId');
    const file = form?.get('file') as unknown;
    if (typeof connectionId !== 'string' || !(file instanceof File)) {
      return c.json({ error: 'Expected connectionId and file' }, 400);
    }

    const owned = await (await getZeroDB(user.id)).findUserConnection(connectionId);
    if (!owned) return c.json({ error: 'Forbidden' }, 403);

    if (file.size > MAX_ATTACHMENT_BYTES) {
      return c.json({ error: `"${file.name}" is larger than 10 MB.` }, 413);
    }
    if (!isSupportedAttachment(file)) {
      return c.json({ error: `"${file.name}" isn't a supported file type.` }, 415);
    }

    try {
      return c.json(await storeAttachment(connectionId, file));
    } catch (error) {
      console.error('[chat-attachments] upload failed', error);
      return c.json({ error: `Couldn't read "${file.name}".` }, 422);
    }
  })
  .get('/:connectionId/:id', async (c) => {
    const user = c.var.sessionUser;
    if (!user) return c.text('Unauthorized', 401);
    const { connectionId, id } = c.req.param();

    const owned = await (await getZeroDB(user.id)).findUserConnection(connectionId);
    if (!owned) return c.text('Not Found', 404);

    const object = await readAttachment(connectionId, id);
    if (!object) return c.text('Not Found', 404);

    const name = object.customMetadata?.name ?? id;
    const contentType = object.httpMetadata?.contentType ?? 'application/octet-stream';
    // Only raster images render inline; anything else (e.g. uploaded HTML) downloads.
    const inline = /^image\/(png|jpeg|gif|webp)$/.test(contentType);
    return new Response(object.body, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(name)}`,
        'Cache-Control': 'private, max-age=86400',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'",
      },
    });
  });
