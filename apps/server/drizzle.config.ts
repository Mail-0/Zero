import { type Config } from 'drizzle-kit';

export default {
  schema: './src/db/schema.ts',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  out: './src/db/migrations',
  tablesFilter: [
    'mail0_*',
    'action_item',
    'action_suggestion',
    'analysis_result',
    'category',
    'correction_record',
    'email',
    'feedback_data',
    'hallucination_mitigation_log',
    'mailbox',
    'mime_content',
    'priority_score',
    'prompt_context',
    'user_profile',
  ],
} satisfies Config;
