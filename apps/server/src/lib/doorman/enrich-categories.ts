import { createDb } from '../../db';
import { analysisResult, email as emailTable } from '../../db/schema';
import type { IGetThreadResponse } from '../driver/types';
import { env } from '../../env';
import { and, eq, inArray } from 'drizzle-orm';

const getDatabaseUrl = () => env.HYPERDRIVE?.connectionString || env.DATABASE_URL;

export async function enrichThreadWithCategories(
  connectionId: string,
  thread: IGetThreadResponse,
): Promise<IGetThreadResponse> {
  const databaseUrl = getDatabaseUrl();
  if (!databaseUrl) {
    return thread;
  }

  const messageIds = thread.messages.map((message) => message.id).filter(Boolean);
  if (messageIds.length === 0) {
    return thread;
  }

  const { db, conn } = createDb(databaseUrl);

  try {
    const rows = await db
      .select({
        emailId: analysisResult.emailId,
        category: analysisResult.category,
      })
      .from(analysisResult)
      .innerJoin(emailTable, eq(analysisResult.emailId, emailTable.emailId))
      .where(
        and(
          inArray(analysisResult.emailId, messageIds),
          eq(emailTable.mailboxId, `inbox:${connectionId}`),
        ),
      );

    if (rows.length === 0) {
      return thread;
    }

    const categoryByEmailId = new Map<string, string>();
    for (const row of rows) {
      if (categoryByEmailId.has(row.emailId)) continue;

      const categoryLabel = row.category?.trim();
      if (!categoryLabel) continue;

      categoryByEmailId.set(row.emailId, categoryLabel);
    }

    if (categoryByEmailId.size === 0) {
      return thread;
    }

    const messages = thread.messages.map((message) => {
      const categoryLabel = categoryByEmailId.get(message.id);
      if (!categoryLabel) {
        return message;
      }

      return { ...message, category: categoryLabel };
    });

    const latest = thread.latest
      ? (messages.find((message) => message.id === thread.latest!.id) ?? thread.latest)
      : undefined;

    return {
      ...thread,
      messages,
      latest,
    };
  } catch (error) {
    console.error('[ENRICH_CATEGORIES] Failed to enrich thread', {
      connectionId,
      error,
    });
    return thread;
  } finally {
    await conn.end();
  }
}
