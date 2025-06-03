import type { env } from 'cloudflare:workers';
import type { Autumn } from 'autumn-js';
import type { Auth } from './lib/auth';
import type { DB } from './db';

export type SessionUser = NonNullable<Awaited<ReturnType<Auth['api']['getSession']>>>['user'];

export type HonoVariables = {
  auth: Auth;
  sessionUser?: SessionUser;
  db: DB;
  autumn: Autumn;
};

export type HonoContext = { Variables: HonoVariables; Bindings: typeof env };
