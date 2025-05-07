import { Redis } from '@upstash/redis';
import { Resend } from 'resend';

export const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : { emails: { send: async (...args: any[]) => console.log(args) } };

export const redis = new Redis({ url: process.env.REDIS_URL, token: process.env.REDIS_TOKEN });
