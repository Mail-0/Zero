import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from './schema';
import postgres from 'postgres';

// Export schema types and tables
export * from "./schema";
export * from "./theme_settings_presets";
export * from "./theme_settings_default";

// Create database connection
export const createDb = (url: string) => {
  const conn = postgres(url);
  const db = drizzle(conn, { schema });
  return db;
};

export type DB = ReturnType<typeof createDb>;
