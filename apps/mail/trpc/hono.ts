import { type auth } from '@/lib/auth';
import { type Context } from 'hono';
import { type db } from '@zero/db';

export type HonoVariables = {
  session: Awaited<ReturnType<typeof auth.api.getSession>>;
  db: typeof db;
};

export type HonoContext = Context<{ Variables: HonoVariables }>;
