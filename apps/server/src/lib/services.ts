import { Redis } from '@upstash/redis';
import type { AppEnv } from '../ctx';
import { Resend } from 'resend';

export const resend = (env: AppEnv) =>
  env.RESEND_API_KEY
    ? new Resend(env.RESEND_API_KEY)
    : { emails: { send: async (...args: unknown[]) => console.log(args) } };

export const redis = (env: AppEnv) => new Redis({ url: env.REDIS_URL, token: env.REDIS_TOKEN });
