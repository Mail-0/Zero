import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  emptyStringAsUndefined: true,
  onValidationError: (issues) => {
    console.error("Failed to validate environment variables, Please make sure these are valid:");
    console.error(issues.map((issue) => `${issue.path}: ${issue.message}`).join("\n"));
    process.exit(1);
  },
  server: {
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    DATABASE_URL: z.string().min(1),
    BETTER_AUTH_SECRET: z.string().min(1),
    BETTER_AUTH_URL: z.string().min(1).url(),
    BETTER_AUTH_TRUSTED_ORIGINS: z
      .string()
      .transform((s) => s.split(",").map((origin) => origin.trim()))
      .pipe(z.array(z.string().url())),
    GOOGLE_CLIENT_ID: z.string().min(1),
    GOOGLE_CLIENT_SECRET: z.string().min(1),
    GOOGLE_REDIRECT_URI: z.string().min(1).url(),
    GITHUB_CLIENT_ID: z.string().min(1),
    GITHUB_CLIENT_SECRET: z.string().min(1),
    REDIS_URL: z.string().min(1).url().optional(),
    REDIS_TOKEN: z.string().min(1).optional(),
    RESEND_API_KEY: z.string().min(1).optional(),
  },
  client: {
    NEXT_PUBLIC_APP_URL: z.string().min(1).url(),
  },
  experimental__runtimeEnv: {
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    ...process.env,
  },
});
