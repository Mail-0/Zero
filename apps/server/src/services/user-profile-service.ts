import { createDb } from '../db';
import { userProfile } from '../db/schema';
import type { ZeroEnv } from '../env';
import { eq } from 'drizzle-orm';

const getDatabaseUrl = (env: ZeroEnv) => env.HYPERDRIVE?.connectionString || env.DATABASE_URL;

export type UserProfileRecord = typeof userProfile.$inferSelect;

export type UserProfileUpdateInput = {
  occupation: string;
  affiliation: string[];
  interest: string[];
};

const normalizeStringList = (values: string[]) =>
  Array.from(
    new Set(
      values
        .map((value) => value.trim())
        .filter((value) => value.length > 0),
    ),
  );

export async function hasUserProfile(env: ZeroEnv, userId: string): Promise<boolean> {
  const databaseUrl = getDatabaseUrl(env);
  if (!databaseUrl) {
    return false;
  }

  const { db, conn } = createDb(databaseUrl);

  try {
    const [existing] = await db
      .select({ userId: userProfile.userId })
      .from(userProfile)
      .where(eq(userProfile.userId, userId))
      .limit(1);

    return !!existing;
  } finally {
    await conn.end();
  }
}

export async function getOrCreateUserProfile(
  env: ZeroEnv,
  userId: string,
  userName?: string | null,
): Promise<UserProfileRecord> {
  const databaseUrl = getDatabaseUrl(env);
  if (!databaseUrl) {
    throw new Error('Database connection not configured');
  }

  const { db, conn } = createDb(databaseUrl);

  try {
    const [existing] = await db
      .select()
      .from(userProfile)
      .where(eq(userProfile.userId, userId))
      .limit(1);

    if (existing) {
      return existing;
    }

    const [created] = await db
      .insert(userProfile)
      .values({
        userId,
        name: userName?.trim() || '',
      })
      .returning();

    return created;
  } finally {
    await conn.end();
  }
}

export async function updateUserProfile(
  env: ZeroEnv,
  userId: string,
  input: UserProfileUpdateInput,
  userName?: string | null,
): Promise<UserProfileRecord> {
  const databaseUrl = getDatabaseUrl(env);
  if (!databaseUrl) {
    throw new Error('Database connection not configured');
  }

  const { db, conn } = createDb(databaseUrl);
  const now = new Date();
  const payload = {
    occupation: input.occupation.trim(),
    affiliation: normalizeStringList(input.affiliation),
    interest: normalizeStringList(input.interest),
    updatedAt: now,
  };

  try {
    const [existing] = await db
      .select({ userId: userProfile.userId })
      .from(userProfile)
      .where(eq(userProfile.userId, userId))
      .limit(1);

    if (!existing) {
      const [created] = await db
        .insert(userProfile)
        .values({
          userId,
          name: userName?.trim() || '',
          ...payload,
        })
        .returning();

      return created;
    }

    const [updated] = await db
      .update(userProfile)
      .set(payload)
      .where(eq(userProfile.userId, userId))
      .returning();

    return updated;
  } finally {
    await conn.end();
  }
}
