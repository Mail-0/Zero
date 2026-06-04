import { openai } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { and, desc, eq, inArray, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { createDb } from '../db';
import {
  actionItem,
  analysisResult,
  category,
  email,
  mailbox,
  userProfile,
} from '../db/schema';
import type { ZeroEnv } from '../env';

type JobOptions = {
  batchSize?: number;
};

const DEFAULT_CATEGORIES = [
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
];

const DEFAULT_ACTIONS = [
  'forwarding',
  'replying',
  'mark at calendar',
  'revise later',
  'ignore',
  'No action needed',
];

const resultSchema = z.object({
  category: z.string(),
  priority_score: z.number(),
  action: z.string(),
  reason: z.string().optional(),
});

type NormalizedResult = {
  category: string;
  priorityScore: number;
  action: string;
  reason: string;
  source: 'llm' | 'fallback';
  rawResult: Record<string, unknown> | null;
  hallucinationChecked: boolean;
};

const cleanText = (value: string): string =>
  value
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const preprocessEmail = (input: {
  subject: string | null;
  body: string | null;
  sender: string | null;
  receiver: string | null;
}) => {
  const subject = cleanText(input.subject ?? '').slice(0, 300);
  const body = cleanText(input.body ?? '').slice(0, 6000);
  return {
    subject,
    body,
    sender: (input.sender ?? '').trim().toLowerCase(),
    receiver: input.receiver ?? null,
  };
};

const normalizeResult = (
  result: Partial<z.infer<typeof resultSchema>>,
  allowedCategories: string[],
  allowedActions: string[],
  source: 'llm' | 'fallback',
  rawResult: Record<string, unknown> | null,
): NormalizedResult => {
  const categoryRaw = String(result.category ?? 'uncategorized').trim();
  const actionRaw = String(result.action ?? 'No action needed').trim();

  const category = allowedCategories.includes(categoryRaw) ? categoryRaw : 'uncategorized';
  const action = allowedActions.includes(actionRaw) ? actionRaw : 'No action needed';

  const priorityScoreRaw = Number(result.priority_score ?? 0);
  const priorityScore = Number.isFinite(priorityScoreRaw)
    ? Math.max(0, Math.min(100, Math.round(priorityScoreRaw)))
    : 0;

  const reason = String(result.reason ?? '').trim() || 'Generated from email content and user profile.';

  return {
    category,
    priorityScore,
    action,
    reason: reason.slice(0, 500),
    source,
    rawResult,
    hallucinationChecked: true,
  };
};

const ruleBasedAnalysis = (
  emailText: { subject: string; body: string; sender: string },
  profile: { importantContacts: string[]; interests: string[]; categories: string[] },
) => {
  const text = `${emailText.subject} ${emailText.body}`.toLowerCase();
  const importantContacts = new Set(profile.importantContacts.map((c) => c.toLowerCase()));
  const categoriesLower = profile.categories.map((c) => c.toLowerCase());

  let category = 'uncategorized';
  let priority = 30;
  let action = 'No action needed';

  if (importantContacts.has(emailText.sender)) {
    priority += 35;
  }

  if (containsAny(text, ['deadline', 'due', 'urgent', 'asap', 'important'])) {
    priority += 30;
    action = 'revise later';
  }

  if (containsAny(text, ['exam', 'assignment', 'lecture', 'class', 'grade'])) {
    category = 'academic';
    priority += 20;
  } else if (containsAny(text, ['seminar', 'workshop', 'conference'])) {
    category = 'seminar';
    action = 'mark at calendar';
  } else if (containsAny(text, ['event', 'festival', 'orientation'])) {
    category = 'event';
    action = 'mark at calendar';
  } else if (containsAny(text, ['survey', 'questionnaire', 'feedback'])) {
    category = 'survey';
    action = 'replying';
  } else if (containsAny(text, ['sale', 'discount', 'promotion', 'unsubscribe'])) {
    category = 'advertisement';
    priority -= 20;
    action = 'ignore';
  } else if (containsAny(text, ['spam', 'winner', 'free money'])) {
    category = 'spam';
    priority = 5;
    action = 'ignore';
  }

  for (const interest of profile.interests) {
    if (!interest) continue;
    const lowerInterest = interest.toLowerCase();
    if (text.includes(lowerInterest)) {
      priority += 10;
      if (categoriesLower.includes(lowerInterest)) {
        category = lowerInterest;
      }
    }
  }

  return {
    category,
    priority_score: Math.max(0, Math.min(100, priority)),
    action,
    reason: 'Fallback rule-based analysis was used because LLM analysis failed.',
  };
};

const containsAny = (text: string, keywords: string[]) =>
  keywords.some((keyword) => text.includes(keyword));

export const runDoormanAnalysisJob = async (env: ZeroEnv, opts: JobOptions = {}) => {
  if (!env.DATABASE_URL) {
    console.warn('[DOORMAN_JOB] DATABASE_URL not configured. Skipping analysis job.');
    return { processed: 0, skipped: 0 };
  }

  if (!env.OPENAI_API_KEY) {
    console.warn('[DOORMAN_JOB] OPENAI_API_KEY not configured. Skipping analysis job.');
    return { processed: 0, skipped: 0 };
  }

  console.log('[DOORMAN_JOB] LLM enabled', {
    provider: 'openai',
    model: env.OPENAI_MODEL || 'gpt-4o-mini',
    batchSize: opts.batchSize ?? 25,
  });

  const { db, conn } = createDb(env.DATABASE_URL);
  const batchSize = opts.batchSize ?? 25;
  let processed = 0;
  let skipped = 0;

  try {
    const candidates = await db
      .select({
        emailId: email.emailId,
        subject: email.subject,
        body: email.body,
        sender: email.sender,
        receiver: email.receiver,
        metadata: email.metadata,
        date: email.date,
        mailboxId: email.mailboxId,
        userId: mailbox.userId,
      })
      .from(email)
      .innerJoin(mailbox, eq(email.mailboxId, mailbox.mailboxId))
      .leftJoin(analysisResult, eq(analysisResult.emailId, email.emailId))
      .where(isNull(analysisResult.id))
      .orderBy(desc(email.date))
      .limit(batchSize);

    if (!candidates.length) {
      return { processed: 0, skipped: 0 };
    }

    const userIds = Array.from(new Set(candidates.map((row) => row.userId)));

    const [profiles, categories, actions] = await Promise.all([
      db.select().from(userProfile).where(inArray(userProfile.userId, userIds)),
      db
        .select()
        .from(category)
        .where(and(inArray(category.userId, userIds), eq(category.enabled, true))),
      db
        .select()
        .from(actionItem)
        .where(and(inArray(actionItem.userId, userIds), eq(actionItem.enabled, true))),
    ]);

    const profileByUserId = new Map(profiles.map((p) => [p.userId, p]));
    const categoriesByUserId = new Map<string, typeof categories>();
    const actionsByUserId = new Map<string, typeof actions>();

    for (const row of categories) {
      const existing = categoriesByUserId.get(row.userId) ?? [];
      existing.push(row);
      categoriesByUserId.set(row.userId, existing);
    }

    for (const row of actions) {
      const existing = actionsByUserId.get(row.userId) ?? [];
      existing.push(row);
      actionsByUserId.set(row.userId, existing);
    }

    for (const row of candidates) {
      const profile = profileByUserId.get(row.userId);
      if (!profile) {
        skipped += 1;
        continue;
      }

      const profileCategories = categoriesByUserId.get(row.userId) ?? [];
      const profileActions = actionsByUserId.get(row.userId) ?? [];

      const allowedCategories = profileCategories.length
        ? profileCategories.map((c) => c.categoryName)
        : DEFAULT_CATEGORIES;
      const allowedActions = profileActions.length
        ? profileActions.map((a) => a.name)
        : DEFAULT_ACTIONS;

      const cleanedEmail = preprocessEmail({
        subject: row.subject,
        body: row.body,
        sender: row.sender,
        receiver: row.receiver,
      });

      let analysis: NormalizedResult;

      try {
        console.log('[DOORMAN_JOB] LLM analysis start', {
          emailId: row.emailId,
          userId: row.userId,
          model: env.OPENAI_MODEL || 'gpt-4o-mini',
        });
        const { object } = await generateObject({
          model: openai(env.OPENAI_MODEL || 'gpt-4o-mini'),
          schema: resultSchema,
          output: 'object',
          system:
            'Analyze the email and return a JSON object with category, priority_score, action, and reason. ' +
            'Use only the provided categories and actions. Do not invent facts beyond the email content.',
          prompt: JSON.stringify({
            email: {
              subject: cleanedEmail.subject,
              body: cleanedEmail.body,
              sender: cleanedEmail.sender,
              receiver: cleanedEmail.receiver,
              metadata: row.metadata ?? {},
            },
            user_profile: {
              user_type: profile.userType,
              interests: profile.interest ?? [],
              affiliations: profile.affiliation ?? [],
              important_contacts: profile.importantContacts ?? [],
            },
            allowed: {
              categories: allowedCategories,
              actions: allowedActions,
            },
          }),
        });

        analysis = normalizeResult(
          object,
          allowedCategories,
          allowedActions,
          'llm',
          object as Record<string, unknown>,
        );
        console.log('[DOORMAN_JOB] LLM analysis complete', {
          emailId: row.emailId,
          userId: row.userId,
          category: analysis.category,
          priorityScore: analysis.priorityScore,
        });
      } catch (error) {
        console.warn('[DOORMAN_JOB] LLM analysis failed. Falling back.', error);
        const fallback = ruleBasedAnalysis(
          {
            subject: cleanedEmail.subject,
            body: cleanedEmail.body,
            sender: cleanedEmail.sender,
          },
          {
            importantContacts: profile.importantContacts ?? [],
            interests: profile.interest ?? [],
            categories: allowedCategories,
          },
        );

        analysis = normalizeResult(
          fallback,
          allowedCategories,
          allowedActions,
          'fallback',
          fallback as Record<string, unknown>,
        );
      }

      const categoryMatch = profileCategories.find(
        (c) => c.categoryName.toLowerCase() === analysis.category.toLowerCase(),
      );

      await db.insert(analysisResult).values({
        id: crypto.randomUUID(),
        userId: row.userId,
        emailId: row.emailId,
        categoryId: categoryMatch?.categoryId ?? null,
        category: analysis.category,
        priorityScore: analysis.priorityScore,
        suggestedActions: analysis.action,
        reason: analysis.reason,
        source: analysis.source,
        rawResult: analysis.rawResult ?? {},
        hallucinationChecked: analysis.hallucinationChecked,
        analyzedAt: new Date(),
      });

      console.log('[DOORMAN_JOB] Inserted analysis_result', {
        emailId: row.emailId,
        userId: row.userId,
        category: analysis.category,
        priorityScore: analysis.priorityScore,
        source: analysis.source,
      });

      processed += 1;
    }

    return { processed, skipped };
  } finally {
    await conn.end();
  }
};
