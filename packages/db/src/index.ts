import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from './schema';
import postgres from 'postgres';

export const createDb = (url: string) => {
  const conn = postgres(url);
  const db = drizzle(conn, { schema });
  return db;
};

export type DB = ReturnType<typeof createDb>;
