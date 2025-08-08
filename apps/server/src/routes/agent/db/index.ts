import { eq, count, inArray, and, sql, desc, lt, like, or } from 'drizzle-orm';
import type { DrizzleSqliteDODatabase } from 'drizzle-orm/durable-sqlite';
import { threads, threadLabels, labels } from './schema';
import type * as schema from './schema';

export type DB = DrizzleSqliteDODatabase<typeof schema>;

export type Thread = typeof threads.$inferSelect;
export type InsertThread = typeof threads.$inferInsert;
export type ThreadLabel = typeof threadLabels.$inferSelect;
export type InsertThreadLabel = typeof threadLabels.$inferInsert;
export type Label = typeof labels.$inferSelect;
export type InsertLabel = typeof labels.$inferInsert;

// Reusable thread selection object to reduce duplication
const threadSelect = {
  id: threads.id,
  threadId: threads.threadId,
  providerId: threads.providerId,
  latestSender: threads.latestSender,
  latestReceivedOn: threads.latestReceivedOn,
  latestSubject: threads.latestSubject,
} as const;

async function createMissingLabels(db: DB, labelIds: string[]): Promise<void> {
  if (labelIds.length === 0) return;

  const existingLabels = await db
    .select({ id: labels.id })
    .from(labels)
    .where(inArray(labels.id, labelIds));

  const existingLabelIds = new Set(existingLabels.map((label) => label.id));
  const missingLabelIds = labelIds.filter((id) => !existingLabelIds.has(id));

  if (missingLabelIds.length > 0) {
    const newLabels: InsertLabel[] = missingLabelIds.map((id) => ({
      id,
      name: id,
      color: '#000000',
    }));

    await db.insert(labels).values(newLabels).onConflictDoNothing();
  }
}

export async function create(db: DB, thread: InsertThread, labelIds?: string[]): Promise<Thread> {
  return await db.transaction(async (tx) => {
    // Create the thread first
    const [res] = await tx
      .insert(threads)
      .values(thread)
      .onConflictDoUpdate({
        target: [threads.id],
        set: thread,
      })
      .returning();

    if (labelIds && labelIds.length > 0) {
      // Ensure all labels exist (create missing ones)
      await createMissingLabels(tx, labelIds);

      // Create thread-label relationships
      const threadLabelInserts: InsertThreadLabel[] = labelIds.map((labelId) => ({
        threadId: thread.id,
        labelId,
      }));

      await tx.insert(threadLabels).values(threadLabelInserts).onConflictDoNothing();
    }

    return res;
  });
}

export async function createLabel(db: DB, label: InsertLabel): Promise<Label> {
  const [res] = await db
    .insert(labels)
    .values(label)
    .onConflictDoUpdate({
      target: [labels.id],
      set: label,
    })
    .returning();
  return res;
}

export async function getLabel(db: DB, labelId: string): Promise<Label | null> {
  const [result] = await db.select().from(labels).where(eq(labels.id, labelId));
  return result || null;
}

export async function getLabels(db: DB): Promise<Label[]> {
  return await db.select().from(labels);
}

export async function ensureLabelsExist(db: DB, labelIds: string[]): Promise<string[]> {
  await createMissingLabels(db, labelIds);
  return labelIds;
}

export async function del(db: DB, params: { id: string }): Promise<Thread | null> {
  const [thread] = await db.delete(threads).where(eq(threads.id, params.id)).returning();
  return thread || null;
}

export async function deleteSpamThreads(
  db: DB,
): Promise<{ deletedCount: number; deletedThreads: Thread[] }> {
  return await db.transaction(async (tx) => {
    const spamThreads = await tx
      .select(threadSelect)
      .from(threads)
      .innerJoin(threadLabels, eq(threads.id, threadLabels.threadId))
      .where(eq(threadLabels.labelId, 'SPAM'));

    if (spamThreads.length === 0) {
      return { deletedCount: 0, deletedThreads: [] };
    }

    const spamThreadIds = spamThreads.map((thread) => thread.id);

    const deletedThreads = await tx
      .delete(threads)
      .where(inArray(threads.id, spamThreadIds))
      .returning();

    return { deletedCount: deletedThreads.length, deletedThreads };
  });
}

export async function get(db: DB, params: { id: string }): Promise<Thread | null> {
  const [result] = await db.select().from(threads).where(eq(threads.id, params.id));
  return result || null;
}

export async function list(db: DB): Promise<Thread[]> {
  return await db.select().from(threads).orderBy(desc(threads.latestReceivedOn));
}

export async function countThreads(db: DB): Promise<number> {
  const [result] = await db.select({ count: count() }).from(threads);
  return result.count;
}

export async function countThreadsByLabels(
  db: DB,
  labelIds: string[],
): Promise<{ labelId: string; count: number }[]> {
  if (labelIds.length === 0) return [];

  const results = await db
    .select({ labelId: threadLabels.labelId, count: count() })
    .from(threadLabels)
    .where(inArray(threadLabels.labelId, labelIds))
    .groupBy(threadLabels.labelId);

  return results;
}

export async function createThreadLabel(
  db: DB,
  threadLabel: InsertThreadLabel,
): Promise<ThreadLabel | null> {
  const [res] = await db.insert(threadLabels).values(threadLabel).onConflictDoNothing().returning();
  return res || null;
}

export async function deleteThreadLabel(
  db: DB,
  params: { threadId: string; labelId: string },
): Promise<void> {
  await db
    .delete(threadLabels)
    .where(
      and(eq(threadLabels.threadId, params.threadId), eq(threadLabels.labelId, params.labelId)),
    );
}

export async function getThreadLabels(db: DB, threadId: string): Promise<Label[]> {
  const results = await db
    .select({
      id: labels.id,
      name: labels.name,
      color: labels.color,
    })
    .from(labels)
    .innerJoin(threadLabels, eq(labels.id, threadLabels.labelId))
    .where(eq(threadLabels.threadId, threadId));
  return results;
}

export async function getLabelThreads(db: DB, labelId: string): Promise<Thread[]> {
  const results = await db
    .select(threadSelect)
    .from(threads)
    .innerJoin(threadLabels, eq(threads.id, threadLabels.threadId))
    .where(eq(threadLabels.labelId, labelId));
  return results;
}

export async function updateThreadLabels(
  db: DB,
  threadId: string,
  labelIds: string[],
): Promise<void> {
  return await db.transaction(async (tx) => {
    // Ensure all labels exist first
    await createMissingLabels(tx, labelIds);

    // Delete existing thread labels
    await tx.delete(threadLabels).where(eq(threadLabels.threadId, threadId));

    if (labelIds.length > 0) {
      const threadLabelInserts: InsertThreadLabel[] = labelIds.map((labelId) => ({
        threadId,
        labelId,
      }));

      await tx.insert(threadLabels).values(threadLabelInserts);
    }
  });
}

export async function addThreadLabels(db: DB, threadId: string, labelIds: string[]): Promise<void> {
  if (labelIds.length === 0) return;

  return await db.transaction(async (tx) => {
    // Ensure all labels exist first
    await createMissingLabels(tx, labelIds);

    // Get existing label IDs for this thread
    const existing = await tx
      .select({ labelId: threadLabels.labelId })
      .from(threadLabels)
      .where(eq(threadLabels.threadId, threadId));

    const existingLabelIds = new Set(existing.map((row) => row.labelId));

    // Filter out labels that already exist
    const newLabelIds = labelIds.filter((labelId) => !existingLabelIds.has(labelId));

    if (newLabelIds.length > 0) {
      const threadLabelInserts: InsertThreadLabel[] = newLabelIds.map((labelId) => ({
        threadId,
        labelId,
      }));

      await tx.insert(threadLabels).values(threadLabelInserts);
    }
  });
}

export async function removeThreadLabels(
  db: DB,
  threadId: string,
  labelIds: string[],
): Promise<void> {
  if (labelIds.length === 0) return;

  await db
    .delete(threadLabels)
    .where(and(eq(threadLabels.threadId, threadId), inArray(threadLabels.labelId, labelIds)));
}

export async function modifyThreadLabels(
  db: DB,
  threadId: string,
  addLabelIds: string[],
  removeLabelIds: string[],
): Promise<{ addedLabels: string[]; removedLabels: string[] }> {
  return await db.transaction(async (tx) => {
    // Remove labels first
    if (removeLabelIds.length > 0) {
      await tx
        .delete(threadLabels)
        .where(
          and(eq(threadLabels.threadId, threadId), inArray(threadLabels.labelId, removeLabelIds)),
        );
    }

    // Add new labels
    if (addLabelIds.length > 0) {
      // Ensure all labels exist first
      await createMissingLabels(tx, addLabelIds);

      // Get existing label IDs for this thread (after removal)
      const existing = await tx
        .select({ labelId: threadLabels.labelId })
        .from(threadLabels)
        .where(eq(threadLabels.threadId, threadId));

      const existingLabelIds = new Set(existing.map((row) => row.labelId));

      // Filter out labels that already exist
      const newLabelIds = addLabelIds.filter((labelId) => !existingLabelIds.has(labelId));

      if (newLabelIds.length > 0) {
        const threadLabelInserts: InsertThreadLabel[] = newLabelIds.map((labelId) => ({
          threadId,
          labelId,
        }));

        await tx.insert(threadLabels).values(threadLabelInserts);
      }

      return { addedLabels: newLabelIds, removedLabels: removeLabelIds };
    }

    return { addedLabels: [], removedLabels: removeLabelIds };
  });
}

export async function findThreadsWithAllLabels(db: DB, labelIds: string[]): Promise<Thread[]> {
  if (labelIds.length === 0) {
    return await list(db);
  }

  const results = await db
    .select(threadSelect)
    .from(threads)
    .where(
      eq(
        db
          .select({ count: count() })
          .from(threadLabels)
          .where(
            and(eq(threadLabels.threadId, threads.id), inArray(threadLabels.labelId, labelIds)),
          ),
        labelIds.length,
      ),
    )
    .orderBy(desc(threads.latestReceivedOn));

  return results;
}

export async function findThreadsWithAnyLabels(db: DB, labelIds: string[]): Promise<Thread[]> {
  if (labelIds.length === 0) {
    return await list(db);
  }

  const results = await db
    .select(threadSelect)
    .from(threads)
    .innerJoin(threadLabels, eq(threads.id, threadLabels.threadId))
    .where(inArray(threadLabels.labelId, labelIds))
    .groupBy(threads.id)
    .orderBy(desc(threads.latestReceivedOn));

  return results;
}

export async function findThreadsWithLabel(db: DB, labelId: string): Promise<Thread[]> {
  const results = await db
    .select(threadSelect)
    .from(threads)
    .innerJoin(threadLabels, eq(threads.id, threadLabels.threadId))
    .where(eq(threadLabels.labelId, labelId))
    .orderBy(desc(threads.latestReceivedOn));

  return results;
}

export async function findThreadsWithTextSearch(db: DB, searchText: string): Promise<Thread[]> {
  const results = await db
    .select(threadSelect)
    .from(threads)
    .where(
      or(
        like(threads.latestSubject, `%${searchText}%`),
        like(threads.latestSender, `%${searchText}%`),
      ),
    )
    .orderBy(desc(threads.latestReceivedOn));

  return results;
}

// Helper function to build label filtering conditions
function buildLabelConditions(db: DB, labelIds: string[], requireAllLabels: boolean) {
  if (labelIds.length === 0) return null;

  if (requireAllLabels) {
    return eq(
      db
        .select({ count: count() })
        .from(threadLabels)
        .where(and(eq(threadLabels.threadId, threads.id), inArray(threadLabels.labelId, labelIds))),
      labelIds.length,
    );
  } else {
    // Use EXISTS for better performance with any labels
    return sql`EXISTS (
      SELECT 1 FROM ${threadLabels} 
      WHERE ${threadLabels.threadId} = ${threads.id} 
      AND ${threadLabels.labelId} IN ${labelIds}
    )`;
  }
}

// Helper function to build text search conditions
function buildTextSearchConditions(searchText: string) {
  return or(
    like(threads.latestSubject, `%${searchText}%`),
    like(threads.latestSender, `%${searchText}%`),
  );
}

// Helper function to build pagination conditions
function buildPaginationConditions(pageToken: string) {
  return lt(threads.latestReceivedOn, pageToken);
}

// Helper function to calculate pagination result
function calculatePaginationResult(results: Thread[], maxResults: number) {
  const hasNextPage = results.length > maxResults;
  const threadResults = hasNextPage ? results.slice(0, maxResults) : results;
  const nextPageToken = hasNextPage ? results[maxResults].latestReceivedOn : null;

  return { threads: threadResults, nextPageToken };
}

export async function findThreadsWithPagination(
  db: DB,
  params: {
    labelIds?: string[];
    searchText?: string;
    pageToken?: string;
    maxResults: number;
    requireAllLabels?: boolean;
  },
): Promise<{ threads: Thread[]; nextPageToken: string | null }> {
  const { labelIds = [], searchText, pageToken, maxResults, requireAllLabels = false } = params;

  const conditions = [];

  // Apply label filtering
  const labelCondition = buildLabelConditions(db, labelIds, requireAllLabels);
  if (labelCondition) {
    conditions.push(labelCondition);
  }

  // Apply text search
  if (searchText) {
    conditions.push(buildTextSearchConditions(searchText));
  }

  // Apply pagination
  if (pageToken) {
    conditions.push(buildPaginationConditions(pageToken));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const results = await db
    .select(threadSelect)
    .from(threads)
    .where(whereClause)
    .orderBy(desc(threads.latestReceivedOn))
    .limit(maxResults + 1);

  return calculatePaginationResult(results, maxResults);
}

export async function findThreadsByFolder(db: DB, folderLabel: string): Promise<Thread[]> {
  const results = await db
    .select(threadSelect)
    .from(threads)
    .innerJoin(threadLabels, eq(threads.id, threadLabels.threadId))
    .where(eq(threadLabels.labelId, folderLabel))
    .orderBy(desc(threads.latestReceivedOn));

  return results;
}

export async function findThreadsByFolderWithPagination(
  db: DB,
  folderLabel: string,
  params: {
    pageToken?: string;
    maxResults: number;
  },
): Promise<{ threads: Thread[]; nextPageToken: string | null }> {
  const { pageToken, maxResults } = params;

  const conditions = [eq(threadLabels.labelId, folderLabel)];

  if (pageToken) {
    conditions.push(lt(threads.latestReceivedOn, pageToken));
  }

  const results = await db
    .select(threadSelect)
    .from(threads)
    .innerJoin(threadLabels, eq(threads.id, threadLabels.threadId))
    .where(and(...conditions))
    .orderBy(desc(threads.latestReceivedOn))
    .limit(maxResults + 1);

  const hasNextPage = results.length > maxResults;
  const threadResults = hasNextPage ? results.slice(0, maxResults) : results;
  const nextPageToken = hasNextPage ? results[maxResults - 1].latestReceivedOn : null;

  return { threads: threadResults, nextPageToken };
}
