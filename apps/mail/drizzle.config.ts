import { type Config } from 'drizzle-kit';
import { env } from './env';

export default {
	schema: './db/schema.ts',
	dialect: 'postgresql',
	dbCredentials: {
		url: env.DATABASE_URL,
	},
	out: './db/migrations',
	tablesFilter: ['mail0_*'],
} satisfies Config;
