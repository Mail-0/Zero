import { Redis } from '@upstash/redis';
import { env } from '@/lib/env';
import { Resend } from 'resend';

export const resend = env.RESEND_API_KEY
  ? new Resend(env.RESEND_API_KEY)
  : { emails: { send: async (...args: any[]) => console.log(args) } };

export const redis = new Redis({ url: env.REDIS_URL, token: env.REDIS_TOKEN });
