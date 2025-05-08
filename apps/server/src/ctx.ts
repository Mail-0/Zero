import { type Auth } from './lib/auth';
import { type Context } from 'hono';
import { type DB } from '@zero/db';

// @ts-ignore
export type AppEnv = Env;

export type HonoVariables = {
  auth: Auth;
  session: Awaited<ReturnType<Auth['api']['getSession']>>;
  db: DB;
};

export type HonoContext = Context<{ Variables: HonoVariables; Bindings: AppEnv }>;
