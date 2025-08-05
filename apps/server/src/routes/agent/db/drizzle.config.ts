import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  out: './drizzle',
  schema: 'schema.ts',
  dialect: 'sqlite',
  driver: 'durable-sqlite',
});
