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
  createdAt: threads.createdAt,
  updatedAt: threads.updatedAt,
  threadId: threads.threadId,
  providerId: threads.providerId,
  latestSender: threads.latestSender,
  latestReceivedOn: threads.latestReceivedOn,
  latestSubject: threads.latestSubject,
  latestLabelIds: threads.latestLabelIds,
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

export async function del(db: DB, params: { id: string }): Promise<Thread> {
  const [thread] = await db.delete(threads).where(eq(threads.id, params.id)).returning();
  return thread;
}

export async function get(db: DB, params: { id: string }): Promise<Thread | null> {
  const [result] = await db.select().from(threads).where(eq(threads.id, params.id));
  return result || null;
}

export async function list(db: DB): Promise<Thread[]> {
  return await db.select().from(threads).orderBy(desc(threads.latestReceivedOn));
}

export const countThreads = (db: DB) => db.select({ count: count() }).from(threads);

export async function countThreadsByLabel(db: DB, labelId: string): Promise<number> {
  const [result] = await db
    .select({ count: count() })
    .from(threads)
    .innerJoin(threadLabels, eq(threads.id, threadLabels.threadId))
    .where(eq(threadLabels.labelId, labelId));

  return result.count;
}

export async function createThreadLabel(
  db: DB,
  threadLabel: InsertThreadLabel,
): Promise<ThreadLabel> {
  const [res] = await db.insert(threadLabels).values(threadLabel).onConflictDoNothing().returning();
  return res;
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

export async function addThreadLabels(
  db: DB,
  threadId: string,
  labelIds: string[],
): Promise<void> {
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
    .where(
      and(
        eq(threadLabels.threadId, threadId),
        inArray(threadLabels.labelId, labelIds),
      ),
    );
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
          and(
            eq(threadLabels.threadId, threadId),
            inArray(threadLabels.labelId, removeLabelIds),
          ),
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
      sql`(
        SELECT COUNT(*) 
        FROM ${threadLabels} 
        WHERE ${threadLabels.threadId} = ${threads.id} 
        AND ${threadLabels.labelId} IN (${sql.join(
          labelIds.map((id) => sql`${id}`),
          sql`, `,
        )})
      ) = ${labelIds.length}`,
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

  // Build conditions array
  const conditions = [];

  // Apply label filtering
  if (labelIds.length > 0) {
    if (requireAllLabels) {
      conditions.push(
        sql`(
          SELECT COUNT(*) 
          FROM ${threadLabels} 
          WHERE ${threadLabels.threadId} = ${threads.id} 
          AND ${threadLabels.labelId} IN (${sql.join(
            labelIds.map((id) => sql`${id}`),
            sql`, `,
          )})
        ) = ${labelIds.length}`,
      );
    } else {
      // For any labels, we need to use a different approach
      const labelConditions = labelIds.map(
        (labelId) =>
          sql`EXISTS (
            SELECT 1 FROM ${threadLabels} 
            WHERE ${threadLabels.threadId} = ${threads.id} 
            AND ${threadLabels.labelId} = ${labelId}
          )`,
      );
      conditions.push(or(...labelConditions));
    }
  }

  // Apply text search
  if (searchText) {
    conditions.push(
      or(
        like(threads.latestSubject, `%${searchText}%`),
        like(threads.latestSender, `%${searchText}%`),
      ),
    );
  }

  // Apply pagination
  if (pageToken) {
    conditions.push(lt(threads.latestReceivedOn, pageToken));
  }

  // Build the final query
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const results = await db
    .select(threadSelect)
    .from(threads)
    .where(whereClause)
    .orderBy(desc(threads.latestReceivedOn))
    .limit(maxResults + 1);

  const hasNextPage = results.length > maxResults;
  const threadResults = hasNextPage ? results.slice(0, maxResults) : results;
  const nextPageToken = hasNextPage ? results[maxResults - 1].latestReceivedOn : null;

  return { threads: threadResults, nextPageToken };
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
