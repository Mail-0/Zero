import { createDb } from '../../db';
import { email as emailTable, priorityScore as priorityScoreTable } from '../../db/schema';
import type { IGetThreadResponse } from '../driver/types';
import { env } from '../../env';
import { and, eq, inArray } from 'drizzle-orm';

const getDatabaseUrl = () => env.HYPERDRIVE?.connectionString || env.DATABASE_URL;

export async function enrichThreadWithPriorityScores(
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
        emailId: priorityScoreTable.emailId,
        score: priorityScoreTable.score,
      })
      .from(priorityScoreTable)
      .innerJoin(emailTable, eq(priorityScoreTable.emailId, emailTable.emailId))
      .where(
        and(
          inArray(priorityScoreTable.emailId, messageIds),
          eq(emailTable.mailboxId, `inbox:${connectionId}`),
        ),
      );

    if (rows.length === 0) {
      return thread;
    }

    const scoreByEmailId = new Map<string, number>();
    for (const row of rows) {
      if (row.score == null) continue;
      scoreByEmailId.set(row.emailId, row.score);
    }

    if (scoreByEmailId.size === 0) {
      return thread;
    }

    const messages = thread.messages.map((message) => {
      const priorityScore = scoreByEmailId.get(message.id);
      if (priorityScore === undefined) {
        return message;
      }

      return { ...message, priorityScore };
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
    console.error('[ENRICH_PRIORITY_SCORES] Failed to enrich thread', {
      connectionId,
      error,
    });
    return thread;
  } finally {
    await conn.end();
  }
}
