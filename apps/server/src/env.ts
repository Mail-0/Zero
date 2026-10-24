import type { ThinkingMCP, WorkflowRunner, ZeroDB, ZeroMCP } from './main';
import type { ZeroAgent, ZeroDriver } from './routes/agent';
import type { GmailQuota } from './routes/gmail-quota';
import { env as _env } from 'cloudflare:workers';
import type { QueryableHandler } from 'dormroom';

export type ZeroEnv = {
  /** Account assistant credentials; Keiki is the sole assistant runtime. */
  KEIKI_API_KEY?: string;
  /** One shared Keiki agent; users are isolated by conversation/principal. */
  KEIKI_AGENT_ID?: string;
  KEIKI_PLATFORM_URL?: string;
  /** Public callback origin, e.g. a dev tunnel; defaults to the backend URL. */
  KEIKI_CALLBACK_URL?: string;
  KEIKI_WEBHOOK_SECRET?: string;
  KEIKI_MODEL?: string;
  KEIKI_PHOTON_LINE?: string;
  GMAIL_QUOTA: DurableObjectNamespace<GmailQuota>;
  GMAIL_PROJECT_QUOTA_PER_MINUTE?: string;
  GMAIL_MAILBOX_QUOTA_PER_MINUTE?: string;
  ZERO_DRIVER: DurableObjectNamespace<ZeroDriver & QueryableHandler>;
  ZERO_DB: DurableObjectNamespace<ZeroDB>;
  ZERO_AGENT: DurableObjectNamespace<ZeroAgent>;
  ZERO_MCP: DurableObjectNamespace<ZeroMCP & QueryableHandler>;
  THINKING_MCP: DurableObjectNamespace<ThinkingMCP & QueryableHandler>;
  WORKFLOW_RUNNER: DurableObjectNamespace<WorkflowRunner & QueryableHandler>;
  HYPERDRIVE: { connectionString: string };
  snoozed_emails: KVNamespace;
  gmail_sub_age: KVNamespace;
  subscribe_queue: Queue;
  AI: Ai;
  prompts_storage: KVNamespace;
  NODE_ENV: 'local' | 'development' | 'production';
  JWT_SECRET: 'secret';
  ELEVENLABS_API_KEY: '1234567890';
  DISABLE_CALLS: 'true' | '';
  DROP_AGENT_TABLES: 'false';
  THREAD_SYNC_MAX_COUNT: '5' | '20' | '10';
  THREAD_SYNC_LOOP: 'false' | 'true';
  DISABLE_WORKFLOWS: 'true' | 'false';
  AUTORAG_ID: '';
  CLOUDFLARE_ACCOUNT_ID: '';
  CLOUDFLARE_API_TOKEN: '';
  BASE_URL: string;
  VITE_PUBLIC_APP_URL: string;
  DATABASE_URL: string;
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  RESEND_API_KEY: string;
  VITE_PUBLIC_POSTHOG_KEY: string;
  VITE_PUBLIC_POSTHOG_HOST: string;
  COOKIE_DOMAIN: string;
  BETTER_AUTH_TRUSTED_ORIGINS: string;
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  GOOGLE_REDIRECT_URI: string;
  GOOGLE_APPLICATION_CREDENTIALS: string;
  HISTORY_OFFSET: string;
  ZERO_CLIENT_ID: string;
  ZERO_CLIENT_SECRET: string;
  VITE_PUBLIC_BACKEND_URL: string;
  REDIS_URL: string;
  REDIS_TOKEN: string;
  BRAIN_URL: string;
  COMPOSIO_API_KEY: string;
  GROQ_API_KEY: string;
  EARLY_ACCESS_ENABLED: string;
  GOOGLE_GENERATIVE_AI_API_KEY: string;
  AUTUMN_SECRET_KEY: string;
  AI_SYSTEM_PROMPT: string;
  TWILIO_ACCOUNT_SID: string;
  TWILIO_AUTH_TOKEN: string;
  TWILIO_PHONE_NUMBER: string;
  VITE_PUBLIC_ELEVENLABS_AGENT_ID: string;
  REACT_SCAN: string;
  MICROSOFT_CLIENT_ID: string;
  MICROSOFT_CLIENT_SECRET: string;
  VOICE_SECRET: string;
  ARCADE_API_KEY: string;
  OPENROUTER_API_KEY: string;
  OPENROUTER_MODEL?: string;
  OPENROUTER_MINI_MODEL?: string;
  CONTEXT_DEV_API_KEY: string;
  GOOGLE_S_ACCOUNT: string;
  GOOGLE_SERVICE_ACCOUNT?: string;
  GMAIL_PUSH_URL?: string;
  AXIOM_API_TOKEN: string;
  AXIOM_DATASET: string;
  /**
   * Comma-separated `version:base64Key` pairs of 32-byte AES-256-GCM keys for IMAP/SMTP
   * credentials, e.g. `2:...,1:...`. The highest version encrypts; any listed version decrypts.
   */
  CREDENTIALS_ENCRYPTION_KEYS?: string;
  /** `'true'` enables adding IMAP/SMTP connections. */
  IMAP_ENABLED?: string;
  /**
   * `'false'` disables IMAP IDLE push (mailboxes then only poll every minute). IDLE runs
   * only while the user is active, on servers that advertise the IDLE capability.
   */
  IMAP_IDLE_ENABLED?: string;
  THREADS_BUCKET: R2Bucket;
  thread_queue: Queue;
  VECTORIZE: VectorizeIndex;
  VECTORIZE_MESSAGE: VectorizeIndex;
};

const env = _env as unknown as ZeroEnv;
export { env };
