import { createDb } from '../../db';
import { actionSuggestion, email as emailTable } from '../../db/schema';
import type { IGetThreadResponse } from '../driver/types';
import { env } from '../../env';
import { and, eq, inArray } from 'drizzle-orm';

const getDatabaseUrl = () => env.HYPERDRIVE?.connectionString || env.DATABASE_URL;

export async function enrichThreadWithActionSuggestions(
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
        emailId: actionSuggestion.emailId,
        actionLabel: actionSuggestion.actionLabel,
      })
      .from(actionSuggestion)
      .innerJoin(emailTable, eq(actionSuggestion.emailId, emailTable.emailId))
      .where(
        and(
          inArray(actionSuggestion.emailId, messageIds),
          eq(emailTable.mailboxId, `inbox:${connectionId}`),
        ),
      );

    if (rows.length === 0) {
      return thread;
    }

    const actionLabelByEmailId = new Map<string, string>();
    for (const row of rows) {
      if (!row.actionLabel || actionLabelByEmailId.has(row.emailId)) continue;
      actionLabelByEmailId.set(row.emailId, row.actionLabel);
    }

    if (actionLabelByEmailId.size === 0) {
      return thread;
    }

    const messages = thread.messages.map((message) => {
      const suggestedAction = actionLabelByEmailId.get(message.id);
      if (!suggestedAction) {
        return message;
      }

      return { ...message, suggestedAction };
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
    console.error('[ENRICH_ACTION_SUGGESTIONS] Failed to enrich thread', {
      connectionId,
      error,
    });
    return thread;
  } finally {
    await conn.end();
  }
}
