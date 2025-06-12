import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from './schema';
import postgres from 'postgres';

export const createDb = (url: string) => {
  console.log('🐛 createDb called with:', url);
  const conn = postgres(url, {
    ssl: 'require',
    host: 'ep-solitary-butterfly-a5k6o5wv-pooler.us-east-2.aws.neon.tech',   // 👈 override .local redirect
    hostname: 'ep-solitary-butterfly-a5k6o5wv-pooler.us-east-2.aws.neon.tech', // 👈 resolve actual Neon host
  });

  const db = drizzle(conn, { schema, logger: true });
  
  return db;
};

export type DB = ReturnType<typeof createDb>;
