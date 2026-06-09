import { createDb } from '../db';
import { category, user } from '../db/schema';
import type { ZeroEnv } from '../env';
import { and, asc, eq } from 'drizzle-orm';

const getDatabaseUrl = (env: ZeroEnv) => env.HYPERDRIVE?.connectionString || env.DATABASE_URL;

export const DEFAULT_USER_CATEGORIES = [
  'academic',
  'work-related',
  'advertisement',
  'event',
  'seminar',
  'survey',
  'policy',
  'culture',
  'startup',
  'personal',
  'spam',
  'uncategorized',
] as const;

export type CategoryRecord = typeof category.$inferSelect;

export type CategoryUpdateInput = {
  categoryName: string;
  promptHint: string;
};

export type CategoryCreateInput = {
  categoryName: string;
  promptHint: string;
};

const mapCategory = (record: CategoryRecord) => ({
  categoryId: record.categoryId,
  categoryName: record.categoryName,
  promptHint: record.promptHint,
  enabled: record.enabled,
});

export async function ensureDefaultCategories(env: ZeroEnv, userId: string): Promise<void> {
  const databaseUrl = getDatabaseUrl(env);
  if (!databaseUrl) {
    throw new Error('Database connection not configured');
  }

  const { db, conn } = createDb(databaseUrl);

  try {
    const [existingForUser] = await db
      .select({ userId: category.userId })
      .from(category)
      .innerJoin(user, eq(category.userId, user.id))
      .where(eq(user.id, userId))
      .limit(1);

    if (existingForUser) {
      return;
    }

    const now = new Date();
    await db.insert(category).values(
      DEFAULT_USER_CATEGORIES.map((categoryName) => ({
        categoryId: crypto.randomUUID(),
        userId,
        categoryName,
        promptHint: '',
        enabled: true,
        createdAt: now,
        updatedAt: now,
      })),
    );
  } finally {
    await conn.end();
  }
}

export async function getOrCreateUserCategories(
  env: ZeroEnv,
  userId: string,
): Promise<ReturnType<typeof mapCategory>[]> {
  await ensureDefaultCategories(env, userId);

  const databaseUrl = getDatabaseUrl(env);
  if (!databaseUrl) {
    throw new Error('Database connection not configured');
  }

  const { db, conn } = createDb(databaseUrl);

  try {
    const rows = await db
      .select()
      .from(category)
      .where(and(eq(category.userId, userId), eq(category.enabled, true)))
      .orderBy(asc(category.categoryName));

    return rows.map(mapCategory);
  } finally {
    await conn.end();
  }
}

export async function createUserCategory(
  env: ZeroEnv,
  userId: string,
  input: CategoryCreateInput,
): Promise<ReturnType<typeof mapCategory>> {
  const databaseUrl = getDatabaseUrl(env);
  if (!databaseUrl) {
    throw new Error('Database connection not configured');
  }

  const { db, conn } = createDb(databaseUrl);
  const now = new Date();
  const categoryName = input.categoryName.trim();

  if (!categoryName) {
    throw new Error('Category name is required');
  }

  try {
    const [created] = await db
      .insert(category)
      .values({
        categoryId: crypto.randomUUID(),
        userId,
        categoryName,
        promptHint: input.promptHint.trim(),
        enabled: true,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return mapCategory(created);
  } finally {
    await conn.end();
  }
}

export async function updateUserCategory(
  env: ZeroEnv,
  userId: string,
  categoryId: string,
  input: CategoryUpdateInput,
): Promise<ReturnType<typeof mapCategory>> {
  const databaseUrl = getDatabaseUrl(env);
  if (!databaseUrl) {
    throw new Error('Database connection not configured');
  }

  const { db, conn } = createDb(databaseUrl);
  const categoryName = input.categoryName.trim();

  if (!categoryName) {
    throw new Error('Category name is required');
  }

  try {
    const [updated] = await db
      .update(category)
      .set({
        categoryName,
        promptHint: input.promptHint.trim(),
        updatedAt: new Date(),
      })
      .where(and(eq(category.categoryId, categoryId), eq(category.userId, userId)))
      .returning();

    if (!updated) {
      throw new Error('Category not found');
    }

    return mapCategory(updated);
  } finally {
    await conn.end();
  }
}

export async function deleteUserCategory(
  env: ZeroEnv,
  userId: string,
  categoryId: string,
): Promise<void> {
  const databaseUrl = getDatabaseUrl(env);
  if (!databaseUrl) {
    throw new Error('Database connection not configured');
  }

  const { db, conn } = createDb(databaseUrl);

  try {
    const result = await db
      .delete(category)
      .where(and(eq(category.categoryId, categoryId), eq(category.userId, userId)))
      .returning({ categoryId: category.categoryId });

    if (result.length === 0) {
      throw new Error('Category not found');
    }
  } finally {
    await conn.end();
  }
}
