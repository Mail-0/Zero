import { keys as database } from '@zero/db/keys';
import { createEnv } from '@t3-oss/env-nextjs';
import { z } from 'zod';

export const env = createEnv({
	/**
	 * Extend the environment variables schema with the database keys
	 */
	extends: [database()],
	/**
	 * Server-side environment variables schema
	 */
	server: {
		BETTER_AUTH_SECRET: z.string().min(1),
		BETTER_AUTH_URL: z.string().url(),
		BETTER_AUTH_TRUSTED_ORIGINS: z.string().min(1),
		GOOGLE_CLIENT_ID: z.string().min(1),
		GOOGLE_CLIENT_SECRET: z.string().min(1),
		GOOGLE_REDIRECT_URI: z.string().url(),
		GITHUB_CLIENT_ID: z.string().min(1),
		GITHUB_CLIENT_SECRET: z.string().min(1),
		GITHUB_REDIRECT_URI: z.string().url(),
		REDIS_URL: z.string().min(1),
		REDIS_TOKEN: z.string().min(1),
		RESEND_API_KEY: z.string().min(1),
		OPENAI_API_KEY: z.string().min(1),
		AI_SYSTEM_PROMPT: z.string().optional(),
	},
	/**
	 * Client-side environment variables schema
	 */
	client: {
		NEXT_PUBLIC_APP_URL: z.string().url(),
	},
	/**
	 * You can't destructure `process.env` as a regular object in the Next.js edge runtimes (e.g.
	 * middlewares) or client-side so we need to destruct manually.
	 */
	runtimeEnv: {
		BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
		BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
		BETTER_AUTH_TRUSTED_ORIGINS: process.env.BETTER_AUTH_TRUSTED_ORIGINS,
		GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
		GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
		GOOGLE_REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI,
		GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID,
		GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET,
		GITHUB_REDIRECT_URI: process.env.GITHUB_REDIRECT_URI,
		REDIS_URL: process.env.REDIS_URL,
		REDIS_TOKEN: process.env.REDIS_TOKEN,
		RESEND_API_KEY: process.env.RESEND_API_KEY,
		OPENAI_API_KEY: process.env.OPENAI_API_KEY,
		AI_SYSTEM_PROMPT: process.env.AI_SYSTEM_PROMPT,
		NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
	},
	/**
	 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` or `CI` to skip environment validation.
	 * This is especially useful for Docker builds.
	 */
	skipValidation: !!process.env.SKIP_ENV_VALIDATION || !!process.env.CI,
});
